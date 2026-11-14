const {chromium}=require('../../plutonium-portal-prototype/node_modules/playwright-core');
const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');
(async()=>{
 const css=await fs.readFile(path.join(__dirname,'immich-plutonium-v2.css'),'utf8');
 assert.doesNotMatch(css,/@import|display\s*:|visibility\s*:|pointer-events\s*:|filter\s*:/i);
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
    assert.equal(result.overflow,false);assert(result.inputs.filter(x=>['text','email','password'].includes(x.type)).every(x=>x.visible));assert(['#323232','#e5e5e5'].includes(result.primary));assert.deepEqual(errors,[]);assert.equal(await page.locator('img[alt="Immich logo"][draggable="false"]').evaluate(e=>getComputedStyle(e).content.includes('data:image/svg+xml')),true);
    await page.screenshot({path:path.join(__dirname,'artifacts/immich-branding-v2-'+scheme+'-'+name+'.png'),fullPage:true});
    console.log(JSON.stringify({scheme,viewport:name,...result}));
   }
   // Source-reviewed native Logo header variants, isolated fixture only (no signed-in user).
   await page.evaluate(()=>{const box=document.createElement('div');box.id='logo-header-fixture';Object.assign(box.style,{position:'fixed',top:'0',left:'0',right:'0',height:'64px',padding:'8px',background:document.documentElement.classList.contains('dark')?'#151515':'white',zIndex:99999,display:'flex',gap:'24px'});for(const kind of ['inline','icon']){const a=document.createElement('a');a.href='/photos';a.dataset.variant=kind;const image=document.createElement('img');image.alt='Immich logo';image.draggable=false;image.className='h-12'+(kind==='icon'?' aspect-square':'');image.src=document.querySelector('img[alt="Immich logo"]').src;a.append(image);box.append(a);}document.body.append(box);});
   const full=page.locator('#logo-header-fixture [data-variant=inline] img');const compact=page.locator('#logo-header-fixture [data-variant=icon] img');
   assert.equal(await full.evaluate(e=>getComputedStyle(e).content.includes('PLUTONIUM%20%2F%20PHOTOS')),true);
   assert.equal(Math.round((await compact.boundingBox()).width),48);assert((await full.boundingBox()).width<300);
   await page.locator('#logo-header-fixture a').first().focus();assert.equal(await page.evaluate(()=>document.activeElement.dataset.variant),'inline');
   await page.locator('#logo-header-fixture').screenshot({path:path.join(__dirname,'artifacts/immich-branding-v2-'+scheme+'-header-fixture.png')});
   await context.close();
  }
  console.log('Native Immich PUBLIC login logo preview passed. Signed-in header is not an authenticated browser test. No form submitted, settings saved, credentials used or photo library inspected. Logged-in views and Safari remain user acceptance checks.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
