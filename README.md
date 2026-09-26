# RoadRelay

## Public website on Vercel

The public website serves the company homepage at `/` and an interactive synthetic dashboard at `/dashboard`. Inspection assignments, status changes and rule-based briefs are stored only in the visitor's browser. The 20 vehicles are a synthetic demonstration, not customer deployments or live sensor readings. AI is disabled in this hosted demo.

Run `npm run build` to generate the allowlisted `public/` directory. Vercel reads `vercel.json` and deploys that directory. Run `npm run test:web` to check the hosted workflow. `python3 scripts/export-demo.py` regenerates only fresh synthetic fixture data using a temporary database.

Real Arduino Wi-Fi telemetry still requires the local Python application below: Vercel's static demo does not receive UDP or share the local SQLite database. **Local prototype** opens `http://127.0.0.1:8765/dashboard` on the visitor's own computer; start the local server first.

For a fresh clone, copy `firmware/RoadRelayWiFi/arduino_secrets.example.h` to `arduino_secrets.h`, then fill in your private settings. Never commit that file, `.env`, receiver tokens, or the `data/` directory. A previous public commit contained local credentials and data: removing them from the current revision does not remove historical copies. Rotate the exposed Wi-Fi credentials and receiver token before relying on them again.

An English-language, local road-inspection dashboard for Origin Weekend 2026, Prompt D.

**Real toy-car impacts. Simulated location. Human-reviewed inspections.** The original `../originweekend_sep25.ino` is unchanged. The separate Wi-Fi sketch preserves its measurement thresholds, LED hold and LCD logic; the startup brand reads RoadRelay.

## Start

Double-click `start.command`, or run these commands in this folder:

```sh
python3 server.py
```

Open **http://127.0.0.1:8765** for the company homepage. Click **Demo** in the top-right corner to enter the dashboard, or open **http://127.0.0.1:8765/dashboard** directly. Keep the terminal running. Python 3.9+ is sufficient; no package installation, JavaScript build, internet map, account or cloud database is required. If the address is already in use, the website may already be running. Use that existing instance.

The homepage introduces the company concept, mission, vision, intended collaborators and proposed pilot business model. Its globe and vehicle animation are illustrations, not live fleet telemetry. No signed partnership or customer deployment is claimed. The implementation plan is in `DESIGN_PLAN.md`.

Dashboard recording controls are above the map: choose **Demo location**, press **Start recording**, then **Finish recording**. One recording is one vehicle pass. The selected demo location still stands in for GPS.

This is a local prototype, not a public website. The browser interface listens only on localhost. A token-protected UDP receiver listens on the local network at port 4210 for the Arduino. Use a trusted private network. Do not forward the port to the internet. There is no production authentication or organization-level access control.

## What is real and what is simulated

| Capability | Implementation |
| --- | --- |
| Live impact sensing | Real Arduino data over Wi-Fi or the USB bridge |
| Signal chart | Same Impact values as Serial Plotter, rendered independently |
| Data storage | SQLite on this computer, including samples, passes, incidents and activity |
| Location | Operator-selected A/B/C checkpoints; illustrative coordinates only |
| Map | Offline schematic of the USC area, not a GIS or navigation map |
| Fleet scenario | 20 synthetic IDs, 60 synthetic passes, three illustrative checkpoints |
| Inspection assignments | Persisted local records; no external dispatch or notifications |
| AI brief | Real optional OpenAI Responses API integration, only on explicit click |
| Rule-based summary | Offline template, prominently labeled “not AI” |
| GPS, field accuracy, repair savings | Not demonstrated; future validation required |

The two workspaces never mix datasets. Initial live data is empty. Simulated anomalies are not reports of actual damage near USC. Agency names are illustrative, not affiliations.

## Wi-Fi setup

1. Connect the UNO R4 WiFi and computer to the same trusted 2.4 GHz Wi-Fi or hotspot. Client isolation must not prevent the devices communicating. If a campus network prevents peer traffic, use your own hotspot/router or the USB fallback; do not change institutional network security.
2. Open `firmware/RoadRelayWiFi/RoadRelayWiFi.ino` in Arduino IDE. Select **Arduino UNO R4 WiFi**. The UNO R4 board package supplies **WiFiS3** and **Wire**; install **LiquidCrystal by Arduino** if missing.
3. Open the adjacent `arduino_secrets.h` tab. Fill in SSID and password. Set `RECEIVER_IP` to this computer's LAN IPv4 address, not `127.0.0.1`. On macOS: System Settings → Wi-Fi → Details → TCP/IP.
4. In RoadRelay, click **Connect device**. Copy the receiver token into `RECEIVER_TOKEN`. Leave `DEVICE_ID` as `RR-01`, or give each real device a distinct ID. Keep these settings private.
5. Upload the Wi-Fi sketch. The firmware attempts to connect once at startup. Reset the board after changing networks or if initial connection fails. Original LED/LCD sensing and serial output work even if the network is unavailable.
6. Switch to **Live prototype**. Receiving data should show under the chart and Connect device. Select checkpoint A, B or C; press **Start recording** before rolling the car. Press **Finish recording** before moving to the next checkpoint.

The sketch sends batches of 12 samples via local UDP; sequence numbers expose missing batches. UDP is best-effort and does not retry. Actual sample timestamps are stored. Network calls can add acquisition latency, so no fixed 100 Hz performance is claimed. Test with the real hardware before presenting. Disconnecting the sensor stops fresh readings; the dashboard shows offline after three seconds and never treats silence as a safe road.

Do not run Wi-Fi ingestion and the USB bridge for the same device simultaneously, because they are separate data transports. Resetting the board starts a new packet session. The prototype is intended for short demo runs, not multi-week unattended deployment.

## USB fallback with the original sketch

Keep `../originweekend_sep25.ino` on the board. Close Arduino **Serial Plotter** and **Serial Monitor**, so only the bridge reads the serial port.

Find the device port in Arduino IDE, or on macOS:

```sh
ls /dev/cu.*
python3 serial_bridge.py --port /dev/cu.usbmodemYOUR_PORT
```

The bridge parses lines such as `Impact:0.735 Small:0.20 Big:0.60`. It reconstructs the original LED hold behavior and timestamps samples on computer arrival, because the original sketch does not emit a device timestamp or LED state. Thus USB timing and displayed LED state are estimates; Wi-Fi includes actual device timestamps and state. No driver or third-party Python package is needed on macOS/Linux. Windows is not supported by this termios-based bridge.

This redraws the Serial Plotter data; it does not import an image or embed the Arduino IDE. Live input is saved even outside a pass, but it is not assigned to a location or turned into an incident until an operator starts a checkpoint pass.

## Recording and interpretation

- Green: this observation did not exceed the threshold. It is not a road-safety certification.
- Yellow: impact greater than 0.20 g.
- Red: impact greater than 0.60 g, suspected road anomaly, inspection needed.
- The physical LCD still says `POTHOLE!`, as in the original sketch. Explain that the dashboard interprets this as a **suspected anomaly**, not a confirmed pothole. The original 1.5-second alarm hold is retained.
- A pass is explicitly started and finished. Many threshold-crossing samples during the pass count as **one abnormal pass**, not many potholes.
- Repeated passes at the same checkpoint aggregate into the open incident. The device count is distinct vehicle IDs, not the number of passes. This prototype aggregates by checkpoint, not by real GPS distance or lane.
- A normal pass contributes to coverage but creates no incident. Completed repairs and dismissed incidents are not automatically reopened; a new abnormal pass creates a new candidate. A manually opened Recheck record can receive new evidence.
- The coordinator assigns an inspection, then records confirmation or dismissal. Confirmation and repair completion require a note. Records are local and no team is actually notified.
- Open a record and use **Replay this pass** to replay stored evidence. In the live workspace, click **Return to live** afterward. Chart pause/replay does not stop collection.
- **Export CSV** exports the selected workspace, with source, simulated-location flag, device, times, impact, LED state, pass, checkpoint and transport.

## AI setup (optional)

Copy `.env.example` to `.env` and set `OPENAI_API_KEY` and `OPENAI_MODEL` to a Responses API model available to your account. Restart `server.py`. Never paste the key into browser JavaScript, a presentation or a public repository.

The **Generate AI brief** button sends only the selected event's summary and inspection note to `https://api.openai.com/v1/responses`, with `store: false`. It runs only when clicked. `store: false` does not imply that all API logs or retention are disabled; your provider's data policy still applies. The model writes an English inspection brief. It cannot change state, assign teams, set priorities, estimate unsupported damage depth, or claim real GPS.

Without a key/model, AI is visibly unavailable. **Rule-based summary** remains usable offline and is labeled “not AI.” Network/model failures produce a visible error. A model response that finishes after the incident changes is rejected as stale.

API reference: https://developers.openai.com/api/docs/guides/migrate-to-responses

## 30-second video plan

- 0–5 s: Show toy car, MPU6050, LEDs and LCD. Say “live impact sensing, simulated location.”
- 5–12 s: Start a pass at checkpoint B, roll over the test obstacle, show the real waveform and candidate.
- 12–18 s: Finish and repeat the pass. Show one candidate with two passes and one real device.
- 18–25 s: Open evidence, assign a demo inspection team, generate the available summary.
- 25–30 s: Show the separate 20-vehicle simulation to explain future fleet scale.

Use: “This prototype demonstrates live impact sensing with simulated location tagging. Production deployment would add GNSS or authorized fleet-location data.” Do not claim field deployment, customer interviews, actual GPS, detection accuracy or purchased customers.

## Files and storage

- `server.py`: local HTTP interface, UDP receiver, SQLite storage, optional AI call.
- `dist/`: complete offline frontend, plain HTML/CSS/JavaScript.
- `serial_bridge.py`: macOS/Linux fallback for the original serial output.
- `firmware/RoadRelayWiFi/`: Arduino sketch and local secrets configuration.
- `data/roadrelay.sqlite3`: data on this computer. Stop the server before making a complete backup of the `data` folder; while running, SQLite may also use WAL files.
- `data/receiver-token`: generated automatically, only for this receiver.
- `tests/`: isolated verification; test-generated sensor packets never enter the primary demo database.

No external packages, assets or fonts are fetched by the dashboard. The schematic remains available offline. AI and outgoing research links need internet.

## Validation

```sh
PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s tests -v
python3 tests/integration.py
node --check dist/app.js
```

Integration tests temporarily bind localhost port 18765 and UDP port 14210 and use an isolated temporary database. Do not present their synthetic packets as hardware validation.

## Research used

- StreetsLA, January 28, 2026 budget overview: https://cityclerk.lacity.org/onlinedocs/2026/26-0068_misc_1_28-26bss.pdf
- StreetsLA inspection and referral workflow: https://streets.lacity.gov/about-us/frequently-asked-questions
- USC facilities work orders: https://fpm.usc.edu/faq/
- Caltrans District 7 responsibilities: https://dot.ca.gov/caltrans-near-me/district-7/district-7-popular-links/d7-profile
- Arduino UNO R4 WiFi / WiFiS3: https://docs.arduino.cc/tutorials/uno-r4-wifi/cheat-sheet/

These are published sources used for desk research, not customer interviews or endorsements. The original firmware was provided by the user; this project adds telemetry, the local receiver and the dashboard.
