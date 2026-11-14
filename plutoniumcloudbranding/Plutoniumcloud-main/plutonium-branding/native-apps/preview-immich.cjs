const {chromium}=require('../../plutonium-portal-prototype/node_modules/playwright-core');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const css=await fs.readFile(path.join(__dirname,'immich-plutonium-v1.css'),'utf8');
 assert.doesNotMatch(css,/@import|url\s*\(|display\s*:|visibility\s*:|pointer-events\s*:|filter\s*:/i);
 assert.doesNotMatch(css,/--immich-ui-(danger|warning|success|info)-/);
 const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--host-resolver-rules=MAP photos.plutoniumcloud.com 192.168.8.153']});
 try{
  await fs.mkdir(path.join(__dirname,'artifacts'),{recursive:true});
  for(const scheme of ['dark','light']){
   const context=await browser.newContext({colorScheme:scheme,viewport:{width:1440,height:1000}});
   // Browser-memory substitution only; no application setting or credential is written.
   await context.route('https://photos.plutoniumcloud.com/custom.css',r=>r.fulfill({status:200,contentType:'text/css',body:css}));
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://photos.plutoniumcloud.com/auth/login',{waitUntil:'networkidle'});
   await page.locator('input[type=password]').waitFor({state:'visible'});
   const buttons=await page.getByRole('button').allTextContents();assert(buttons.some(x=>/login|sign in/i.test(x)));
   for(const [name,size] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}]]){
    await page.setViewportSize(size);await page.waitForFunction(()=>document.documentElement.scrollWidth<=innerWidth);
    const result=await page.evaluate(()=>{const s=getComputedStyle(document.documentElement);return {dark:document.documentElement.classList.contains('dark'),primary:s.getPropertyValue('--immich-ui-primary-500').trim(),font:getComputedStyle(document.body).fontFamily,inputs:[...document.querySelectorAll('input')].filter(e=>e.type!=='hidden').map(e=>({type:e.type,visible:e.getBoundingClientRect().width>0})),overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(result.overflow,false);assert(result.inputs.filter(x=>['text','email','password'].includes(x.type)).every(x=>x.visible));assert(['#323232','#e5e5e5'].includes(result.primary));assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(__dirname,'artifacts/immich-'+scheme+'-'+name+'.png'),fullPage:true});
    console.log(JSON.stringify({scheme,viewport:name,...result}));
   }
   await context.close();
  }
  console.log('Native Immich public-login palette preview passed. No form submitted, settings saved, credentials used or photo library inspected. Logged-in views and Safari remain user acceptance checks.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
