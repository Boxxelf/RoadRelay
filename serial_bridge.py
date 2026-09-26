#!/usr/bin/env python3
"""Read the unchanged Arduino sketch on macOS/Linux and forward to RoadRelay."""
import argparse
import json
import os
import re
import select
import sys
import termios
import time
import urllib.error
import urllib.request


def parse_line(line):
    match=re.search(r'Impact:([0-9.]+)\s+Small:([0-9.]+)\s+Big:([0-9.]+)',line)
    if not match: return None
    try: return tuple(float(v) for v in match.groups())
    except ValueError: return None


def main():
    p=argparse.ArgumentParser(description='RoadRelay USB fallback. Close Arduino Serial Monitor and Plotter first.')
    p.add_argument('--port',required=True,help='For example /dev/cu.usbmodem123')
    p.add_argument('--device',default='RR-01')
    p.add_argument('--server',default='http://127.0.0.1:8765')
    args=p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,32}',args.device): p.error('Invalid device ID')
    try:
        with urllib.request.urlopen(args.server+'/api/setup',timeout=4) as res: token=json.load(res)['token']
        fd=os.open(args.port,os.O_RDWR|os.O_NOCTTY|os.O_NONBLOCK)
    except (OSError,urllib.error.URLError) as e:
        sys.exit(f'Could not connect. Start server.py, check --port, and close the Arduino serial tools. {e}')
    old=termios.tcgetattr(fd)
    cfg=termios.tcgetattr(fd)
    cfg[0]=0;cfg[1]=0;cfg[2]=termios.CS8|termios.CREAD|termios.CLOCAL;cfg[3]=0
    cfg[4]=termios.B115200;cfg[5]=termios.B115200
    cfg[6][termios.VMIN]=0;cfg[6][termios.VTIME]=0
    termios.tcsetattr(fd,termios.TCSANOW,cfg)
    buf=b'';samples=[];seq=0;boot=str(time.time_ns());start=time.monotonic();last_send=start
    level=0;event_time=0
    print(f'RoadRelay USB bridge: {args.port} → {args.device}. Press Ctrl-C to stop.',flush=True)
    print('Sample times use host arrival time; LED state is reconstructed from the original sketch.',flush=True)
    try:
        while True:
            ready,_,_=select.select([fd],[],[],.05)
            if ready:
                chunk=os.read(fd,8192)
                if not chunk: raise OSError('Serial device disconnected')
                buf+=chunk
                while b'\n' in buf:
                    line,buf=buf.split(b'\n',1)
                    value=parse_line(line.decode(errors='replace'))
                    if value is None: continue
                    impact,small,big=value
                    now=time.monotonic();current=2 if impact>big else 1 if impact>small else 0
                    if current>0 and current>=level: level=current;event_time=now
                    if level>0 and now-event_time>1.5: level=0
                    samples.append([int((now-start)*1000),impact,level])
                if len(buf)>8192: buf=b''
            now=time.monotonic()
            if samples and (now-last_send>=.2 or len(samples)>=100):
                while samples:
                    batch=samples[:100];samples=samples[100:]
                    body=dict(token=token,device=args.device,boot=boot,seq=seq,samples=batch);seq+=1
                    request=urllib.request.Request(args.server+'/api/telemetry',data=json.dumps(body).encode(),headers={'Content-Type':'application/json'})
                    try:
                        with urllib.request.urlopen(request,timeout=2) as response: response.read()
                    except (urllib.error.URLError,TimeoutError): print('Receiver unavailable; batch dropped. Reconnect the dashboard.',file=sys.stderr)
                last_send=now
    except KeyboardInterrupt: print('\nBridge stopped.')
    except OSError as e: print(f'Serial connection stopped: {e}',file=sys.stderr)
    finally:
        try: termios.tcsetattr(fd,termios.TCSANOW,old)
        except OSError: pass
        os.close(fd)


if __name__=='__main__': main()
