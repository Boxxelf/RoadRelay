"""Export only freshly generated synthetic records, never the user's data directory."""
import json
from pathlib import Path
import sys
import tempfile
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from server import Store
with tempfile.TemporaryDirectory(prefix='roadrelay-synthetic-') as folder:
    store=Store(Path(folder)/'demo.sqlite3')
    state=store.state('simulation')
    state['ai_available']=False
    payload={'state':state,'details':{str(i['id']):store.detail(i['id']) for i in state['incidents']}}
    assert not state['devices'] and not state['active_pass']
    assert all(i['mode']=='simulation' and i['signal_source']=='synthetic' for i in state['incidents'])
    (Path(__file__).resolve().parents[1]/'dist/demo-data.json').write_text(json.dumps(payload,separators=(',',':')))
    store.db.close()
print('Exported a fresh 20-vehicle synthetic scenario.')
