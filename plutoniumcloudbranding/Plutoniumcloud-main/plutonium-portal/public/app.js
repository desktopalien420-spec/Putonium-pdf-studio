'use strict';

const paths = {
  home:'<path d="m3 11 9-8 9 8v10h-6v-7H9v7H3z"/>',
  files:'<path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9H3z"/><path d="M3 11h18"/>',
  photos:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 3-3 6 6"/>',
  plex:'<path d="m8 3 9 9-9 9M3 3l9 9-9 9"/>',
  chat:'<path d="M20 11a8 8 0 0 1-8 8H6l-4 3v-7a9 9 0 1 1 18-4Z"/><path d="M7 9h8m-8 4h5"/>',
  vms:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4m-5-13 3 3-3 3m6 0h4"/>',
  desktop:'<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8m-4-4v4M3 13h18M8 4v9"/>',
  file:'<path d="M6 2h8l5 5v15H6zM14 2v6h5M9 13h7m-7 4h5"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.file}</svg>`;
const $=selector=>document.querySelector(selector);
let currentUser=null;
let apps=[];
let filter='all';
const appWindows=new Map();
const windowPromises=new Map();
const minimizeApps=()=>{for(const controller of appWindows.values())controller.minimize();};
const windowDialog=$('#app-window');
const accountDialog=$('#account-dialog');
function renderApps(){
  const query=$('#app-search').value.trim().toLowerCase();
  const visible=apps.filter(app=>(filter==='all'||app.group===filter)&&`${app.name} ${app.service} ${app.description}`.toLowerCase().includes(query));
  $('#app-grid').replaceChildren();
  for(const app of visible){
    const button=document.createElement('button');button.type='button';button.className='app-card';button.dataset.open=app.id;button.setAttribute('aria-label',app.service);
    const arrow=document.createElement('span');arrow.className='app-arrow';arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');
    const glyph=document.createElement('span');glyph.className='app-glyph';glyph.innerHTML=icon(app.id);
    button.append(arrow,glyph);
    for(const [cls,value] of [['app-name',app.name],['app-description',app.description],['app-state',app.state]]){const label=document.createElement('span');label.className=cls;label.textContent=value;button.append(label);}
    $('#app-grid').append(button);
  }
  $('#app-count').textContent=String(visible.length).padStart(2,'0');$('#empty-search').hidden=visible.length>0;
}
function showAccount(){if(!accountDialog.open)accountDialog.showModal();}
async function openApp(id,fromDock=false){
  const app=apps.find(item=>item.id===id);if(!app)return;
  if(app.enabled&&['photos','files','chat','plex'].includes(app.id)&&app.presentation==='embedded'){
    try{
      if(!appWindows.has(id)){
        if(!windowPromises.has(id))windowPromises.set(id,import('/desktop-window.mjs').then(module=>module.createAppWindow({id,subject:currentUser.subject,embedUrl:app.embedUrl,launchPath:app.launchPath})));
        appWindows.set(id,await windowPromises.get(id));
      }
      const controller=appWindows.get(id);
      if(fromDock&&controller.isActive())controller.minimize();else controller.open();
    }catch{windowPromises.delete(id);$('#recent-files').textContent='The '+app.name+' window could not open. Reload the desktop and try again.';}
    return;
  }
  if(app.enabled&&/^\/launch\/(files|photos|plex|chat)$/.test(app.launchPath)){window.open(app.launchPath,'_blank','noopener,noreferrer');return;}
  $('#window-title').textContent=app.service;
  const body=$('#window-body');body.replaceChildren();
  const heading=document.createElement('div');heading.className='window-heading';
  const glyph=document.createElement('span');glyph.className='app-glyph';glyph.innerHTML=icon(id);
  const title=document.createElement('div');const h2=document.createElement('h2');h2.textContent=app.name;const sub=document.createElement('p');sub.textContent=currentUser.name+'’s workspace';title.append(h2,sub);heading.append(glyph,title);body.append(heading);
  const messages={
    files:['Your identity is connected. Your Nextcloud account is next.','Your existing files remain in Nextcloud. We will link the correct account before opening personal documents from this portal.'],
    photos:['Your memories stay in your own Immich library.','Your existing uploads are unchanged. Account linking comes next; no photos are copied or shared by this portal.'],
    plex:['Library access uses your own Plex account.','Plex invitations and watch history are managed by Plex. No shared administrator token is used here.'],
    chat:['A little room for bigger ideas.','Sign in to your own Chat account to continue. Chat access is not connected for this desktop account yet.'],
    vms:['Your machines will appear here.','Browser consoles and reset-after-shutdown environments are planned. No virtual machines have been created or assigned yet.'],
    desktop:['Administrator workspace.','The shared Ubuntu host desktop is reserved for administrators. A browser gateway has not been connected.']
  };
  for(const text of messages[id]){const p=document.createElement('p');p.className='window-notice';p.textContent=text;body.append(p);}
  const button=document.createElement('button');button.className='primary window-action';button.type='button';button.disabled=true;button.textContent=app.state;body.append(button);
  windowDialog.classList.remove('expanded');if(!windowDialog.open)windowDialog.showModal();
}
document.addEventListener('click',event=>{
  const app=event.target.closest('[data-open]');if(app){openApp(app.dataset.open,Boolean(app.closest('.dock')));return;}
  const category=event.target.closest('[data-filter]');if(category){filter=category.dataset.filter;document.querySelectorAll('[data-filter]').forEach(button=>{const selected=button===category;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected));});renderApps();return;}
  if(event.target.closest('[data-home]')){minimizeApps();filter='all';$('#app-search').value='';document.querySelectorAll('[data-filter]').forEach(button=>{const on=button.dataset.filter==='all';button.classList.toggle('selected',on);button.setAttribute('aria-pressed',String(on));});renderApps();window.scrollTo({top:0,behavior:'auto'});}
});
$('#app-search').addEventListener('input',renderApps);
$('#account-button').addEventListener('click',showAccount);$('#switch-preview').addEventListener('click',showAccount);
$('#close-account').addEventListener('click',()=>accountDialog.close());$('#close-window').addEventListener('click',()=>windowDialog.close());$('#expand-window').addEventListener('click',()=>windowDialog.classList.toggle('expanded'));
for(const dialog of [windowDialog,accountDialog])dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(!windowDialog.open&&!accountDialog.open&&!document.querySelector('#appearance-dialog')?.open){minimizeApps();$('#app-search').focus();}}});
const tick=()=>{$('#clock').textContent=new Intl.DateTimeFormat(undefined,{hour:'numeric',minute:'2-digit'}).format(new Date());};tick();setInterval(tick,60000);
for(const name of ['home','files','photos','plex','chat','vms'])$('#dock-'+name).innerHTML=icon(name);
(async()=>{
  try{
    const response=await fetch('/api/me',{credentials:'same-origin',cache:'no-store',redirect:'error'});
    if(response.status===401||response.status===403){location.replace('/');return;}
    if(!response.ok)throw new Error('Identity unavailable');
    const data=await response.json();currentUser=data.user;apps=data.apps;
    $('#greeting-name').textContent=currentUser.name;$('#personal-heading').textContent=currentUser.name;
    $('#account-button').textContent=Array.from(currentUser.name)[0].toUpperCase();
    $('#account-description').textContent='Signed in as '+currentUser.name+'.';$('#account-username').textContent=currentUser.username;
    $('#recent-files').replaceChildren();const p=document.createElement('p');p.className='connection-note';p.textContent=apps.some(app=>app.enabled)?'Open Files or Photos to continue in your connected account. Your documents and photo library stay in their own apps.':'Your workspace is ready. Files and Photos will become available after your service accounts are connected.';$('#recent-files').append(p);
    document.title='Your desktop · Plutonium Cloud';renderApps();
    if(apps.some(app=>app.id==='plex'&&app.enabled)){
      fetch('/api/plex/status',{credentials:'same-origin',cache:'no-store',redirect:'error'}).then(async response=>{if(!response.ok)throw new Error();return response.json();}).then(result=>{const cinema=apps.find(app=>app.id==='plex');cinema.state=({online:'Plex online · Open library',offline:'Plex offline · Try opening',auth_required:'Plex connection needs attention',config_missing:'Plex connection pending'})[result.status]||'Plex status unavailable';renderApps();}).catch(()=>{const cinema=apps.find(app=>app.id==='plex');cinema.state='Plex status unavailable';renderApps();});
    }
  }catch{$('#greeting-title').textContent='Your session needs attention.';$('#recent-files').textContent='Return to the entrance and sign in again.';}
})();

// Aero cursor controller: no timers, frames, overlays or per-window listeners.
function createAeroCursor(win,doc){
  const toggle=doc.getElementById('aero-cursor-enabled');
  const status=doc.getElementById('aero-cursor-status');
  if(!toggle||!status||!doc.body.classList.contains('desktop-page'))return Object.freeze({mount(){},destroy(){}});
  const key='plutonium.cursor.aero.v1';
  const fine=win.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)');
  const contrast=win.matchMedia('(forced-colors: active)');
  let enabled=readPreference(),mouse=false,mounted=false,disposed=false;
  const controls=[],pointers=[],lifecycle=[];
  function readPreference(){
    try{const raw=win.localStorage.getItem(key);if(raw===null)return true;const value=JSON.parse(raw);return typeof value==='boolean'?value:false;}catch{return false;}
  }
  function listen(list,target,type,handler,options){target.addEventListener(type,handler,options);list.push(()=>target.removeEventListener(type,handler,options));}
  function release(list){for(const remove of list.splice(0))remove();}
  function aeroPointer(event){mouse=event.pointerType==='mouse'&&!event.target?.closest('iframe');update();}
  function aeroKeyboard(){mouse=false;update();}
  function aeroLeave(event){if(!event.relatedTarget){mouse=false;update();}}
  function aeroBlur(){mouse=false;update();}
  function aeroVisibility(){mouse=false;update();}
  function aeroMedia(){mouse=false;update();}
  function aeroPreference(){enabled=toggle.checked;try{win.localStorage.setItem(key,JSON.stringify(enabled));}catch{}update();}
  function aeroSwitchKey(event){if(event.key==='Enter'){event.preventDefault();if(!event.repeat){mouse=false;toggle.click();}}}
  function aeroStorage(event){if(event.key===key||event.key===null){enabled=readPreference();mouse=false;update();}}
  function update(){
    const allowed=mounted&&enabled&&fine.matches&&!reduced.matches&&!contrast.matches&&!doc.hidden;
    if(!allowed){mouse=false;release(pointers);}
    else if(!pointers.length){
      for(const type of ['pointermove','pointerover','pointerdown'])listen(pointers,doc,type,aeroPointer,{passive:true});
      listen(pointers,doc,'pointerout',aeroLeave,{passive:true});
      listen(pointers,doc,'keydown',aeroKeyboard,true);
    }
    doc.body.classList.toggle('aero-cursor-on',Boolean(allowed&&mouse));
    toggle.checked=enabled;
    const message=!enabled?'Off. Your system cursor is in use.':reduced.matches?'Off automatically: reduced motion is enabled.':contrast.matches?'Off automatically: high contrast is enabled.':!fine.matches?'Off on touch or coarse-pointer devices.':'On for mouse use. Embedded apps keep their own cursors.';
    if(status.textContent!==message)status.textContent=message;
  }
  function mount(){
    if(mounted||disposed)return;
    mounted=true;enabled=readPreference();mouse=false;
    listen(controls,toggle,'change',aeroPreference);
    listen(controls,toggle,'keydown',aeroSwitchKey);
    listen(controls,win,'storage',aeroStorage);
    listen(controls,win,'blur',aeroBlur);
    listen(controls,doc,'visibilitychange',aeroVisibility);
    for(const media of [fine,reduced,contrast])listen(controls,media,'change',aeroMedia);
    update();
  }
  function unmount(){mounted=false;mouse=false;release(pointers);release(controls);doc.body.classList.remove('aero-cursor-on');}
  function aeroPageHide(){unmount();}
  function aeroPageShow(){mount();}
  function destroy(){disposed=true;unmount();release(lifecycle);}
  listen(lifecycle,win,'pagehide',aeroPageHide);
  listen(lifecycle,win,'pageshow',aeroPageShow);
  try{mount();}catch(error){destroy();throw error;}
  return Object.freeze({mount,destroy});
}
// End Aero cursor controller.
try{createAeroCursor(window,document);}catch{
  document.body.classList.remove('aero-cursor-on');
  const toggle=document.getElementById('aero-cursor-enabled');
  if(toggle){toggle.checked=false;toggle.disabled=true;}
  const status=document.getElementById('aero-cursor-status');
  if(status)status.textContent='The custom cursor is unavailable. Your system cursor is in use.';
}

// Desktop appearance: a closed schema of local, non-sensitive presentation choices.
function createAppearancePreferences(storage){
  const key='plutonium.appearance.v1';
  const defaults=Object.freeze({atom:true,animation:true,speed:1,dither:0.6,tone:'neutral',greeting:true});
  function validate(input){
    const clean={...defaults};
    if(!input||typeof input!=='object'||Array.isArray(input))return clean;
    for(const name of ['atom','animation','greeting']){
      if(Object.hasOwn(input,name)&&typeof input[name]==='boolean')clean[name]=input[name];
    }
    if(Object.hasOwn(input,'speed')&&typeof input.speed==='number'&&Number.isFinite(input.speed)&&input.speed>=0&&input.speed<=20)clean.speed=input.speed;
    if(Object.hasOwn(input,'dither')&&typeof input.dither==='number'&&Number.isFinite(input.dither))clean.dither=Math.max(0,Math.min(1,input.dither));
    if(Object.hasOwn(input,'tone')&&['neutral','soft','bright','strong'].includes(input.tone))clean.tone=input.tone;
    return clean;
  }
  function load(){try{return validate(JSON.parse(storage().getItem(key)));}catch{return {...defaults};}}
  function save(value){const state=validate(value);let saved=true;try{storage().setItem(key,JSON.stringify(state));}catch{saved=false;}return {state,saved};}
  function reset(){let saved=true;try{storage().removeItem(key);}catch{saved=false;}return {state:{...defaults},saved};}
  return Object.freeze({key,defaults,validate,load,save,reset});
}
function appearanceSpeed(position){return Math.min(20,Math.expm1(Math.log(21)*Math.max(0,Math.min(1000,Number(position)||0))/1000));}
function appearanceSpeedPosition(speed){return Math.round(1000*Math.log1p(Math.max(0,Math.min(20,Number(speed)||0)))/Math.log(21));}
// End appearance preferences.

// Actual 3D meshes: spheres + torus tubes, perspective projection, z-buffer,
// Lambert/specular shading and screen-space stippling. No dependencies or WebGL.
function createAtomRenderer(canvas,pixelRatio=1){
  const ctx=canvas.getContext('2d');
  if(!ctx)return null;
  const ratio=Math.min(1.5,Math.max(1,Number(pixelRatio)||1));
  const width=Math.round(220*ratio),height=Math.round(180*ratio);
  canvas.width=width;canvas.height=height;
  const image=ctx.createImageData(width,height),depth=new Float32Array(width*height);
  const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const sphere=[],sphereFaces=[],rings=[],ringFaces=[];
  function mesh(vertices,faces,rows,columns,surface){
    const offset=vertices.length;
    for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++)vertices.push(surface(i/rows,j/columns));
    for(let i=0;i<rows;i++)for(let j=0;j<columns;j++){
      const a=offset+i*(columns+1)+j,b=a+columns+1;
      faces.push([a,b,a+1],[a+1,b,b+1]);
    }
  }
  mesh(sphere,sphereFaces,10,16,(u,v)=>{
    const y=Math.cos(u*Math.PI),r=Math.sin(u*Math.PI),p=v*Math.PI*2;
    const x=r*Math.cos(p),z=r*Math.sin(p);return [x,y,z,x,y,z];
  });
  function orbit(x,y,z,index){
    const tilt=[0.35,1.28,-1.05][index],yaw=[0,1.1,-0.9][index];
    const a=y*Math.cos(tilt)-z*Math.sin(tilt),b=y*Math.sin(tilt)+z*Math.cos(tilt);
    return [x*Math.cos(yaw)+b*Math.sin(yaw),a,-x*Math.sin(yaw)+b*Math.cos(yaw)];
  }
  for(let k=0;k<3;k++)mesh(rings,ringFaces,72,8,(u,v)=>{
    const a=u*Math.PI*2,b=v*Math.PI*2,n=orbit(Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b),k);
    const p=orbit((1.44+0.035*Math.cos(b))*Math.cos(a),0.035*Math.sin(b),(1.44+0.035*Math.cos(b))*Math.sin(a),k);
    return [...p,...n];
  });
  const nucleus=[[0,0,0],[-0.19,0.13,0.06],[0.18,0.12,-0.05],[0,-0.19,0.1],[-0.1,-0.02,-0.2],[0.06,0.2,0.16],[0.2,-0.14,-0.05],[-0.2,-0.12,0.02],[0.03,-0.05,0.27]];
  let rendered=0;
  function render(angle,dither){
    depth.fill(Infinity);image.data.fill(0);
    const yaw=angle*0.28+0.35,pitch=0.35+Math.sin(angle*0.15)*0.3;
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch);
    function rotate(x,y,z){const a=x*cy+z*sy,b=-x*sy+z*cy;return [a,y*cx-b*sx,y*sx+b*cx];}
    function project(vertices,scale=1,center=[0,0,0],material=1){
      return vertices.map(v=>{
        const p=rotate(v[0]*scale+center[0],v[1]*scale+center[1],v[2]*scale+center[2]);
        const n=rotate(v[3],v[4],v[5]),z=p[2]+5.5;
        const diffuse=Math.max(0,n[0]*-0.42+n[1]*0.58+n[2]*-0.69);
        const specular=Math.pow(Math.max(0,n[0]*-0.24+n[1]*0.32+n[2]*-0.92),20)*0.3;
        return [width/2+p[0]/z*height*1.62,height/2-p[1]/z*height*1.62,z,Math.min(1,(0.14+diffuse*0.78+specular)*material)];
      });
    }
    function triangles(vertices,faces){
      for(const face of faces){
        const a=vertices[face[0]],b=vertices[face[1]],c=vertices[face[2]];
        const area=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(area)<0.0001)continue;
        const minX=Math.max(0,Math.floor(Math.min(a[0],b[0],c[0]))),maxX=Math.min(width-1,Math.ceil(Math.max(a[0],b[0],c[0])));
        const minY=Math.max(0,Math.floor(Math.min(a[1],b[1],c[1]))),maxY=Math.min(height-1,Math.ceil(Math.max(a[1],b[1],c[1])));
        for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
          const u=((b[1]-c[1])*(x+0.5-c[0])+(c[0]-b[0])*(y+0.5-c[1]))/area;
          const v=((c[1]-a[1])*(x+0.5-c[0])+(a[0]-c[0])*(y+0.5-c[1]))/area,w=1-u-v;
          if(u<0||v<0||w<0)continue;
          const reciprocal=u/a[2]+v/b[2]+w/c[2],z=1/reciprocal,index=y*width+x;
          if(z>=depth[index])continue;
          depth[index]=z;
          const light=(u*a[3]/a[2]+v*b[3]/b[2]+w*c[3]/c[2])/reciprocal;
          const noise=((x*73+y*151+x*y*19)&255)/255;
          const threshold=(bayer[(y%4)*4+x%4]/16)*0.55+noise*0.45;
          const density=Math.max(0.08,light*(1-dither*0.25));
          const offset=index*4,ink=dither===0?Math.round(230*light):230;
          image.data[offset]=image.data[offset+1]=image.data[offset+2]=ink;
          image.data[offset+3]=dither===0||density>threshold?255:0;
        }
      }
    }
    triangles(project(rings),ringFaces);
    for(let i=0;i<nucleus.length;i++)triangles(project(sphere,0.19,nucleus[i],i%2?0.8:1),sphereFaces);
    for(let i=0;i<3;i++){
      const phase=angle*(0.65+i*0.12)+i*2.1,center=orbit(1.44*Math.cos(phase),0,1.44*Math.sin(phase),i);
      triangles(project(sphere,0.105,center),sphereFaces);
    }
    ctx.putImageData(image,0,0);rendered++;
    return {width,height,triangles:ringFaces.length+sphereFaces.length*12,rendered};
  }
  return Object.freeze({render,width,height,pixelRatio:ratio});
}
// End atom renderer.

function setupDesktopAppearance(win,doc){
  const dialog=doc.getElementById('appearance-dialog'),form=doc.getElementById('appearance-form');
  if(!dialog||!form)return;
  const preferences=createAppearancePreferences(()=>win.localStorage);
  let state=preferences.load(),opener=null,timer=0,angle=0,last=0,visible=false,focused=doc.hasFocus();
  const reduced=win.matchMedia('(prefers-reduced-motion: reduce)'),contrast=win.matchMedia('(forced-colors: active)');
  const canvas=doc.getElementById('appearance-atom'),mark=canvas.parentElement,fallback=mark.querySelector('svg');
  const renderer=createAtomRenderer(canvas,win.devicePixelRatio);
  const control=name=>form.elements.namedItem(name);
  function draw(){
    if(!renderer||contrast.matches){canvas.hidden=true;fallback.removeAttribute('hidden');return;}
    canvas.hidden=false;fallback.setAttribute('hidden','');renderer.render(angle,state.dither);
  }
  function animated(){return renderer&&state.atom&&state.animation&&state.speed>0&&!reduced.matches&&!contrast.matches&&!doc.hidden&&focused&&visible;}
  function tick(){
    timer=0;if(!animated())return;
    const now=win.performance.now(),elapsed=now-last;
    if(elapsed>=50){angle=(angle+Math.min(elapsed,100)*0.0007*state.speed)%(Math.PI*200);last=now;draw();}
    timer=win.setTimeout(tick,Math.max(1,50-(win.performance.now()-last)));
  }
  function schedule(){
    if(timer)win.clearTimeout(timer);timer=0;last=win.performance.now();
    if(animated())timer=win.setTimeout(tick,50);
  }
  function apply(){
    doc.body.dataset.appearanceTone=state.tone;
    doc.body.classList.toggle('appearance-reduced-motion',reduced.matches);
    doc.querySelector('.greeting').hidden=!state.greeting;mark.hidden=!state.atom;
    draw();schedule();
  }
  function outputs(){
    const speed=appearanceSpeed(control('speed').value);
    control('speed').setAttribute('aria-valuetext',speed.toFixed(speed<1?2:1)+'×');
    doc.getElementById('appearance-speed').textContent=speed.toFixed(speed<1?2:1)+'×';
    doc.getElementById('appearance-dither').textContent=Math.round(Number(control('dither').value)*100)+'%';
  }
  function populate(){
    for(const [name,value] of Object.entries(state)){
      const el=control(name);if(el.type==='checkbox')el.checked=value;else el.value=String(name==='speed'?appearanceSpeedPosition(value):value);
    }
    outputs();
  }
  function status(message){doc.getElementById('appearance-status').textContent=message;}
  function open(event){opener=event.currentTarget;populate();status('');if(!dialog.open)dialog.showModal();}
  doc.getElementById('appearance-open').addEventListener('click',open);
  for(const id of ['appearance-close','appearance-done'])doc.getElementById(id).addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(opener?.isConnected)opener.focus();});
  form.addEventListener('input',outputs);
  form.addEventListener('submit',event=>{
    event.preventDefault();const draft={};
    for(const name of Object.keys(preferences.defaults)){
      const el=control(name);draft[name]=el.type==='checkbox'?el.checked:name==='speed'?appearanceSpeed(el.value):el.type==='range'?Number(el.value):el.value;
    }
    const result=preferences.save(draft);state=result.state;apply();
    status(result.saved?'Appearance saved on this browser.':'Applied for this visit. Browser storage is unavailable.');
  });
  doc.getElementById('appearance-reset').addEventListener('click',()=>{
    const result=preferences.reset();state=result.state;populate();apply();
    status(result.saved?'Appearance reset to defaults.':'Defaults applied for this visit. Browser storage is unavailable.');
  });
  reduced.addEventListener('change',apply);contrast.addEventListener('change',apply);
  doc.addEventListener('visibilitychange',schedule);
  win.addEventListener('blur',()=>{focused=false;schedule();});
  win.addEventListener('focus',()=>{focused=true;schedule();});
  win.addEventListener('storage',event=>{if(event.key===preferences.key||event.key===null){state=preferences.load();apply();if(dialog.open){populate();status('Appearance updated from this browser.');}}});
  const observer=new win.IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);schedule();});observer.observe(mark);
  win.addEventListener('pagehide',()=>{visible=false;schedule();observer.disconnect();});
  win.addEventListener('pageshow',()=>{observer.observe(mark);apply();});
  apply();
}
setupDesktopAppearance(window,document);
