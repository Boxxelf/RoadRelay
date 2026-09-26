"""Exercise HTTP and UDP in an isolated temporary database, never the demo data."""
import json
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).parents[1]
BASE='http://127.0.0.1:18765'


def request(path,body=None,headers=None):
    request_headers={'Content-Type':'application/json',**(headers or {})}
    req=urllib.request.Request(BASE+path,data=None if body is None else json.dumps(body).encode(),headers=request_headers)
    with urllib.request.urlopen(req,timeout=3) as r:
        content=r.read()
        return json.loads(content) if r.headers.get_content_type()=='application/json' else content


with tempfile.TemporaryDirectory(prefix='roadrelay-test-') as tmp:
    process=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--port','18765','--udp-port','14210','--data-dir',tmp],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    try:
        for attempt in range(30):
            try: setup=request('/api/setup');break
            except urllib.error.URLError: time.sleep(.1)
        else: raise RuntimeError('Test server did not start')
        assert b'RoadRelay' in request('/')
        assert b'href="/dashboard"' in request('/')
        assert b'id="globe"' in request('/')
        assert b'id="prototype-controls"' in request('/dashboard')
        assert b'Start recording' in request('/dashboard')
        assert b'RoadRelay brand system' in request('/dashboard.css')
        assert b'coarse' in request('/home.js').lower()
        assert b'<svg' in request('/service-vehicle.svg')
        assert request('/api/state?mode=live')['incidents']==[]
        request('/api/passes/start',{'checkpoint':'B','device':'TEST-ONLY'})
        packet=dict(token=setup['token'],device='TEST-ONLY',boot='integration',seq=0,samples=[[10,.1,0],[20,.8,2],[30,.4,2]])
        assert request('/api/telemetry',packet)['accepted']
        packet['seq']=1;packet['samples']=[[40,.9,2],[50,.1,2]]
        sock=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
        sock.sendto(json.dumps(packet).encode(),('127.0.0.1',14210));sock.close()
        for attempt in range(30):
            state=request('/api/state?mode=live')
            if state['incidents'] and state['incidents'][0]['peak']==.9: break
            time.sleep(.05)
        assert state['incidents'][0]['peak']==.9
        assert state['incidents'][0]['abnormal_passes']==1
        request('/api/passes/stop',{})
        iid=state['incidents'][0]['id']
        request(f'/api/incidents/{iid}',{'status':'Inspection assigned','assignee':'Test crew'})
        assert request(f'/api/incidents/{iid}')['status']=='Inspection assigned'
        assert 'not AI' in request(f'/api/incidents/{iid}/brief',{'ai':False})['kind']
        csv=request('/api/export?mode=live').decode()
        assert 'TEST-ONLY' in csv and 'simulated' in csv and 'synthetic' not in csv
        assert request('/api/state?mode=simulation')['stats']['vehicles']==20
        try: request('/api/passes/start',{'checkpoint':'A','device':'TEST-ONLY'},{'Origin':'https://untrusted.example'})
        except urllib.error.HTTPError as e: assert e.code==403
        else: raise AssertionError('Cross-origin write should fail')
        print('PASS: HTTP serving, USB ingestion, UDP ingestion, pass aggregation, assignment persistence, rule summary, CSV provenance, source isolation, cross-origin rejection.')
    finally:
        process.terminate();process.wait(timeout=5)
