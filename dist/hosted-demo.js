'use strict';
(() => {
  const key='roadrelay-public-demo-v1';
  const transitions={'Needs review':['Inspection assigned','Dismissed'],'Inspection assigned':['Confirmed','Dismissed'],Confirmed:['Repair completed','Dismissed'],'Repair completed':['Recheck'],Recheck:['Confirmed','Dismissed'],Dismissed:['Needs review']};
  let edits={};try{edits=JSON.parse(localStorage.getItem(key)||'{}');}catch{}
  if(!edits||typeof edits!=='object'||Array.isArray(edits))edits={};
  const ready=fetch('/demo-data.json').then(r=>{if(!r.ok)throw new Error('Could not load the demo.');return r.json();});
  function detail(data,id){const item=structuredClone(data.details[id]);if(!item)throw new Error('Observation not found.');const edit=edits[id];if(edit&&transitions[edit.status]){for(const k of ['status','assignee','note','brief','brief_type'])item[k]=String(edit[k]||'').slice(0,k==='brief'?3000:1500);item.audit=[...(Array.isArray(edit.audit)?edit.audit:[]),...item.audit];}item.allowed_statuses=transitions[item.status];return item;}
  function save(id,item){const patch={};for(const k of ['status','assignee','note','brief','brief_type'])patch[k]=item[k];patch.audit=item.audit.filter(a=>a.hosted===true).slice(0,30);edits[id]=patch;try{localStorage.setItem(key,JSON.stringify(edits));}catch{throw new Error('Browser storage is unavailable. This change only lasts in the current tab.');}}
  window.roadRelayDemo={
    openLocal(){window.open('http://127.0.0.1:8765/dashboard','_blank','noopener');},
    async api(path,body){
      const data=await ready,url=new URL(path,location.origin);
      if(url.pathname==='/api/state'){
        if(url.searchParams.get('mode')!=='simulation')throw new Error('Real sensor input requires the local application.');
        const state=structuredClone(data.state);state.incidents=state.incidents.map(i=>detail(data,String(i.id)));state.stats.review=state.incidents.filter(i=>['Needs review','Recheck'].includes(i.status)).length;state.server_time=Date.now()/1000;return state;
      }
      const match=url.pathname.match(/^\/api\/incidents\/(\d+)(\/brief)?$/);
      if(!match)throw new Error('This operation requires the local RoadRelay application.');
      const id=match[1],item=detail(data,id);
      if(body){
        if(match[2]){
          if(body.ai)throw new Error('AI is available only in the configured local application.');
          item.brief_type='Rule-based summary · not AI';item.brief=`Evidence\n${item.abnormal_passes} synthetic abnormal passes from ${item.vehicles} synthetic vehicles. Peak impact: ${item.peak.toFixed(2)} g. Location is simulated.\n\nNext step\nReview the waveform and inspect possible bumps, joints, or mounting effects. Current status: ${item.status}. A human makes the maintenance decision.\n\nLimits\nThis hosted scenario does not contain live hardware data, real GPS, or confirmed road defects. No work order is sent.`;
          save(id,item);return {kind:item.brief_type,text:item.brief};
        }
        const next=String(body.status||item.status),note=String(body.note||'').trim().slice(0,1500),assignee=String(body.assignee||'').trim().slice(0,80);
        if(next!==item.status&&!transitions[item.status].includes(next))throw new Error('This status change is not allowed.');
        if(next==='Inspection assigned'&&!assignee)throw new Error('Choose an inspection team first.');
        if(['Confirmed','Dismissed','Repair completed'].includes(next)&&next!==item.status&&!note)throw new Error('Add an inspection or completion note.');
        Object.assign(item,{status:next,note,assignee,brief:'',brief_type:''});item.audit.unshift({at:Date.now()/1000,message:`${next}. Assigned to: ${assignee||'Not assigned'}. ${note}`,hosted:true});save(id,item);
      }
      return detail(data,id);
    },
    async exportCsv(){const data=await ready;const rows=['source,location_source,device,received_unix,impact_g,led_level'];for(const item of Object.values(data.details))for(const s of item.samples)rows.push(`synthetic,simulated,${s.device},${s.received},${s.impact},${s.level}`);const url=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));const a=document.createElement('a');a.href=url;a.download='roadrelay-synthetic-evidence.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  };
  document.addEventListener('DOMContentLoaded',()=>{document.querySelector('#connect-btn').textContent='Local sensor setup ';document.querySelector('#live-mode').textContent='Local prototype ';document.querySelector('#live-mode').title='Opens the separately running application on this computer';});
})();
