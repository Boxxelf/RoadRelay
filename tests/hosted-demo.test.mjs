import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../dist/hosted-demo.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../dist/demo-data.json',import.meta.url),'utf8'));
function boot(storage=new Map()){
  const context={window:{},URL,structuredClone,Date,Blob,setTimeout,location:{origin:'https://example.com'},document:{addEventListener(){}},fetch:async()=>({ok:true,json:async()=>structuredClone(data)}),localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
  vm.runInNewContext(source,context);return context.window.roadRelayDemo;
}
test('public scenario never exposes live hardware or real location records',async()=>{
  const api=boot();const state=await api.api('/api/state?mode=simulation');
  assert.equal(state.devices.length,0);assert.equal(state.active_pass,null);assert.equal(state.ai_available,false);
  assert.ok(state.incidents.length>0);assert.ok(state.incidents.every(i=>i.mode==='simulation'&&i.signal_source==='synthetic'));
  await assert.rejects(api.api('/api/state?mode=live'),/local application/);
  await assert.rejects(api.api('/api/setup'),/local RoadRelay/);
});
test('inspection workflow validates human decisions and persists after reload',async()=>{
  const storage=new Map(),api=boot(storage),state=await api.api('/api/state?mode=simulation');
  const item=state.incidents.find(i=>i.status==='Needs review'),path=`/api/incidents/${item.id}`;
  await assert.rejects(api.api(path,{status:'Confirmed'}),/not allowed/);
  await assert.rejects(api.api(path,{status:'Inspection assigned'}),/team/);
  await api.api(path,{status:'Inspection assigned',assignee:'Campus inspection team'});
  await assert.rejects(api.api(path,{status:'Confirmed'}),/note/);
  await api.api(path,{status:'Confirmed',assignee:'Campus inspection team',note:'Synthetic inspection confirmed for workflow demo.'});
  assert.equal((await boot(storage).api(path)).status,'Confirmed');
  const brief=await api.api(path+'/brief',{ai:false});assert.match(brief.text,/synthetic/);assert.match(brief.kind,/not AI/);
  await assert.rejects(api.api(path+'/brief',{ai:true}),/configured local/);
});
