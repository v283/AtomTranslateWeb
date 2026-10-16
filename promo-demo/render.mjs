import { chromium } from 'playwright';
import fs from 'fs';
const [,, fmt, lang, fps, outDir, from, to] = process.argv;
const W = fmt==='16x9'?1920:1080, H = fmt==='16x9'?1080:1920;
fs.mkdirSync(outDir,{recursive:true});
const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',args:['--no-sandbox']});
const p = await b.newPage({viewport:{width:W,height:H}});
p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+process.cwd()+`/video.html?fmt=${fmt}&lang=${lang}`,{waitUntil:'domcontentloaded'});
await p.waitForSelector('body[data-ready="1"]',{timeout:20000});
const total = await p.evaluate(()=>window.VID.total);
const N = Math.ceil(total*(+fps));
const a = +from||0, z = Math.min(+to||N, N);
const t0=Date.now();
for (let i=a;i<z;i++){
  await p.evaluate(async t=>{window.VID.M.time(t,false); await window.AtomDemo.ready();}, i/(+fps));
  await p.screenshot({path:`${outDir}/f${String(i).padStart(5,'0')}.jpg`,type:'jpeg',quality:93});
  if ((i-a)%100===0) console.log(`chunk ${a}-${z}: ${i-a}/${z-a} ${((Date.now()-t0)/1000).toFixed(0)}s`);
}
console.log('done',a,z,((Date.now()-t0)/1000).toFixed(0)+'s');
await b.close();
