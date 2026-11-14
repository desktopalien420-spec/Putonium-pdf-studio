'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const source=fs.readFileSync(path.join(__dirname,'public/app.js'),'utf8');
// Exercise the actual pure controller; the separate browser fixture loads all app.js.
const controller=source.slice(source.indexOf('function createAeroCursor('),source.indexOf('// End Aero cursor controller.'));
class Target{
  constructor(){this.events=[];}
  addEventListener(type,fn,options){const capture=typeof options==='boolean'?options:Boolean(options?.capture);if(!this.events.some(e=>e.type===type&&e.fn===fn&&e.capture===capture))this.events.push({type,fn,capture});}
  removeEventListener(type,fn,options){const capture=typeof options==='boolean'?options:Boolean(options?.capture);this.events=this.events.filter(e=>!(e.type===type&&e.fn===fn&&e.capture===capture));}
  emit(type,details={}){for(const e of [...this.events])if(e.type===type)e.fn({type,...details});}
}
function fixture(options={}){
  const win=new Target(),doc=new Target(),toggle=new Target(),status={textContent:''};
  const classes=new Set(options.landing?[]:['desktop-page']);
  doc.body={classList:{contains:n=>classes.has(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)}};
  doc.hidden=false;doc.getElementById=id=>id==='aero-cursor-enabled'?toggle:id==='aero-cursor-status'?status:null;
  const media=[new Target(),new Target(),new Target()];
  media[0].matches=!options.coarse;media[1].matches=Boolean(options.reduced);media[2].matches=Boolean(options.contrast);
  win.matchMedia=q=>media[q.includes('prefers-reduced-motion')?1:q.includes('forced-colors')?2:0];
  let stored=options.stored??null,frames=0;
  win.localStorage={getItem(){if(options.storageError)throw Error('synthetic storage unavailable');return stored;},setItem(k,v){assert.equal(k,'plutonium.cursor.aero.v1');if(options.storageError)throw Error('synthetic storage unavailable');stored=v;}};
  win.requestAnimationFrame=()=>{frames++;throw Error('Cursor must never schedule a frame');};
  toggle.click=()=>{toggle.checked=!toggle.checked;toggle.emit('change');};
  const create=vm.runInNewContext(controller+'\ncreateAeroCursor;');
  const cursor=create(win,doc);
  const move=(pointerType='mouse',iframe=false)=>doc.emit('pointermove',{pointerType,target:{closest:()=>iframe?{}:null}});
  const count=()=>[win,doc,toggle,...media].reduce((sum,t)=>sum+t.events.length,0);
  return {win,doc,toggle,status,media,cursor,move,count,active:()=>classes.has('aero-cursor-on'),stored:()=>stored,frames:()=>frames};
}
test('mouse enables only after input; keyboard, pen, touch, iframe and leave clear eligibility',()=>{
  const f=fixture();assert.equal(f.active(),false);f.move();assert.equal(f.active(),true);
  for(const type of ['touch','pen','']){f.move(type);assert.equal(f.active(),false);f.move();assert.equal(f.active(),true);}
  f.doc.emit('keydown');assert.equal(f.active(),false);f.move();f.move('mouse',true);assert.equal(f.active(),false);
  f.move();f.doc.emit('pointerout',{relatedTarget:null});assert.equal(f.active(),false);f.cursor.destroy();
});
test('reduced motion initially installs no pointer listeners and never activates',()=>{
  const f=fixture({reduced:true});assert.equal(f.doc.events.some(e=>e.type==='pointermove'),false);f.move();assert.equal(f.active(),false);assert.match(f.status.textContent,/reduced motion/);f.cursor.destroy();
});
test('dynamic reduced motion removes input listeners and requires fresh mouse input on recovery',()=>{
  const f=fixture();f.move();const before=f.count();f.media[1].matches=true;f.media[1].emit('change');
  assert.equal(f.active(),false);assert.equal(f.count(),before-5);f.move();assert.equal(f.active(),false);
  f.media[1].matches=false;f.media[1].emit('change');assert.equal(f.active(),false);assert.equal(f.count(),before);f.move();assert.equal(f.active(),true);f.cursor.destroy();
});
test('coarse pointer and high contrast disable initially and dynamically',()=>{
  for(const option of [{coarse:true},{contrast:true}]){const f=fixture(option);f.move();assert.equal(f.active(),false);f.cursor.destroy();}
  const f=fixture();f.move();f.media[0].matches=false;f.media[0].emit('change');assert.equal(f.active(),false);
  f.media[0].matches=true;f.media[0].emit('change');f.move();f.media[2].matches=true;f.media[2].emit('change');assert.equal(f.active(),false);f.cursor.destroy();
});
test('off stores only a boolean, removes input listeners, and reload preserves it',()=>{
  const f=fixture();f.move();f.toggle.checked=false;f.toggle.emit('change');assert.equal(f.stored(),'false');assert.equal(f.active(),false);assert.equal(f.doc.events.some(e=>e.type==='pointermove'),false);
  const next=fixture({stored:f.stored()});next.move();assert.equal(next.active(),false);next.toggle.checked=true;next.toggle.emit('change');next.move();assert.equal(next.active(),true);assert.equal(next.stored(),'true');f.cursor.destroy();next.cursor.destroy();
});
test('malformed preferences and denied storage safely fall back to native',()=>{
  for(const stored of ['{}','null','1','"true"','broken']){const f=fixture({stored});f.move();assert.equal(f.active(),false);f.cursor.destroy();}
  const f=fixture({storageError:true});f.move();assert.equal(f.active(),false);f.toggle.checked=true;f.toggle.emit('change');f.move();assert.equal(f.active(),true);f.cursor.destroy();
});
test('another tab changing the preference clears activation and respects off',()=>{
  const f=fixture();f.move();f.win.localStorage.setItem('plutonium.cursor.aero.v1','false');f.win.emit('storage',{key:'plutonium.cursor.aero.v1'});assert.equal(f.active(),false);assert.equal(f.toggle.checked,false);f.cursor.destroy();
});
test('repeated mount, pagehide/pageshow and destroy do not leak listeners or frames',()=>{
  const f=fixture(),initial=f.count();assert.equal(initial,15);
  for(let i=0;i<30;i++){f.cursor.mount();assert.equal(f.count(),initial);f.move();f.win.emit('pagehide');assert.equal(f.count(),2);assert.equal(f.active(),false);f.win.emit('pageshow');assert.equal(f.count(),initial);assert.equal(f.active(),false);}
  assert.equal(f.frames(),0);f.cursor.destroy();assert.equal(f.count(),0);f.cursor.destroy();f.cursor.mount();f.win.emit('pageshow');assert.equal(f.count(),0);
});
test('hidden pages and blur clear state; visible recovery waits for mouse input',()=>{
  const f=fixture();f.move();f.win.emit('blur');assert.equal(f.active(),false);f.move();f.doc.hidden=true;f.doc.emit('visibilitychange');assert.equal(f.active(),false);assert.equal(f.doc.events.some(e=>e.type==='pointermove'),false);
  f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.active(),false);f.move();assert.equal(f.active(),true);f.cursor.destroy();
});
test('landing page installs nothing',()=>{const f=fixture({landing:true});f.move();f.cursor.mount();assert.equal(f.count(),0);assert.equal(f.active(),false);f.cursor.destroy();});
test('all eleven embedded assets retain exact original hashes, dimensions and hotspots',()=>{
  const assets=JSON.parse(fs.readFileSync(path.join(__dirname,'cursor-assets.json'))),css=fs.readFileSync(path.join(__dirname,'public/styles.css'),'utf8');
  assert.equal(Object.keys(assets.selected_assets).length,11);assert.equal(assets.animated_assets_used,false);
  for(const [name,item] of Object.entries(assets.selected_assets)){
    const match=css.match(new RegExp('--aero-'+name+':url\\("data:image/x-icon;base64,([A-Za-z0-9+/=]+)"\\) (\\d+) (\\d+);'));
    assert.ok(match,name);const data=Buffer.from(match[1],'base64');assert.equal(createHash('sha256').update(data).digest('hex'),item.sha256);
    assert.equal(data.readUInt16LE(2),2);assert.equal(data.readUInt16LE(4),1);assert.equal(data[6],32);assert.equal(data[7],32);
    assert.deepEqual([data.readUInt16LE(10),data.readUInt16LE(12)],item.hotspot);assert.deepEqual([Number(match[2]),Number(match[3])],item.hotspot);
  }
});
test('client has no cursor frame loop or overlay and retains accessible switch/fallbacks',()=>{
  assert.doesNotMatch(controller,/requestAnimationFrame|setInterval|setTimeout|createElement|cursor\s*:\s*none/);
  const html=fs.readFileSync(path.join(__dirname,'public/desktop.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'public/styles.css'),'utf8');
  assert.match(html,/aria-describedby="aero-cursor-help aero-cursor-status"/);assert.match(html,/role="switch"/);assert.match(html,/>Custom cursor</);
  for(const native of ['auto','pointer','text','grab','grabbing','not-allowed','ns-resize','ew-resize','nesw-resize','nwse-resize'])assert.ok(css.includes(','+native),native);
  assert.match(css,/prefers-reduced-motion:no-preference/);assert.match(css,/forced-colors:none/);assert.match(css,/iframe\{cursor:auto\}/);
});

test('switch Enter works while off and reduced motion; repeat does not toggle; teardown removes handler',()=>{
  const f=fixture({stored:'false',reduced:true});let prevented=0;
  const enter=repeat=>f.toggle.emit('keydown',{key:'Enter',repeat,preventDefault:()=>prevented++});
  enter(false);assert.equal(f.toggle.checked,true);assert.equal(f.stored(),'true');assert.equal(f.active(),false);
  enter(true);assert.equal(f.toggle.checked,true);assert.equal(f.stored(),'true');
  enter(false);assert.equal(f.toggle.checked,false);assert.equal(f.stored(),'false');assert.equal(prevented,3);
  f.cursor.destroy();enter(false);assert.equal(f.toggle.checked,false);assert.equal(f.count(),0);
});
test('switch uses a real input and focus track with reduced-motion transitions disabled',()=>{
  const html=fs.readFileSync(path.join(__dirname,'public/desktop.html'),'utf8'),css=fs.readFileSync(path.join(__dirname,'public/styles.css'),'utf8');
  assert.match(html,/<input type="checkbox" role="switch" id="aero-cursor-enabled"/);
  assert.match(css,/input:focus-visible \+ \.cursor-switch-track\{outline:3px/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\.cursor-switch-track,\.cursor-switch-track::after\{transition:none!important;animation:none!important\}\}/);
});
