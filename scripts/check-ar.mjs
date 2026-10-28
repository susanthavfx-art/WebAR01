import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:430,height:900}}),page=await context.newPage();
page.on('pageerror',e=>console.log('PAGE ERROR',e.stack));
page.on('console',m=>{if(m.type()==='error')console.log('ERROR',m.text());});
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'Publish & share'}).click();
await page.waitForSelector('#share-link');
const url=await page.locator('#share-link').inputValue();console.log('URL length',url.length);
await page.addInitScript(()=>{
  const streams=[];window.__testStreams=streams;
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{configurable:true,value:async()=>{
    const c=document.createElement('canvas');c.width=960;c.height=720;
    const ctx=c.getContext('2d'),image=new Image();image.src='/markers/space-explorer.jpg';await image.decode();
    const draw=()=>{ctx.fillStyle='#ffffff';ctx.fillRect(0,0,960,720);ctx.drawImage(image,200,80,560,560);};draw();
    const timer=setInterval(draw,42);const stream=c.captureStream(24);stream.getTracks().forEach(t=>t.addEventListener('ended',()=>clearInterval(timer)));streams.push(stream);window.__fakeCanvas=c;return stream;
  }});
});
await page.goto(url);
await page.getByRole('button',{name:'Start AR camera'}).click();
try{
 await page.getByText('Marker found. Hello, wonder!').waitFor({timeout:50000});
 console.log('REAL IMAGE TARGET DETECTED');
 await page.screenshot({path:'tests/ar-tracking.png'});
 await page.getByRole('button',{name:'Stop camera and go back'}).click();
 console.log('TRACK STATES',await page.evaluate(()=>window.__testStreams.map(s=>s.getTracks().map(t=>t.readyState))));
}catch(e){console.log('DETECTION FAILED',e.message);console.log(await page.locator('body').innerText());await page.screenshot({path:'tests/ar-failed.png'});}
await browser.close();
