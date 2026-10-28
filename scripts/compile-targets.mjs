import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const page=await browser.newPage();
page.on('pageerror', e=>console.log('ERROR:',e.message));
page.on('console', m=>{if(m.type()==='error')console.log(m.text())});
await page.goto('http://127.0.0.1:5173/scripts/compile-targets.html');
await page.waitForFunction(()=>window.compilerReady);
for(const id of ['space-explorer','forest-friends']) {
 const file=`public/markers/${id}.mind`;
 const data=await page.evaluate(async id=>await window.compileMarker(`/markers/${id}.jpg`),id);
 fs.writeFileSync(file,Buffer.from(data));
 console.log('Compiled',id,data.length);
}
await browser.close();
