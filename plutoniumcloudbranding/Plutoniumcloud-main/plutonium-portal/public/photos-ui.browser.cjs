'use strict';
// All documents and identity/media fixtures are fulfilled in memory. No server runs.
const fs=require('node:fs/promises'),path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const origin='http://127.0.0.1:8795';
const output=process.argv[2]||path.resolve(__dirname,'../../artifacts/photos-ui');
let assertions=0,scenarios=0;
const equal=(a,b)=>{assert.equal(a,b);assertions++;};
const ok=value=>{assert.ok(value);assertions++;};
(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({executablePath:process.env.PC_CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
  const forbidden=[],errors=[],requests=[],loads={photos:0};
  async function context(options={}){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',...options});
    await ctx.addInitScript(()=>{
      window.appearanceFrames=0;const put=CanvasRenderingContext2D.prototype.putImageData;
      CanvasRenderingContext2D.prototype.putImageData=function(...args){if(this.canvas.id==='appearance-atom')window.appearanceFrames++;return put.apply(this,args);};
    });
    await ctx.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());requests.push({method:req.method(),origin:url.origin,path:url.pathname});
      if(req.method()!=='GET'||/plex|\/api\/settings|\/launch\//i.test(req.url())){forbidden.push(req.url());return route.abort();}
      if(url.origin==='https://photos.plutoniumcloud.com'&&url.pathname==='/photos'){
        loads.photos++;return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic Photos</title><h1>Synthetic Photos</h1><label>Draft<input aria-label="Draft"></label>'});
      }
      if(url.origin!==origin){forbidden.push(req.url());return route.abort();}
      if(url.pathname==='/api/me')return route.fulfill({contentType:'application/json',body:JSON.stringify({user:{subject:'appearance-fixture',username:'fixture',name:'Fixture member'},apps:[
        {id:'photos',name:'Photos',service:'Immich',description:'Your memories',group:'personal',enabled:true,presentation:'embedded',embedUrl:'https://photos.plutoniumcloud.com/photos',launchPath:'/launch/photos',state:'Connected'},
        {id:'plex',name:'Cinema',service:'Plex',description:'Unavailable',group:'personal',enabled:false,state:'Not assigned'}
      ]})});
      const names={'/desktop':'desktop.html','/app.js':'app.js','/styles.css':'styles.css','/mark.svg':'mark.svg','/desktop-window.mjs':'desktop-window.mjs','/window-model.mjs':'window-model.mjs'};
      if(!names[url.pathname]){forbidden.push(req.url());return route.abort();}
      const extension=path.extname(names[url.pathname]);
      return route.fulfill({contentType:extension==='.html'?'text/html':extension==='.css'?'text/css':extension==='.svg'?'image/svg+xml':'text/javascript',
        headers:{'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://photos.plutoniumcloud.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"},
        body:await fs.readFile(path.join(__dirname,names[url.pathname]))});
    });
    return ctx;
  }
  async function ready(ctx){const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/desktop');await page.waitForFunction(()=>document.querySelector('#greeting-name').textContent==='Fixture member');return page;}
  try{
    const ctx=await context(),page=await ready(ctx);
    await page.waitForFunction(()=>!document.querySelector('#appearance-atom').hidden&&window.appearanceFrames>1);
    ok(await page.locator('#appearance-atom').evaluate(el=>{const p=el.getContext('2d').getImageData(0,0,el.width,el.height).data;return p.some((v,i)=>i%4===3&&v>0);}));
    equal(await page.locator('.appearance-atom svg').isVisible(),false);
    await page.screenshot({path:path.join(output,'desktop.png')});scenarios++;
    equal(await page.locator('#appearance-toolbar').count(),0);equal(await page.locator('#appearance-open').count(),1);
    equal(await page.locator('#account-dialog #aero-cursor-enabled').count(),0);
    equal(await page.locator('#appearance-dialog #aero-cursor-enabled').count(),1);
    equal(await page.locator('[name=grain],[name=reducedMotion]').count(),0);
    const canvasSize=await page.locator('#appearance-atom').evaluate(el=>({w:el.width,h:el.height}));ok(canvasSize.w<=330&&canvasSize.h<=270);
    const startFrames=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(550);ok((await page.evaluate(()=>window.appearanceFrames))-startFrames<=12);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(70);const blurFrames=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(150);equal(await page.evaluate(()=>window.appearanceFrames),blurFrames);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(70);const hiddenFrames=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(150);equal(await page.evaluate(()=>window.appearanceFrames),hiddenFrames);
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});


    await page.locator('#appearance-open').focus();await page.keyboard.press('Enter');
    equal(await page.locator('#appearance-dialog').evaluate(el=>el.open),true);
    await page.keyboard.press('Control+k');equal(await page.locator('#appearance-dialog').evaluate(el=>el.contains(document.activeElement)),true);
    for(let i=0;i<18;i++)await page.keyboard.press('Tab');
    equal(await page.locator('#appearance-dialog').evaluate(el=>el.contains(document.activeElement)),true);
    await page.keyboard.press('Escape');equal(await page.locator('#appearance-open').evaluate(el=>el===document.activeElement),true);scenarios++;
    await page.locator('#appearance-open').click();const cursor=page.locator('#aero-cursor-enabled');await cursor.uncheck();equal(await page.evaluate(()=>localStorage.getItem('plutonium.cursor.aero.v1')),'false');
    await cursor.focus();await page.keyboard.press('Enter');equal(await cursor.isChecked(),true);await page.keyboard.press('Space');equal(await cursor.isChecked(),false);
    equal(await page.locator('.cursor-switch-track').evaluate(el=>getComputedStyle(el).borderRadius),'999px');
    await page.getByRole('button',{name:'Done',exact:true}).click();


    await page.locator('#appearance-open').click();
    await page.locator('[name=tone]').selectOption('strong');await page.locator('[name=greeting]').uncheck();
    await page.locator('[name=speed]').fill('0');await page.locator('[name=dither]').fill('0');
    await page.getByRole('button',{name:'Save',exact:true}).click();
    equal(await page.locator('body').getAttribute('data-appearance-tone'),'strong');equal(await page.locator('.greeting').isVisible(),false);
    equal(await page.locator('body').evaluate(el=>getComputedStyle(el,'::before').opacity),'0.035');
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('plutonium.appearance.v1')));
    equal(saved.speed,0);equal(saved.dither,0);equal(Object.keys(saved).length,6);
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.reload();await page.waitForFunction(()=>document.body.dataset.appearanceTone==='strong');equal(await page.locator('.greeting').isVisible(),false);scenarios++;

    await page.locator('#dock-photos').click();
    await page.frameLocator('[data-window=photos] iframe').getByLabel('Draft').fill('Retained synthetic photo draft');
    await page.locator('#appearance-open').click();await page.getByRole('button',{name:'Reset appearance',exact:true}).click();
    equal(await page.evaluate(()=>localStorage.getItem('plutonium.appearance.v1')),null);equal(await page.evaluate(()=>localStorage.getItem('plutonium.cursor.aero.v1')),'false');
    await page.getByRole('button',{name:'Done',exact:true}).click();
    equal(await page.frameLocator('[data-window=photos] iframe').getByLabel('Draft').inputValue(),'Retained synthetic photo draft');
    equal(loads.photos,1);await page.locator('#dock-photos').click();await page.locator('#dock-photos').click();equal(loads.photos,1);scenarios++;

    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#appearance-open').click();
    await page.locator('[name=animation]').check();await page.locator('[name=speed]').fill('1000');await page.getByRole('button',{name:'Save',exact:true}).click();
    equal(await page.locator('body').evaluate(el=>el.classList.contains('appearance-reduced-motion')),true);equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('plutonium.appearance.v1')).speed),20);equal(await page.locator('#appearance-speed').innerText(),'20.0×');
    await page.waitForTimeout(100);const stopped=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(180);equal(await page.evaluate(()=>window.appearanceFrames),stopped);
    await page.emulateMedia({reducedMotion:'no-preference',forcedColors:'active'});equal(await page.locator('#appearance-atom').isVisible(),false);
    await page.emulateMedia({forcedColors:'none'});await page.locator('[name=animation]').uncheck();await page.getByRole('button',{name:'Save',exact:true}).click();
    equal(await page.locator('body').evaluate(el=>el.classList.contains('appearance-reduced-motion')),false);await page.waitForTimeout(100);const disabledFrames=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(180);equal(await page.evaluate(()=>window.appearanceFrames),disabledFrames);scenarios++;

    await page.screenshot({path:path.join(output,'settings.png')});
    await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.locator('#appearance-open').click();await page.getByRole('button',{name:'Reset appearance',exact:true}).click();await page.getByRole('button',{name:'Done',exact:true}).click();
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
    await page.locator('#dock-home').click();
    await page.evaluate(()=>document.querySelector('.appearance-atom').style.transform='translateY(-10000px)');
    await page.waitForTimeout(100);ok(await page.locator('.appearance-atom').evaluate(el=>el.getBoundingClientRect().bottom<0));
    const before=await page.evaluate(()=>window.appearanceFrames);await page.waitForTimeout(180);equal(await page.evaluate(()=>window.appearanceFrames),before);
    await page.evaluate(()=>document.querySelector('.appearance-atom').style.transform='');
    await page.locator('#appearance-open').click();equal(await page.locator('#appearance-dialog').isVisible(),true);
    equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('[name=tone]').selectOption('soft');await page.getByRole('button',{name:'Save',exact:true}).click();
    await page.screenshot({path:path.join(output,'phone-settings.png')});scenarios++;

    const blocked=await context({viewport:{width:390,height:844}});
    await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('Synthetic blocked storage');}}));
    const phone=await ready(blocked);await phone.locator('#appearance-open').click();await phone.locator('[name=tone]').selectOption('bright');await phone.getByRole('button',{name:'Save',exact:true}).click();
    ok((await phone.locator('#appearance-status').innerText()).includes('unavailable'));equal(await phone.locator('body').getAttribute('data-appearance-tone'),'bright');
    await phone.getByRole('button',{name:'Reset appearance',exact:true}).click();equal(await phone.locator('body').getAttribute('data-appearance-tone'),'neutral');scenarios++;

    equal(forbidden.length,0);equal(errors.length,0);equal(requests.some(r=>r.method!=='GET'),false);
    equal(requests.some(r=>/plex|\/api\/settings/i.test(r.path)),false);
    console.log(JSON.stringify({scenarios,assertions,forbiddenRequests:forbidden.length,pageErrors:errors.length,photosLoads:loads.photos,serverStarted:false,nativeTraffic:false,screenshots:output}));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
