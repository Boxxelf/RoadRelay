'use strict';
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let mode = 'simulation', state = null, selected = null, evidence = null, filter = 'open';
let paused = false, zoom = 1, receiverToken = '', polling = false, replayTimer = null, renderKey = '', recordedView = false;
let modeGeneration = 0;
const colors = {red:'#c2443c', amber:'#c18a30', green:'#36775d', gray:'#98a6b6'};
const date = t => new Date(t * 1000).toLocaleString('en-US', {month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
const toast = (message) => { $('#toast').textContent=message; $('#toast').hidden=false; clearTimeout(toast.timer); toast.timer=setTimeout(()=>$('#toast').hidden=true,6500); };
async function api(path, body) {
  const res = await fetch(path, body === undefined ? {} : {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const data=await res.json(); if (!res.ok) throw new Error(data.error || 'Request failed.'); return data;
}
function modal(id) { const node=$(`#${id}`); if(!node.open) node.showModal(); }
function setHTML(node, html) { if(node.innerHTML!==html) node.innerHTML=html; }
function colorFor(peak) { return peak>.6?colors.red:peak>.2?colors.amber:colors.gray; }
function openRecords() { return state.incidents.filter(x=>!['Dismissed','Repair completed'].includes(x.status)); }
function clearReplay() { clearInterval(replayTimer); replayTimer=null; }
async function setMode(next) {
  if(next===mode && state) return;
  mode=next; modeGeneration++; selected=null; evidence=null; paused=false; recordedView=false; renderKey=''; clearReplay();
  // Clear the previous source immediately while the next workspace loads.
  ['#vehicles','#passes','#review','#covered','#reading'].forEach(id=>$(id).textContent='—');
  $('#queue').innerHTML='<div class="empty-state"><h3>Loading observations</h3><p>Opening the selected workspace.</p></div>';
  $('#queue-count').textContent='—'; $('#map-pins').innerHTML=''; $('#chart').innerHTML='';
  $('#chart-title').textContent='Loading evidence'; $('#chart-subtitle').textContent='Opening the selected workspace.';
  $('#led-state').textContent='Waiting for data'; $('#pass-btn').disabled=true;
  $('#detail-dialog').close();
  $$('.mode-switch button').forEach(b=>{const on=b.id===`${mode}-mode`;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
  $('#source-notice').classList.toggle('live',mode==='live');
  $('#source-text').textContent=mode==='live'?'Live prototype — real sensor data, manually selected checkpoints. All locations are simulated.':'Simulation workspace — 20 synthetic vehicles. All positions and road anomalies are illustrative.';
  $('#prototype-controls').hidden=mode!=='live';
  $('#vehicles-label').textContent=mode==='live'?'Observed devices':'Scenario vehicles';
  $('#vehicles-caption').textContent=mode==='live'?'with recorded passes':'synthetic fleet';
  $('#fleet-btn').hidden=mode!=='simulation';
  $('#map-title').textContent=mode==='live'?'Campus pilot · test route':'Los Angeles · USC area';
  $('#map-subtitle').textContent=mode==='live'?'Three manually selected demo locations':'Illustrative road network';
  $('#route-caption').textContent=mode==='live'?'Toy-car checkpoint mapping':'Illustrative fleet route';
  const path=mode==='live'?'M330 235V298H475V325L475 413H365V415':'M280 153H624V457H750L774 277';
  $('#route-path').setAttribute('d',path); $('#route-shadow').setAttribute('d',path);
  $('#pause-btn').textContent=mode==='live'?'Pause chart':'Replay pass';
  await refresh(true);
}
async function refresh(force=false) {
  if(polling && !force) return;
  polling=true; const generation=modeGeneration;
  try {
    const next=await api(`/api/state?mode=${mode}`);
    if(generation!==modeGeneration) return;
    state=next; $('#server-error').hidden=true; render();
    if(mode==='simulation' && !evidence && state.incidents.length) await choose(state.incidents[0].id,false);
  } catch(e) { $('#server-error').hidden=false; $('#footer-status').textContent='Receiver disconnected · last snapshot'; }
  finally {polling=false;}
}
function render() {
  $('#vehicles').textContent=state.stats.vehicles;
  $('#passes').textContent=state.stats.passes;
  $('#review').textContent=state.stats.review;
  $('#covered').innerHTML=`${state.stats.covered}<small>/ 3</small>`;
  $('#queue-count').textContent=filter==='open'?openRecords().length:state.incidents.length;
  const fresh=!!state.latest && state.server_time-state.latest.last_seen<3;
  const key=JSON.stringify([mode,selected,filter,state.incidents,state.active_pass,fresh]);
  if(key!==renderKey){renderQueue();renderMap();renderKey=key;}
  if(mode==='live') {
    const active=state.active_pass;
    $('#pass-btn').disabled=false;
    $('#checkpoint').disabled=!!active; $('#device-id').disabled=!!active;
    $('#pass-btn').textContent=active?'Finish recording':'Start recording';
    $('#pass-btn').classList.toggle('danger',!!active);$('#pass-btn').classList.toggle('primary',!active);
    $('#pass-status').textContent=active?`Recording pass #${active.id} · ${active.device} · demo location ${active.checkpoint}. Finish recording before changing location.`:'Location is simulated. Start recording to create inspection records. Each recording counts as one vehicle pass.';
    $('#recording-connection').textContent=active?(fresh?'Recording in progress':'Recording active · sensor offline'):fresh?'Sensor connected · recording not started':'Sensor offline · connect your device';
    $('#recording-connection').classList.toggle('connected',fresh);
    $('#prototype-controls').classList.toggle('is-recording',!!active);
    if(!paused && !recordedView) updateChart(state.samples,false);
    const device=state.latest;
    const connected=!!device && state.server_time-device.last_seen<3;
    if(!recordedView){
      $('#chart-title').innerHTML=`Live impact <span class="small-badge">${paused?'Chart paused':connected?'Live sensor':'Waiting for device'}</span>`;
      $('#chart-subtitle').textContent=paused?'Chart paused. Incoming data continues to be recorded.':connected?`${device.id} · ${device.transport==='wifi'?'Wi-Fi':'USB serial'} · original 0.20 g / 0.60 g thresholds`:'Connect the UNO R4 WiFi, or use the USB serial bridge. No synthetic values are shown here.';
      $('#stream-status').textContent=connected?`${device.transport==='wifi'?'Wi-Fi stream':'USB stream'} · ${state.dropped_packets} missing packets`:'No fresh telemetry · road condition unknown';
    }
    if(!paused && !recordedView) {
      $('#reading').textContent=connected?device.impact.toFixed(2):'—';
      $('#reading-label').textContent='Current impact';
      $('#led-state').textContent=!connected?'Device offline':device.level===2?'High impact · review':device.level===1?'Moderate impact':'Below threshold';
      $('#led-state').className=`status-label ${!connected?'gray':device.level===0?'green':device.level===1?'amber':''}`;
      $('#reading-note').textContent='LED state includes the original 1.5 s hold. No signal is not proof of a safe road.';
    }
  }
  $('#footer-status').textContent='Saved on this computer · simulated location';
  if($('#setup-dialog').open) renderDevices();
}
function renderQueue() {
  const items=filter==='open'?openRecords():state.incidents;
  const fresh=!!state.latest && state.server_time-state.latest.last_seen<3;
  let emptyTitle='No open observations',emptyCopy='Use All records to review completed or dismissed observations.';
  if(mode==='live' && state.incidents.length===0){
    emptyTitle=state.active_pass?(fresh?'Recording your observation':'Recording active · sensor offline'):fresh?'Ready to record':'Connect your sensor';
    emptyCopy=state.active_pass?(fresh?'No above-threshold observations yet. An impact over 0.20 g creates a review candidate.':'Reconnect the sensor to continue receiving evidence, or finish this recording.'):
      fresh?'Choose a demo location and press Start recording above the map. Live readings alone do not create inspection records.':'Connect the device, choose a demo location, and start recording to create your first inspection record.';
  }
  setHTML($('#queue'),items.length?items.map(i=>`<button class="queue-item ${selected===i.id?'selected':''}" data-incident="${i.id}"><div class="queue-item-top"><span class="impact-tag ${i.peak<=.6?'moderate':''}"><i class="dot ${i.peak>.6?'high':'moderate'}"></i>${esc(i.priority)}</span><time>${new Date(i.updated*1000).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</time></div><h3>${esc(i.location.name)} <span aria-hidden="true">↗</span></h3><p class="road">${esc(i.location.owner)}</p><div class="queue-meta"><span>${i.vehicles} vehicle${i.vehicles!==1?'s':''}</span><span>·</span><span>${i.abnormal_passes} abnormal pass${i.abnormal_passes!==1?'es':''}</span><span class="status-chip ${i.status==='Needs review'?'review':i.status==='Inspection assigned'?'assigned':''}">${esc(i.status)}</span></div></button>`).join(''):`<div class="empty-state"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 33h8l6-19 8 25 6-15h8M6 8v34h36"/></svg><h3>${esc(emptyTitle)}</h3><p>${esc(emptyCopy)}</p></div>`);
}
function renderMap() {
  const pins=state.checkpoints.map(cp=>{
    const candidates=state.incidents.filter(i=>i.checkpoint===cp.id && !['Dismissed','Repair completed'].includes(i.status));
    const incident=candidates[0] || state.incidents.find(i=>i.checkpoint===cp.id);
    const isSelected=incident && selected===incident.id;
    const color=candidates.length?colorFor(candidates[0].peak):colors.gray;
    return `<g class="map-pin" role="button" tabindex="0" aria-label="Checkpoint ${cp.id}, ${esc(cp.name)}${incident?', open observation':', no anomaly recorded'}" data-checkpoint="${cp.id}" transform="translate(${cp.x} ${cp.y})">${isSelected?`<circle r="34" fill="${color}" opacity=".10"/><circle r="27" fill="none" stroke="${color}" stroke-opacity=".2"/>`:''}<circle r="19" fill="${color}" stroke="white" stroke-width="4" filter="url(#pin-shadow)"/><text text-anchor="middle" y="5">${cp.id}</text></g>`;
  }).join('');
  setHTML($('#map-pins'),pins);
  const active=state.active_pass;
  $('#car-dot').hidden=mode!=='live'||!active;
  if(mode==='live'&&active){const cp=state.checkpoints.find(c=>c.id===active.checkpoint);$('#car-dot').setAttribute('transform',`translate(${cp.x+32} ${cp.y+25})`);}
}
function chartMarkup(samples,width=1000,height=190,compact=false) {
  const left=compact?9:43,right=compact?9:15,top=12,bottom=compact?10:30;
  const points=samples.filter(s=>Number.isFinite(s.impact)&&Number.isFinite(s.received));
  const max=Math.max(1.2,...points.map(s=>s.impact*1.15));
  const ymin=top,ymax=height-bottom;
  const y=v=>ymax-v/max*(ymax-ymin);
  const start=points.length?points[0].received:0;
  const end=points.length?points[points.length-1].received:20;
  const duration=Math.max(end-start,.05);
  const x=t=>left+(t-start)/duration*(width-left-right);
  let out='';
  if(!compact) for(const v of [0,.4,.8,1.2]) out+=`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="#edf1f5"/><text x="${left-10}" y="${y(v)+4}" fill="#93a0b0" text-anchor="end" font-size="11">${v.toFixed(1)}</text>`;
  for(const [v,c] of [[.2,'#c7923f'],[.6,'#ce7770']]) out+=`<line x1="${left}" y1="${y(v)}" x2="${width-right}" y2="${y(v)}" stroke="${c}" stroke-width="1" stroke-dasharray="5 6" opacity=".7"/>`;
  let line='';
  points.forEach((s,i)=>{const gap=i && (s.received-points[i-1].received>.4 || s.received<points[i-1].received);line+=`${i===0||gap?'M':'L'}${x(s.received).toFixed(1)},${y(s.impact).toFixed(1)} `;});
  if(line) out+=`<path d="${line}" fill="none" stroke="#315c97" stroke-width="${compact?1.8:2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if(!compact){for(let i=0;i<=5;i++)out+=`<text x="${left+i/5*(width-left-right)}" y="${height-8}" text-anchor="middle" fill="#93a0b0" font-size="11">${(i/5*duration).toFixed(1)}s</text>`;}
  return out;
}
function updateChart(samples,isEvidence) {
  $('#chart').innerHTML=chartMarkup(samples);
  $('#chart-empty').hidden=samples.length>0;
  $('#chart-empty').textContent=mode==='live'?'Waiting for real sensor data':'Select an observation to view its waveform';
  if(isEvidence && evidence) {
    $('#chart-title').innerHTML=`Impact evidence <span class="small-badge">${evidence.mode==='live'?'Recorded sensor pass':'Synthetic recording'}</span>`;
    $('#chart-subtitle').textContent=`${evidence.location.name} · strongest recorded pass · ${evidence.passes[0].device}`;
    $('#reading-label').textContent='Peak impact';
    $('#reading').textContent=evidence.peak.toFixed(2);
    $('#led-state').textContent=evidence.priority;
    $('#led-state').className=`status-label ${evidence.peak<=.6?'amber':''}`;
    $('#reading-note').textContent=evidence.mode==='live'?'Recorded toy-car signal. Location is simulated.':'Synthetic scenario. An impact is not a confirmed pothole.';
    $('#stream-status').textContent=evidence.mode==='live'?'Recorded evidence · not a live stream':'Synthetic waveform · recorded scenario';
  }
}
async function choose(id,showDetail=true) {
  const generation=modeGeneration;
  try {
    const result=await api(`/api/incidents/${id}`);
    if(generation!==modeGeneration || result.mode!==mode)return;
    selected=id;evidence=result;clearReplay();recordedView=false;$('#pause-btn').textContent=mode==='live'?(paused?'Resume chart':'Pause chart'):'Replay pass';
    renderKey='';render();
    if(mode==='simulation')updateChart(result.samples,true);
    if(showDetail){renderDetail(result);modal('detail-dialog');}
  }catch(e){toast(e.message);}
}
function renderDetail(i) {
  $('#detail-id').textContent=`Observation RR-${String(i.id).padStart(3,'0')}`;
  $('#detail-content').innerHTML=`<span class="impact-tag ${i.peak<=.6?'moderate':''}"><i class="dot ${i.peak>.6?'high':'moderate'}"></i>${esc(i.priority)}</span><h2 class="detail-title">${esc(i.location.name)}</h2><p class="detail-subtitle">${esc(i.location.owner)}<br>Checkpoint ${i.checkpoint} · ${esc(i.location.road)}</p><div class="detail-provenance">${i.mode==='live'?'Real toy-car sensor signal':'Synthetic fleet scenario'} · simulated location<br>No confirmed road defect or measured GPS position.</div><div class="detail-stats"><div><strong>${i.peak.toFixed(2)} <small>g</small></strong><span>Peak impact</span></div><div><strong>${i.vehicles}</strong><span>Distinct vehicles</span></div><div><strong>${i.abnormal_passes}<small> / ${i.total_passes}</small></strong><span>Abnormal / all passes</span></div></div><section class="detail-section"><h3>Recorded evidence</h3><svg class="detail-wave" viewBox="0 0 460 105" role="img" aria-label="Strongest pass impact waveform">${chartMarkup(i.samples,460,105,true)}</svg><p>Strongest pass: ${esc(i.passes[0].device)} · ${i.samples.length} displayed samples. Multiple samples from one pass count as one observation.</p><p class="fine-print">Priority is a transparent impact threshold, not an AI probability. Check bumps, joints and mounting before classifying a pothole.</p></section><section class="detail-section"><h3>Coordinate an inspection</h3><p>Responsible organization: <strong>${esc(i.location.owner)}</strong></p><form id="inspection-form"><div class="form-row"><label>Assigned team<select id="assignee"><option value="">Not assigned</option><option>Campus inspection team</option><option>Municipal inspection crew</option><option>State highway inspection crew</option><option>Maintenance contractor</option></select></label><label>Status<select id="incident-status">${[i.status,...i.allowed_statuses].map(s=>`<option${s===i.status?' selected':''}>${esc(s)}</option>`).join('')}</select></label></div><label>Inspection / completion note<textarea id="incident-note" maxlength="1500" placeholder="Record the human inspection decision…">${esc(i.note)}</textarea></label><div class="form-actions"><button type="submit" class="button primary">Save update</button><span class="fine-print">Local record only</span></div></form><p class="fine-print">Demo team names. No notification or work order is sent to an external agency. A human must confirm a repair before recheck.</p></section><section class="detail-section"><h3>Inspection brief</h3><p>Summarize this record for the coordinator. You approve the next step.</p><div class="brief-buttons"><button class="button primary" id="ai-brief" ${state.ai_available?'':'disabled'}>✧ Generate AI brief</button><button class="button" id="rule-brief">Rule-based summary</button></div><p class="fine-print">${state.ai_available?'Uses the configured model. Only this observation and its notes are sent when you click.':'AI unavailable: configure OPENAI_API_KEY and OPENAI_MODEL in .env. The rule-based summary works offline.'}</p><div id="brief-result">${i.brief?`<div class="brief-kind">${esc(i.brief_type)}</div><div class="brief-text">${esc(i.brief)}</div>`:''}</div></section><section class="detail-section"><h3>Activity</h3><ul class="timeline">${i.audit.map(a=>`<li><time>${date(a.at)}</time>${esc(a.message)}</li>`).join('')}</ul></section>`;
  const assignee=$('#assignee');
  if(i.assignee && ![...assignee.options].some(o=>o.value===i.assignee)){const opt=new Option(i.assignee,i.assignee);assignee.add(opt);}
  assignee.value=i.assignee;
  $('#inspection-form').addEventListener('submit',async e=>{
    e.preventDefault();const button=e.submitter;button.disabled=true;
    try{const result=await api(`/api/incidents/${i.id}`,{status:$('#incident-status').value,assignee:$('#assignee').value,note:$('#incident-note').value});renderDetail(result);await refresh(true);toast('Update saved locally. No external dispatch was sent.');}
    catch(err){toast(err.message);button.disabled=false;}
  });
  $('#ai-brief').addEventListener('click',()=>generateBrief(i.id,true));
  $('#rule-brief').addEventListener('click',()=>generateBrief(i.id,false));
  const replay=document.createElement('button');replay.className='button';replay.textContent='Replay this pass';
  $('.detail-wave').after(replay);
  replay.addEventListener('click',()=>{evidence=i;$('#detail-dialog').close();startReplay();$('.signal-panel').scrollIntoView({behavior:'smooth',block:'center'});});
}
async function generateBrief(id,ai){
  const b=$(ai?'#ai-brief':'#rule-brief');b.disabled=true;const old=b.textContent;b.textContent=ai?'Drafting…':'Summarizing…';
  try{const data=await api(`/api/incidents/${id}/brief`,{ai});if(selected===id && $('#detail-dialog').open)$('#brief-result').innerHTML=`<div class="brief-kind">${esc(data.kind)}</div><div class="brief-text">${esc(data.text)}</div>`;}
  catch(e){toast(e.message);}finally{if(b.isConnected){b.disabled=false;b.textContent=old;}}
}
function renderDevices(){
  const rows=(state?.devices||[]).map(d=>`<div>${esc(d.id)} · ${esc(d.transport)} · ${Date.now()/1000-d.last_seen<3?'Receiving data':'Offline'} · last seen ${date(d.last_seen)}</div>`);
  $('#device-list').innerHTML=rows.join('')||'No sensor connected yet. The live workspace stays empty until real telemetry arrives.';
}
async function showSetup(){
  modal('setup-dialog');renderDevices();
  try{const config=await api('/api/setup');receiverToken=config.token;$('#receiver-token').textContent=config.token;$('#udp-status').textContent=`UDP port ${config.udp_port} · Receiver: ${state?.udp_status||'Checking'}`;}
  catch(e){$('#receiver-token').textContent='Receiver unavailable';toast(e.message);}
}
$('#simulation-mode').addEventListener('click',()=>setMode('simulation'));
$('#live-mode').addEventListener('click',()=>setMode('live'));
$('#queue').addEventListener('click',e=>{const row=e.target.closest('[data-incident]');if(row)choose(Number(row.dataset.incident));});
function selectPin(target){const node=target.closest('[data-checkpoint]');if(!node)return;const cp=node.dataset.checkpoint;const incident=state.incidents.find(i=>i.checkpoint===cp);if(incident)choose(incident.id);else {if(mode==='live'&&!state.active_pass){$('#checkpoint').value=cp;toast(`Checkpoint ${cp} selected. Press Start recording before rolling the toy car.`);}else toast(`Checkpoint ${cp}: no anomaly recorded.`);}}
$('#map-pins').addEventListener('click',e=>selectPin(e.target));
$('#map-pins').addEventListener('keydown',e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();selectPin(e.target);}});
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderKey='';render();}));
$('#refresh-btn').addEventListener('click',async()=>{await refresh(true);toast('Queue refreshed.');});
$('#connect-btn').addEventListener('click',showSetup);
$('#guide-btn').addEventListener('click',()=>modal('guide-dialog'));
$('#sources-btn').addEventListener('click',()=>modal('sources-dialog'));
$('#close-detail').addEventListener('click',()=>$('#detail-dialog').close());
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>$(`#${b.dataset.close}`).close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#copy-token').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(receiverToken);toast('Receiver token copied. Paste it into arduino_secrets.h.');}catch{toast('Select and copy the receiver token manually.');}});
$('#pass-btn').addEventListener('click',async()=>{
  const b=$('#pass-btn');b.disabled=true;
  try{
    if(state.active_pass){await api('/api/passes/stop',{});toast('Pass finished. Saved observations remain in the queue.');}
    else {const device=$('#device-id').value.trim();const connected=state.devices.find(d=>d.id===device && state.server_time-d.last_seen<3);if(!connected){toast(`No fresh data from ${device}. Connect the device before starting a pass.`);return;}await api('/api/passes/start',{checkpoint:$('#checkpoint').value,device});toast('Recording. Roll the toy car through the selected checkpoint.');}
    await refresh(true);
  }catch(e){toast(e.message);}finally{b.disabled=false;}
});
$('#export-btn').addEventListener('click',()=>{const a=document.createElement('a');a.href=`/api/export?mode=${mode}`;a.download=`roadrelay-${mode}-${new Date().toISOString().slice(0,10)}.csv`;a.click();toast(`${mode==='live'?'Live':'Synthetic'} records exported with source labels.`);});
$('#pause-btn').addEventListener('click',()=>{
  if(recordedView && mode==='live'){clearReplay();recordedView=false;paused=false;$('#pause-btn').textContent='Pause chart';render();return;}
  if(mode==='live'){paused=!paused;$('#pause-btn').textContent=paused?'Resume chart':'Pause chart';render();return;}
  if(!evidence)return;
  if(replayTimer){clearReplay();updateChart(evidence.samples,true);$('#pause-btn').textContent='Replay pass';return;}
  startReplay();
});
function startReplay(){
  if(!evidence?.samples?.length)return;
  clearReplay();recordedView=mode==='live';
  const started=performance.now(),first=evidence.samples[0].received;
  $('#pause-btn').textContent=mode==='live'?'Return to live':'Stop replay';
  replayTimer=setInterval(()=>{
    const elapsed=(performance.now()-started)/1000;
    const points=evidence.samples.filter(s=>s.received-first<=elapsed);
    updateChart(points,true);
    $('#chart-title').innerHTML=`Impact evidence <span class="small-badge">Replaying ${evidence.mode==='live'?'recorded sensor pass':'synthetic recording'}</span>`;
    if(points.length===evidence.samples.length){clearReplay();if(mode==='simulation')$('#pause-btn').textContent='Replay pass';}
  },60);
}
function applyZoom(){const dx=450*(1-zoom),dy=278*(1-zoom);$('#map-world').setAttribute('transform',`translate(${dx} ${dy}) scale(${zoom})`);}
$('#zoom-in').addEventListener('click',()=>{zoom=Math.min(2,zoom+.2);applyZoom();});
$('#zoom-out').addEventListener('click',()=>{zoom=Math.max(.8,zoom-.2);applyZoom();});
$('#zoom-reset').addEventListener('click',()=>{zoom=1;applyZoom();});
$('#fleet-btn').addEventListener('click',()=>{
  $('#fleet-list').innerHTML=`<table class="fleet-table"><thead><tr><th>Vehicle</th><th>Passes</th><th>Abnormal checkpoints</th><th>Source</th></tr></thead><tbody>${Array.from({length:20},(_,idx)=>{const v=idx+1;return `<tr><td>FLEET-${String(v).padStart(2,'0')}</td><td>3</td><td>${[v<=3?'A':null,v<=7?'B':null,v<=4?'C':null].filter(Boolean).join(', ')||'None'}</td><td>Synthetic</td></tr>`;}).join('')}</tbody></table>`;
  modal('fleet-dialog');
});
// Optional WebMCP: the same visible source selection and read-only queue, no hidden dispatch.
if(document.modelContext?.registerTool){
  for(const tool of [
    {name:'roadrelay_read_queue',description:'Read observations in the currently visible RoadRelay workspace. Locations are simulated.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:async()=>{await refresh(true);return {mode,observations:state?.incidents||[]};}},
    {name:'roadrelay_select_workspace',description:'Switch the visible workspace between live hardware and the explicitly synthetic fleet simulation.',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['live','simulation']}},required:['mode'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async input=>{if(!input||!['live','simulation'].includes(input.mode))throw new Error('Invalid mode');await setMode(input.mode);return {mode};}}
  ]){try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch{}}
}
refresh(true);setInterval(()=>refresh(),600);
