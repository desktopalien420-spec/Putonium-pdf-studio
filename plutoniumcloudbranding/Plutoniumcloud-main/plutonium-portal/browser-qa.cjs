'use strict';
// Disposable browser + localhost backend. Every non-local request is fulfilled or aborted.
const path=require('node:path'),fs=require('node:fs/promises'),os=require('node:os');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const origin='http://127.0.0.1:8786';
const serviceIds=new Map([['https://cask.plutoniumcloud.com','files'],['https://photos.plutoniumcloud.com','photos'],['https://chat.plutoniumcloud.com','chat'],['https://plex.plutoniumcloud.com','plex']]);

(async()=>{
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'portal-baseline-browser-'));
  const config=path.join(temp,'linked-apps.json'),key=randomBytes(32).toString('hex');
  await fs.writeFile(config,JSON.stringify([{subject:'browser-reconstruction-fixture',username:'adrian',files:'https://cask.plutoniumcloud.com/apps/user_oidc/login/1',photos:'https://photos.plutoniumcloud.com/auth/login?autoLaunch=1'}]));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP'].includes(k.toUpperCase())));
  const child=spawn(process.execPath,['server.cjs'],{cwd:__dirname,env:{...env,PC_BRIDGE_KEY:key,PC_LINK_CONFIG:config,PLEX_BASE_URL:'http://127.0.0.1:1',PLEX_TOKEN:'synthetic-only',BIND_ADDRESS:'127.0.0.1',PORT:'8786'},stdio:['ignore','pipe','pipe']});
  let browser;
  try{
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Backend startup failed')),6000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Backend exited'));});});
    browser=await chromium.launch({executablePath:process.env.PC_CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true});
    const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});
    const loads={files:0,photos:0,chat:0,plex:0},blocked=[],errors=[],consoleErrors=[];
    const actor={'X-Portal-Bridge-Key':key,'X-Authentik-Uid':'browser-reconstruction-fixture','X-Authentik-Username':'adrian','X-Authentik-Name':'Fixture member','X-Authentik-Groups':'plutonium-members'};
    await context.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===origin){
        if(url.pathname==='/api/plex/status')throw new Error('Unexpected Cinema status request');
        return route.continue({headers:{...request.headers(),...actor}});
      }
      const id=serviceIds.get(url.origin);
      if(id){
        loads[id]++;
        return route.fulfill({status:200,contentType:'text/html',headers:{
          'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'self' "+origin,
          ...(id==='files'?{'X-Frame-Options':'SAMEORIGIN'}:{})
        },body:'<!doctype html><title>Isolated '+id+'</title><style>body{background:#141414;color:#eee;font:16px system-ui;padding:24px}input{display:block;margin-top:20px}</style><h1>Fixture '+id+'</h1><label>Draft<input aria-label="Draft"></label>'});
      }
      blocked.push('unexpected origin');return route.abort();
    });
    const page=await context.newPage();page.on('pageerror',()=>errors.push('pageerror'));page.on('console',m=>{if(m.type()==='error')consoleErrors.push('console error');});
    await page.goto(origin+'/desktop?preview=julian');await page.waitForFunction(()=>document.querySelector('#greeting-name').textContent==='Fixture member');
    assert.equal(await page.locator('#dock-users').count(),0);
    assert.equal(await page.locator('[data-profile]').count(),0);
    assert.equal(await page.locator('.app-card').count(),5);
    assert.doesNotMatch(await page.locator('#recent-files').innerText(),/Homelab notes|Lab notebook|Example/);
    await page.locator('#account-button').click();
    assert.equal(await page.locator('#account-username').innerText(),'adrian');
    await page.keyboard.press('Escape');
    await page.locator('#app-search').fill('chat');assert.equal(await page.locator('.app-card').count(),1);
    await page.locator('#app-search').fill('');

    for(const id of ['files','photos','chat']){
      await page.locator('#dock-'+id).click();
      const frame=page.frameLocator('[data-window='+id+'] iframe');
      await frame.getByRole('heading',{name:'Fixture '+id}).waitFor();
      await frame.getByRole('textbox').fill('Retained '+id);
      const iframe=page.locator('[data-window='+id+'] iframe');
      assert.doesNotMatch(await iframe.getAttribute('sandbox'),/allow-top-navigation|allow-popups-to-escape-sandbox/);
    }
    assert.equal(context.pages().length,1);assert.deepEqual(loads,{files:1,photos:1,chat:1,plex:0});
    assert.doesNotMatch(await page.locator('[data-window=chat] iframe').getAttribute('allow'),/autoplay/);
    await page.locator('#dock-chat').click();assert.equal(await page.locator('[data-window=chat]').isVisible(),false);
    await page.locator('#dock-chat').click();assert.equal(await page.frameLocator('[data-window=chat] iframe').getByRole('textbox').inputValue(),'Retained chat');
    await page.locator('#dock-plex').click();assert.equal(await page.locator('[data-window=plex]').count(),0);
    assert.equal(await page.locator('#app-window').isVisible(),true);await page.locator('#close-window').click();
    await page.locator('#dock-files').click();
    const files=page.locator('[data-window=files]');
    const before=await files.boundingBox(),bar=await files.locator('.wm-bar').boundingBox();
    await page.mouse.move(bar.x+120,bar.y+18);await page.mouse.down();await page.mouse.move(bar.x+220,bar.y+68,{steps:8});await page.mouse.up();
    const moved=await files.boundingBox();assert.ok(moved.x>before.x+50&&moved.y>before.y+20);
    const grip=await files.locator('[data-resize=se]').boundingBox();await page.mouse.move(grip.x+grip.width/2,grip.y+grip.height/2);await page.mouse.down();await page.mouse.move(grip.x+90,grip.y+65,{steps:8});await page.mouse.up();
    const resized=await files.boundingBox();assert.ok(resized.width>moved.width+40&&resized.height>moved.height+25);
    await files.getByRole('button',{name:'Window layout',exact:true}).click();await files.getByRole('button',{name:'Snap left',exact:true}).click();await files.getByRole('button',{name:'Window layout',exact:true}).click();assert.equal(await files.getAttribute('data-mode'),'left');
    await page.locator('#dock-chat').click();const chat=page.locator('[data-window=chat]');
    await chat.getByRole('button',{name:'Maximize Chat',exact:true}).click();assert.equal(await chat.getAttribute('data-mode'),'maximized');await chat.getByRole('button',{name:'Restore Chat',exact:true}).click();

    const artifact=path.join(__dirname,'artifacts');await fs.mkdir(artifact,{recursive:true});await page.screenshot({path:path.join(artifact,'chat-window-desktop.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    assert.equal((await chat.boundingBox()).width,390);assert.equal(await page.locator('.desktop-main').evaluate(e=>e.inert),true);
    for(const id of ['photos','files','chat']){
      await page.locator('#dock-'+id).click();const win=page.locator('[data-window='+id+']');assert.equal(await win.isVisible(),true);
      assert.equal((await win.boundingBox()).width,390);assert.equal(await page.frameLocator('[data-window='+id+'] iframe').getByRole('textbox').inputValue(),'Retained '+id);
    }
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('#dock-home').click();assert.equal(await page.locator('.desktop-main').evaluate(e=>e.inert),false);
    await page.locator('#dock-chat').click();await page.screenshot({path:path.join(artifact,'chat-window-phone.png'),fullPage:true});
    const chatWindow=page.locator('[data-window=chat]');
    const popupPromise=context.waitForEvent('page');await chatWindow.getByRole('button',{name:'Reconnect',exact:true}).click();const popup=await popupPromise;
    await popup.waitForURL('https://chat.plutoniumcloud.com/');assert.equal(await popup.evaluate(()=>window.opener),null);await popup.close();
    await chatWindow.getByRole('button',{name:'Reload',exact:true}).click();await page.frameLocator('[data-window=chat] iframe').getByRole('heading').waitFor();assert.equal(await page.frameLocator('[data-window=chat] iframe').getByRole('textbox').inputValue(),'');
    await chatWindow.getByRole('button',{name:'Close Chat',exact:true}).click();assert.equal(await page.locator('[data-window=chat] iframe').count(),0);
    await page.locator('#dock-photos').click();assert.equal(await page.frameLocator('[data-window=photos] iframe').getByRole('textbox').inputValue(),'Retained photos');
    assert.equal(await page.evaluate(async()=>{const m=await import('/desktop-window.mjs');let denied=0;for(const value of [
      {id:'plex',subject:'browser-reconstruction-fixture',embedUrl:'https://plex.plutoniumcloud.com/web/',launchPath:'/launch/plex'},
      {id:'chat',subject:'other-subject',embedUrl:'https://chat.plutoniumcloud.com/c/new',launchPath:'/launch/chat'},
      {id:'constructor',subject:'browser-reconstruction-fixture',embedUrl:'x',launchPath:'/launch/constructor'}
    ]){try{m.createAppWindow(value);}catch{denied++;}}return denied;}),3);
    for(const group of ['plutonium-members|plutonium-admins','plutonium-members|plutonium-inviters']){
      actor['X-Authentik-Groups']=group;await page.reload();await page.waitForFunction(()=>document.querySelector('#greeting-name').textContent==='Fixture member');
      assert.equal(await page.locator('#dock-users, #users-nav, #users-dialog, #invite-form, [data-users], [data-invite-action]').count(),0);
      assert.equal((await context.request.get(origin+'/api/users/invitations',{headers:actor})).status(),404);
    }

    // Main's foreign-subject escaping and account checks in a separately isolated context.
    const other=await browser.newContext({serviceWorkers:'block'});
    const otherActor={...actor,'X-Authentik-Uid':'qa-subject-julian','X-Authentik-Username':'julian','X-Authentik-Name':'<img src=x onerror=alert(1)>','X-Authentik-Groups':'plutonium-members'};
    await other.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(url.origin===origin)return route.continue({headers:{...request.headers(),...otherActor}});
      if(serviceIds.has(url.origin))return route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Synthetic native destination</title>'});
      blocked.push('unexpected foreign-context origin');return route.abort();
    });
    const otherPage=await other.newPage();otherPage.on('pageerror',()=>errors.push('foreign pageerror'));
    await otherPage.goto(origin+'/desktop');
    await otherPage.waitForFunction(()=>document.querySelector('#greeting-name').textContent.includes('<img'));
    assert.equal(await otherPage.locator('#greeting-name img').count(),0);
    await otherPage.locator('#account-button').click();assert.equal(await otherPage.locator('#account-username').innerText(),'julian');
    await other.close();
    assert.equal(loads.plex,0);
    assert.deepEqual(blocked,[]);assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors,[]);
    console.log('Isolated R05 browser passed: Files/Photos/Chat retained state, drag/resize/snap/maximize, mobile/home, Chat reconnect/reload/close, capability rejection, disabled Cinema and invitation controls. Every external request intercepted; native auth/inference and deployment remain unverified.');
  }finally{
    if(browser)await browser.close();
    if(child.exitCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}
    await fs.rm(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error('Isolated browser fixture failed: '+error.name+' '+error.message.split('\n')[0]);process.exitCode=1;});
