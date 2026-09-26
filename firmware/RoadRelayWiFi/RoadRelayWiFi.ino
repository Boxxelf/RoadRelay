// RoadRelay Wi-Fi transport, derived from originweekend_sep25.ino.
// Signal classifications are review cues, not confirmed potholes. GPS is simulated in the dashboard.
#include <Wire.h>
#include <math.h>
#include <LiquidCrystal.h>
#include <WiFiS3.h>
#include "arduino_secrets.h"
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
const byte MPU_ADDRESS = 0x68;
const int GREEN_LED = 8;
const int YELLOW_LED = 9;
const int RED_LED = 10;
const float SMALL_THRESHOLD = 0.20;
const float BIG_THRESHOLD = 0.60;
const float SEVERITY_MAX_G = 1.5;
const unsigned long HOLD_MS = 1500;
const unsigned long PAGE_MS = 2000;
const char* DEMO_LOCATION = "Main St C";
int level = 0;
float peak = 0;
float tiltFiltered = 0;
unsigned long eventTime = 0;
unsigned long lastLcdUpdate = 0;
unsigned long lastPageSwitch = 0;
int page = 0;
void writeMPU(byte reg, byte value) {
  Wire.beginTransmission(MPU_ADDRESS);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}
int16_t readTwoBytes() {
  uint16_t high = Wire.read();
  uint16_t low = Wire.read();
  return (int16_t)((high << 8) | low);
}
void setLeds(int g, int y, int r) {
  digitalWrite(GREEN_LED, g);
  digitalWrite(YELLOW_LED, y);
  digitalWrite(RED_LED, r);
}
void printLine(int row, String text) {
  while (text.length() < 16) text += " ";
  lcd.setCursor(0, row);
  lcd.print(text.substring(0, 16));
}
String leftRight(String left, String right) {
  while (left.length() + right.length() < 16) left += " ";
  return left + right;
}
int getSeverity(float value) {
  return constrain((int)(value / SEVERITY_MAX_G * 10 + 0.5), 1, 10);
}

// Transport only. The sensor thresholds, LED hold and LCD states below are unchanged.
// UDP is local and best-effort. Batch sequence numbers expose missing packets.
WiFiUDP telemetry;
IPAddress receiver;
const unsigned int RECEIVER_PORT = 4210;
struct Sample { unsigned long ms; float impact; int led; };
Sample packetSamples[12];
byte packetCount = 0;
unsigned long packetSequence = 0;
unsigned long bootId = 0;
unsigned long lastNetworkCheck = 0;
bool networkReady = false;

void startTelemetry() {
  bootId = micros() ^ (unsigned long)analogRead(A0);
  receiver.fromString(RECEIVER_IP);
  // Connect once at startup. To retry after changing networks, reset the board.
  // Avoid repeated blocking WiFi.begin calls while collecting impacts.
  if (strcmp(SECRET_SSID, "YOUR_2_4_GHZ_WIFI") != 0) {
    WiFi.begin(SECRET_SSID, SECRET_PASS);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - start < 8000) delay(100);
    networkReady = WiFi.status() == WL_CONNECTED;
    if (networkReady) telemetry.begin(4211);
  }
}

void sendTelemetry(float impact, int led) {
  packetSamples[packetCount++] = {millis(), impact, led};
  if (packetCount < 12) return;
  if (millis() - lastNetworkCheck > 2000) {
    bool wasReady = networkReady;
    networkReady = WiFi.status() == WL_CONNECTED;
    if (networkReady && !wasReady) telemetry.begin(4211);
    lastNetworkCheck = millis();
  }
  if (networkReady) {
    char payload[1200];
    int used = snprintf(payload, sizeof(payload),
      "{\"token\":\"%s\",\"device\":\"%s\",\"boot\":\"%lu\",\"seq\":%lu,\"samples\":[",
      RECEIVER_TOKEN, DEVICE_ID, bootId, packetSequence);
    if (used > 0 && used < (int)sizeof(payload)) {
      bool fits = true;
      for (byte i = 0; i < packetCount; i++) {
        int added = snprintf(payload + used, sizeof(payload) - used, "%s[%lu,%.4f,%d]",
          i ? "," : "", packetSamples[i].ms, packetSamples[i].impact, packetSamples[i].led);
        if (added < 0 || added >= (int)(sizeof(payload) - used)) { fits = false; break; }
        used += added;
      }
      if (fits && used + 3 < (int)sizeof(payload)) {
        payload[used++] = ']'; payload[used++] = '}'; payload[used] = 0;
        if (telemetry.beginPacket(receiver, RECEIVER_PORT)) {
          telemetry.write((const uint8_t*)payload, used);
          telemetry.endPacket();
        }
      }
    }
  }
  packetSequence++;
  packetCount = 0;
}

void setup() {
  Serial.begin(115200);
  Wire.begin();
  pinMode(GREEN_LED, OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  lcd.begin(16, 2);
  printLine(0, "RoadRelay v1");
  printLine(1, "Self test...");
  setLeds(1, 0, 0); delay(400);
  setLeds(0, 1, 0); delay(400);
  setLeds(0, 0, 1); delay(400);
  setLeds(0, 0, 0);
  writeMPU(0x6B, 0x00);
  writeMPU(0x1C, 0x10);
  writeMPU(0x1A, 0x03);
  Wire.beginTransmission(MPU_ADDRESS);
  if (Wire.endTransmission() != 0) {
    printLine(0, "MPU6050 ERROR");
    printLine(1, "Check SDA/SCL");
    while (true) {
      setLeds(0, 0, 1); delay(300);
      setLeds(0, 0, 0); delay(300);
    }
  }
  printLine(0, "Sensor ready!");
  printLine(1, String("Loc: ") + DEMO_LOCATION);
  delay(1000);
  lcd.clear();
  startTelemetry();
}
void loop() {
  Wire.beginTransmission(MPU_ADDRESS);
  Wire.write(0x3B);
  if (Wire.endTransmission(false) != 0) return;
  Wire.requestFrom(MPU_ADDRESS, (byte)6, (byte)true);
  if (Wire.available() < 6) return;
  float ax = readTwoBytes() / 4096.0;
  float ay = readTwoBytes() / 4096.0;
  float az = readTwoBytes() / 4096.0;
  float total = sqrt(ax * ax + ay * ay + az * az);
  float impact = fabs(total - 1.0);
  float tilt = atan2(sqrt(ax * ax + ay * ay), fabs(az)) * 180.0 / PI;
  tiltFiltered = 0.9 * tiltFiltered + 0.1 * tilt;
  int current = 0;
  if (impact > BIG_THRESHOLD) current = 2;
  else if (impact > SMALL_THRESHOLD) current = 1;
  if (current > 0 && current >= level) {
    level = current;
    eventTime = millis();
  }
  if (level > 0 && impact > peak) peak = impact;
  if (level > 0 && millis() - eventTime > HOLD_MS) {
    level = 0;
    peak = 0;
  }
  setLeds(level == 0, level == 1, level == 2);
  if (millis() - lastPageSwitch > PAGE_MS) {
    lastPageSwitch = millis();
    page = (page + 1) % 3;
  }
  if (millis() - lastLcdUpdate > 200) {
    lastLcdUpdate = millis();
    String sev = String(getSeverity(peak)) + "/10";
    if (level == 0)      printLine(0, "NORMAL ROAD");
    else if (level == 1) printLine(0, leftRight("SMALL BUMP", sev));
    else                 printLine(0, leftRight("POTHOLE!", sev));
    float shownImpact = (level > 0) ? peak : impact;
    if (page == 0)      printLine(1, "Impact: " + String(shownImpact, 2) + "g");
    else if (page == 1) printLine(1, "Tilt: " + String(tiltFiltered, 1) + " deg");
    else                printLine(1, String("Loc: ") + DEMO_LOCATION);
  }
  Serial.print("Impact:");
  Serial.print(impact, 3);
  Serial.print("\tSmall:");
  Serial.print(SMALL_THRESHOLD);
  Serial.print("\tBig:");
  Serial.println(BIG_THRESHOLD);
  sendTelemetry(impact, level);
  delay(10);
}
