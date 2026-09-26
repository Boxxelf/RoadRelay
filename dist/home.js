'use strict';
const canvas = document.querySelector('#globe');
const ctx = canvas.getContext('2d');
const motionButton = document.querySelector('#motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches, visible = true, frame = 0, width = 0, height = 0, phase = 0, previousTime = 0, pixelRatio = 0;
const backdrop = document.createElement('canvas');
const background = backdrop.getContext('2d');
const compact = window.matchMedia('(max-width: 760px), (max-width: 1024px) and (max-height: 500px)');
// Coarse, original continent outlines form an illustrative network, not a GIS map.
const continents = [
  [[-168,68],[-137,72],[-113,62],[-89,54],[-60,49],[-80,25],[-100,17],[-121,34],[-134,55]],
  [[-82,12],[-66,8],[-48,-1],[-35,-10],[-50,-34],[-69,-56],[-77,-24]],
  [[-18,35],[4,38],[29,31],[43,12],[34,-28],[19,-35],[5,-4],[-16,14]],
  [[-11,36],[-9,57],[28,72],[59,66],[97,77],[151,62],[174,51],[141,31],[111,19],[108,-6],[79,9],[69,29],[42,37],[29,30],[10,43]],
  [[113,-12],[136,-10],[154,-24],[148,-39],[121,-33]],
  [[-54,60],[-25,72],[-40,82],[-61,77]], [[46,-13],[50,-17],[48,-25],[44,-24]],
  [[131,32],[144,43],[146,35],[137,29]], [[166,-34],[179,-40],[170,-48],[164,-44]]
];
function inside(x,y,poly) { let on=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(((a[1]>y)!==(b[1]>y)) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])on=!on;}return on; }
const points=[];
for(let lat=-66;lat<80;lat+=2.25)for(let lon=-180;lon<180;lon+=2.7/Math.max(.3,Math.cos(lat*Math.PI/180))){
  if(continents.some(p=>inside(lon,lat,p))){const a=lon*Math.PI/180,b=lat*Math.PI/180;points.push([Math.cos(b)*Math.sin(a),-Math.sin(b),Math.cos(b)*Math.cos(a)]);}
}
function position(lon,lat,rotation,radius,cx,cy) {
  const a=(lon+rotation)*Math.PI/180,b=lat*Math.PI/180;
  const x=Math.cos(b)*Math.sin(a), y=-Math.sin(b), z=Math.cos(b)*Math.cos(a);
  return {x:cx+x*radius,y:cy+(y*.97+z*.16)*radius,z};
}
function geometry(){return {r:Math.min(width*.455,height*.425),cx:width*(compact.matches ? .5 : .54),cy:height*.49};}
// Cache the expensive gradients. Scrolling and rotating only repaint the network.
function drawBackdrop() {
  if(!background || !width)return;
  const ctx=background,{r,cx,cy}=geometry();
  ctx.clearRect(0,0,width,height);
  const glow=ctx.createRadialGradient(cx,cy,r*.8,cx,cy,r*1.2);glow.addColorStop(0,'#0000');glow.addColorStop(.58,'#234dff1a');glow.addColorStop(.75,'#345dff45');glow.addColorStop(1,'#234dff00');
  ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  const body=ctx.createRadialGradient(cx-r*.2,cy-r*.35,r*.1,cx,cy,r);body.addColorStop(0,'#080b12');body.addColorStop(.72,'#060a13');body.addColorStop(.93,'#102657');body.addColorStop(1,'#274ded');
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=body;ctx.fill();
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
  const topGlow=ctx.createRadialGradient(cx+r*.15,cy-r*.93,0,cx+r*.15,cy-r*.93,r*.85);topGlow.addColorStop(0,'#ee885258');topGlow.addColorStop(1,'#ee885200');ctx.fillStyle=topGlow;ctx.fillRect(cx-r,cy-r,r*2,r*2);
  ctx.restore();
}
function draw() {
  if(!ctx || !width || !height)return;
  const {r,cx,cy}=geometry();
  ctx.clearRect(0,0,width,height);
  ctx.drawImage(backdrop,0,0,width,height);
  ctx.save();ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.clip();
  const rotation=100+phase*3,angle=rotation*Math.PI/180,sin=Math.sin(angle),cos=Math.cos(angle);
  const dots=Array.from({length:8},()=>[]);
  for(const [px,py,pz] of points){const z=pz*cos-px*sin;if(z<0)continue;dots[Math.min(7,Math.floor(z*8))].push([cx+(px*cos+pz*sin)*r,cy+(py*.97+z*.16)*r,z]);}
  dots.forEach((bucket,i)=>{ctx.fillStyle=`rgba(190,205,234,${.2+i*.08})`;ctx.beginPath();for(const [x,y,z] of bucket){const size=Math.max(.7,r*.0022)*(z*.3+.7);ctx.moveTo(x+size,y);ctx.arc(x,y,size,0,Math.PI*2);}ctx.fill();});
  // Subtle longitude and latitude geometry across the network sphere.
  ctx.strokeStyle='#94acdb13';ctx.lineWidth=.7;
  for(let lon=-180;lon<180;lon+=30){ctx.beginPath();let started=false;for(let lat=-85;lat<=85;lat+=3){const p=position(lon,lat,rotation,r,cx,cy);if(p.z<0){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();}
  for(let lat=-60;lat<=60;lat+=30){ctx.beginPath();let started=false;for(let lon=-180;lon<=180;lon+=3){const p=position(lon,lat,rotation,r,cx,cy);if(p.z<0){started=false;continue;}if(!started){ctx.moveTo(p.x,p.y);started=true;}else ctx.lineTo(p.x,p.y);}ctx.stroke();}
  const locations=[[-118,34,'LOS ANGELES'],[-122,47,''],[-74,41,''],[-99,20,''],[-46,-23,'']];
  const origin=position(...locations[0].slice(0,2),rotation,r,cx,cy);
  for(let i=1;i<locations.length;i++){
    const p=position(...locations[i].slice(0,2),rotation,r,cx,cy);if(origin.z<0 || p.z<0)continue;
    const mx=(origin.x+p.x)/2,my=Math.min(origin.y,p.y)-r*.19;
    ctx.beginPath();ctx.moveTo(origin.x,origin.y);ctx.quadraticCurveTo(mx,my,p.x,p.y);ctx.strokeStyle='#ed8b5288';ctx.lineWidth=1;ctx.stroke();
    const t=(phase*.13+i*.23)%1,q=1-t;ctx.beginPath();ctx.arc(q*q*origin.x+2*q*t*mx+t*t*p.x,q*q*origin.y+2*q*t*my+t*t*p.y,2.1,0,Math.PI*2);ctx.fillStyle='#ffc091';ctx.fill();
  }
  locations.forEach(([lon,lat,label])=>{const p=position(lon,lat,rotation,r,cx,cy);if(p.z<0)return;ctx.beginPath();ctx.arc(p.x,p.y,label?3.5:2.3,0,Math.PI*2);ctx.fillStyle='#fb9960';ctx.fill();if(label){ctx.fillStyle='#111820e8';ctx.fillRect(p.x+11,p.y-11,93,22);ctx.font='9px Arial';ctx.fillStyle='#dae1ef';ctx.fillText(label,p.x+18,p.y+3);}});
  ctx.restore();
  ctx.beginPath();ctx.ellipse(cx,cy,r*1.055,r*.26,-.43,Math.PI,Math.PI*2);ctx.strokeStyle='#eb965977';ctx.lineWidth=.9;ctx.stroke();
}
function tick(time){frame=0;if(motionPaused||!visible||document.hidden||!ctx)return;const elapsed=previousTime?time-previousTime:0;if(!previousTime||elapsed>=(compact.matches?1000/30:1000/60)-1){if(previousTime)phase+=Math.min(elapsed/1000,.1);previousTime=time;draw();}frame=requestAnimationFrame(tick);}
function schedule(){if(ctx&&!frame&&!motionPaused&&visible&&!document.hidden){previousTime=0;frame=requestAnimationFrame(tick);}}
function resize(){const bounds=canvas.getBoundingClientRect(),w=Math.round(bounds.width),h=Math.round(bounds.height),dpr=Math.min(window.devicePixelRatio||1,compact.matches?1.5:2);if(w===width&&h===height&&pixelRatio===dpr)return;width=w;height=h;pixelRatio=dpr;canvas.width=backdrop.width=Math.round(width*dpr);canvas.height=backdrop.height=Math.round(height*dpr);ctx?.setTransform(dpr,0,0,dpr,0,0);background?.setTransform(dpr,0,0,dpr,0,0);drawBackdrop();draw();}
function syncMotion(){motionButton.textContent=motionPaused?'Play motion':'Pause motion';motionButton.setAttribute('aria-pressed',String(motionPaused));document.documentElement.classList.toggle('motion-paused',motionPaused);if(motionPaused){cancelAnimationFrame(frame);frame=0;draw();}else schedule();}
motionButton.addEventListener('click',()=>{motionPaused=!motionPaused;syncMotion();});
reducedMotion.addEventListener('change',e=>{motionPaused=e.matches;syncMotion();});
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)schedule();else{cancelAnimationFrame(frame);frame=0;}},{threshold:0}).observe(canvas);
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else schedule();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=0;});
window.addEventListener('pageshow',()=>{resize();schedule();});
const process=document.querySelector('#process'),truck=document.querySelector('#service-truck'),stages=[...document.querySelectorAll('.stage')],scenePoints=[...document.querySelectorAll('.scene-point')];
let stage=0,lastAutoStage=-1,scrollQueued=false;
function selectStage(next){stage=next;stages.forEach((button,i)=>{button.classList.toggle('active',i===next);button.setAttribute('aria-pressed',String(i===next));scenePoints[i].classList.toggle('lit',i<=next);});const road=document.querySelector('.road-scene');const travel=Math.max(0,road.clientWidth-truck.clientWidth-road.clientWidth*.16);truck.style.transform=`translate(${travel*next/2}px,${-18*next}px)`;}
stages.forEach((button,i)=>button.addEventListener('click',()=>selectStage(i)));
function updateProcess(){if(compact.matches||reducedMotion.matches||motionPaused){selectStage(stage);return;}const rect=process.getBoundingClientRect();const range=Math.max(1,process.offsetHeight-window.innerHeight);const progress=Math.max(0,Math.min(1,-rect.top/range));const next=Math.min(2,Math.floor(progress*3));if(next!==lastAutoStage){lastAutoStage=next;selectStage(next);}}
// Preserve the existing desktop narrative; phones use explicit stage buttons.
function onProcessScroll(){if(!scrollQueued){scrollQueued=true;requestAnimationFrame(()=>{updateProcess();scrollQueued=false;});}}
function syncProcessScroll(){window.removeEventListener('scroll',onProcessScroll);if(!compact.matches)window.addEventListener('scroll',onProcessScroll,{passive:true});}
compact.addEventListener('change',()=>{syncProcessScroll();resize();});
window.addEventListener('resize',()=>{resize();selectStage(stage);updateProcess();});
new ResizeObserver(resize).observe(canvas);
resize();selectStage(0);syncMotion();syncProcessScroll();
