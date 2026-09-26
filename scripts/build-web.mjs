import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'public');
await fs.mkdir(path.join(out,'dashboard'),{recursive:true});
// Publish only these public assets. Never copy a source directory recursively.
for(const file of ['home.css','home.js','service-vehicle.svg','app.js','styles.css','dashboard.css','favicon.svg','hosted-demo.js','demo-data.json']){
  await fs.copyFile(path.join(root,'dist',file),path.join(out,file));
}
await fs.copyFile(path.join(root,'dist/home.html'),path.join(out,'index.html'));
let dashboard=await fs.readFile(path.join(root,'dist/index.html'),'utf8');
dashboard=dashboard.replace('<script src="/app.js" defer></script>','<script src="/hosted-demo.js" defer></script><script src="/app.js" defer></script>');
dashboard=dashboard.replace('Local workspace','Hosted demo').replace('Simulation workspace — 20 synthetic vehicles. All positions and road anomalies are illustrative.','Hosted simulation — 20 synthetic vehicles. Changes stay in this browser. Real sensor input uses the local application.');
await fs.writeFile(path.join(out,'dashboard/index.html'),dashboard);
const app=(await fs.readFile(path.join(out,'app.js'),'utf8')).replace('AI unavailable: configure OPENAI_API_KEY and OPENAI_MODEL in .env. The rule-based summary works offline.','AI is unavailable in the hosted demo. Use the configured local application for AI. The rule-based summary works here.');
await fs.writeFile(path.join(out,'app.js'),app);
console.log('Built public homepage and isolated browser-local demo. No credentials or hardware data included.');
