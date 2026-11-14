'use strict';
// Synthetic localhost only; native services are intercepted, never contacted.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),net=require('node:net');
const {spawn}=require('node:child_process'),{randomBytes}=require('node:crypto');
const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'portal-cursor-qa-'));
  const config=path.join(temp,'linked-apps.json'),key=randomBytes(32).toString('hex');
  await fs.writeFile(config,JSON.stringify([{subject:'cursor-fixture',username:'adrian',files:'https://cask.plutoniumcloud.com/apps/user_oidc/login/1',photos:'https://photos.plutoniumcloud.com/auth/login?autoLaunch=1'}]));
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  const origin='http://127.0.0.1:'+port;
  const actor={'X-Portal-Bridge-Key':key,'X-Authentik-Uid':'cursor-fixture','X-Authentik-Username':'adrian','X-Authentik-Name':'Cursor fixture','X-Authentik-Groups':'plutonium-members'};
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP'].includes(k.toUpperCase())));
  const child=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...env,PC_BRIDGE_KEY:key,PC_LINK_CONFIG:config,PORT:String(port),BIND_ADDRESS:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  let browser;const errors=[],blocked=[];
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Synthetic backend startup failed')),6000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(Error('Synthetic backend exited'));});});
    browser=await chromium.launch({executablePath:process.env.PC_CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
    async function context(options={}){
      const c=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block',...options});
      await c.addInitScript(()=>{
        const records=[],add=EventTarget.prototype.addEventListener,remove=EventTarget.prototype.removeEventListener;
        const capture=o=>typeof o==='boolean'?o:Boolean(o?.capture);
        EventTarget.prototype.addEventListener=function(type,fn,o){if(typeof fn==='function'&&fn.name.startsWith('aero')&&!records.some(r=>r.target===this&&r.type===type&&r.fn===fn&&r.capture===capture(o)))records.push({target:this,type,fn,capture:capture(o)});return add.call(this,type,fn,o);};
        EventTarget.prototype.removeEventListener=function(type,fn,o){const i=records.findIndex(r=>r.target===this&&r.type===type&&r.fn===fn&&r.capture===capture(o));if(i>=0)records.splice(i,1);return remove.call(this,type,fn,o);};
        window.__cursorQA={listeners:()=>records.length,frames:0,csp:[]};
        const frame=window.requestAnimationFrame;window.requestAnimationFrame=function(fn){window.__cursorQA.frames++;return frame.call(this,fn);};
        document.addEventListener('securitypolicyviolation',e=>window.__cursorQA.csp.push(e.violatedDirective));
      });
      await c.route('**/*',async route=>{
        const request=route.request(),url=new URL(request.url());
        if(url.origin===origin){assert.notEqual(url.pathname,'/api/plex/status');return route.continue({headers:{...request.headers(),...actor}});}
        if(['https://chat.plutoniumcloud.com','https://photos.plutoniumcloud.com','https://cask.plutoniumcloud.com'].includes(url.origin))return route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':"default-src 'none'; frame-ancestors "+origin},body:'<!doctype html><title>Synthetic app</title><h1>Synthetic app</h1><input aria-label="Draft">'});
        blocked.push('unexpected origin');return route.abort();
      });
      return c;
    }
    const c=await context(),page=await c.newPage();page.on('pageerror',()=>errors.push('pageerror'));page.on('console',m=>{if(m.type()==='error')errors.push('console error');});
    const ready=async()=>{await page.waitForFunction(()=>document.querySelector('#greeting-name')?.textContent==='Cursor fixture');};
    const active=()=>page.evaluate(()=>document.body.classList.contains('aero-cursor-on'));
    const move=async()=>{await page.mouse.move(30,150);await page.mouse.move(35,155);};
    await page.goto(origin+'/desktop');await ready();assert.equal(await active(),false);
    await move();assert.equal(await active(),true);const initial=await page.evaluate(()=>__cursorQA.listeners());assert.equal(initial,15);
    assert.match(await page.locator('body').evaluate(e=>getComputedStyle(e).cursor),/data:image\/x-icon/);
    await page.locator('#app-search').hover();assert.match(await page.locator('#app-search').evaluate(e=>getComputedStyle(e).cursor),/, text$/);
    await page.keyboard.press('Tab');assert.equal(await active(),false);assert.equal(await page.evaluate(()=>document.activeElement.matches(':focus-visible')),true);
    await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointermove',{pointerType:'touch',bubbles:true})));assert.equal(await active(),false);
    await move();assert.equal(await active(),true);await page.evaluate(()=>document.body.dispatchEvent(new PointerEvent('pointermove',{pointerType:'pen',bubbles:true})));assert.equal(await active(),false);
    await move();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.body.classList.contains('aero-cursor-on'));await move();assert.equal(await active(),false);assert.equal(await page.evaluate(()=>__cursorQA.listeners()),initial-5);
    assert.doesNotMatch(await page.locator('body').evaluate(e=>getComputedStyle(e).cursor),/data:/);
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForFunction(()=>document.querySelector('#aero-cursor-status').textContent.startsWith('On for mouse'));await move();assert.equal(await active(),true);
    await page.emulateMedia({forcedColors:'active'});await page.waitForFunction(()=>!document.body.classList.contains('aero-cursor-on'));await move();assert.equal(await active(),false);await page.emulateMedia({forcedColors:'none'});
    await page.locator('#appearance-open').click();const toggle=page.getByRole('switch',{name:'Custom cursor',exact:true});await toggle.uncheck();await move();assert.equal(await active(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('plutonium.cursor.aero.v1')),'false');
    await page.reload();await ready();await move();assert.equal(await active(),false);assert.equal(await page.locator('#aero-cursor-enabled').isChecked(),false);
    await page.locator('#appearance-open').click();await toggle.check();await page.locator('#appearance-close').click();await move();assert.equal(await active(),true);
    // Native Space plus explicit Enter must work even when the saved switch is off.
    await page.locator('#appearance-open').click();await toggle.focus();
    await page.keyboard.press('Space');assert.equal(await toggle.isChecked(),false);
    await page.keyboard.press('Enter');assert.equal(await toggle.isChecked(),true);
    await page.keyboard.press('Enter');assert.equal(await toggle.isChecked(),false);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.keyboard.press('Space');assert.equal(await toggle.isChecked(),true);
    assert.equal(await page.locator('.cursor-switch-track').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    assert.equal(await page.locator('.cursor-switch-track').evaluate(e=>getComputedStyle(e,'::after').transitionDuration),'0s');
    assert.equal(await toggle.evaluate(e=>e.matches(':focus-visible')),true);
    assert.notEqual(await page.locator('.cursor-switch-track').evaluate(e=>getComputedStyle(e).outlineStyle),'none');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.locator('#appearance-close').click();await move();
    for(let i=0;i<5;i++){
      await page.locator('#dock-chat').click();await page.frameLocator('[data-window=chat] iframe').getByRole('heading',{name:'Synthetic app'}).waitFor();
      const bar=page.locator('[data-window=chat] .wm-bar');await bar.hover();assert.match(await bar.evaluate(e=>getComputedStyle(e).cursor),/, grab$/);
      const handle=page.locator('[data-window=chat] [data-resize=se]');await handle.hover();assert.match(await handle.evaluate(e=>getComputedStyle(e).cursor),/, nwse-resize$/);
      const bounds=await bar.boundingBox();await page.mouse.move(bounds.x+120,bounds.y+18);await page.mouse.down();await page.mouse.move(bounds.x+150,bounds.y+35);await page.mouse.up();
      // Additive visible-behavior checks; the original flag/native assertions below remain unchanged.
      const nativeFrame=page.locator('[data-window=chat] iframe');
      await nativeFrame.hover();
      assert.equal(await nativeFrame.evaluate(e=>getComputedStyle(e).cursor),'auto');
      const nativeBody=page.frameLocator('[data-window=chat] iframe').locator('body');
      assert.equal(await nativeBody.evaluate(e=>getComputedStyle(e).cursor),'auto');
      assert.equal(await nativeBody.evaluate(body=>{const doc=body.ownerDocument,win=doc.defaultView,hit=doc.elementFromPoint(win.innerWidth/2,win.innerHeight/2);return hit?win.getComputedStyle(hit).cursor:null;}),'auto');
      await bar.hover();assert.equal(await active(),true);
      const restoredCursor=await bar.evaluate(e=>getComputedStyle(e).cursor);
      assert.match(restoredCursor,/data:image\/x-icon/);assert.match(restoredCursor,/, grab$/);
      const iframe=page.locator('[data-window=chat] iframe');await iframe.hover();assert.equal(await active(),false);assert.equal(await page.frameLocator('[data-window=chat] iframe').locator('body').evaluate(e=>getComputedStyle(e).cursor),'auto');
      await page.locator('[data-window=chat] [data-action=minimize]').click();await page.locator('#dock-chat').click();await page.locator('[data-window=chat] [data-action=close]').click();await move();assert.equal(await active(),true);assert.equal(await page.evaluate(()=>__cursorQA.listeners()),initial);
    }
    for(let i=0;i<10;i++){await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));assert.equal(await page.evaluate(()=>__cursorQA.listeners()),2);assert.equal(await active(),false);await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));assert.equal(await page.evaluate(()=>__cursorQA.listeners()),initial);assert.equal(await active(),false);await move();}
    assert.equal(await page.evaluate(()=>__cursorQA.frames),0);assert.deepEqual(await page.evaluate(()=>__cursorQA.csp),[]);
    const me=await(await c.request.get(origin+'/api/me',{headers:actor})).json();assert.equal(me.apps.find(a=>a.id==='plex').enabled,false);
    for(const endpoint of ['/invite/synthetic','/api/users/invitations'])assert.equal((await c.request.post(origin+endpoint,{headers:actor,data:{}})).status(),404);
    for(const endpoint of ['/api/plex/status','/launch/plex'])assert.equal((await c.request.get(origin+endpoint,{headers:actor,maxRedirects:0})).status(),403);
    assert.equal(await page.locator('#dock-users,[data-invite-action]').count(),0);
    // Decode actual CSS cursor bytes, and optionally render a visual asset atlas.
    const assets=JSON.parse(await fs.readFile(path.join(__dirname,'cursor-assets.json'),'utf8'));
    await move();
    const decoded=await page.evaluate(async assets=>{
      const canvas=document.createElement('canvas');canvas.id='cursor-asset-preview';canvas.width=660;canvas.height=200;const ctx=canvas.getContext('2d');
      ctx.fillStyle='#141414';ctx.fillRect(0,0,660,100);ctx.fillStyle='#efefef';ctx.fillRect(0,100,660,100);let index=0;
      for(const [name,asset] of Object.entries(assets.selected_assets)){
        const value=getComputedStyle(document.body).getPropertyValue('--aero-'+name);const url=value.match(/url\("?([^"\)]+)"?\)/)[1];
        const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('Cursor image decode failed'));image.src=url;});
        if(image.naturalWidth!==32||image.naturalHeight!==32)throw Error('Cursor image dimensions');
        for(const y of [0,100]){ctx.drawImage(image,index*60+14,y+15);ctx.fillStyle=y?'#111':'#eee';ctx.font='10px sans-serif';ctx.fillText(name,index*60+4,y+65);ctx.fillStyle='#d33';ctx.fillRect(index*60+14+asset.hotspot[0],y+15+asset.hotspot[1],2,2);}
        index++;
      }
      document.body.append(canvas);return index;
    },assets);assert.equal(decoded,11);
    if(process.argv[2])await page.locator('#cursor-asset-preview').screenshot({path:process.argv[2]});
    assert.deepEqual(await page.evaluate(()=>__cursorQA.csp),[]);
    const coarse=await context({isMobile:true,hasTouch:true,viewport:{width:390,height:844}}),touch=await coarse.newPage();await touch.goto(origin+'/desktop');await touch.waitForFunction(()=>document.querySelector('#greeting-name')?.textContent==='Cursor fixture');await touch.tap('#greeting-title');assert.equal(await touch.evaluate(()=>document.body.classList.contains('aero-cursor-on')),false);assert.doesNotMatch(await touch.locator('body').evaluate(e=>getComputedStyle(e).cursor),/data:/);
    await page.goto(origin+'/');assert.equal(await page.locator('.desktop-page,.aero-cursor-on,#aero-cursor-enabled').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);
    console.log(JSON.stringify({cursor_browser_passed:true,decoded_assets:decoded,lifecycle_cycles:10,window_cycles:5,listener_baseline:initial,cursor_animation_frames:0,reduced_motion:true,touch_fallback:true,forced_colors:true,invitation_post_404:true,cinema_denied:true,external_requests:0}));
  }finally{
    if(browser)await browser.close();
    if(child.exitCode===null&&child.signalCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}
    await fs.rm(temp,{recursive:true,force:true,maxRetries:3,retryDelay:100});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
