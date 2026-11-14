'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'app.js'),'utf8');
const code=source.slice(source.indexOf('function createAppearancePreferences('),source.indexOf('// End appearance preferences.'));
function fixture(raw=null,blocked=false){
  const values=new Map([['unrelated','preserved'],['plutonium.cursor.aero.v1','false']]);
  if(raw!==null)values.set('plutonium.appearance.v1',raw);
  const storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
  const noNetwork=()=>{throw Error('No network allowed');};
  const factory=vm.runInNewContext(code+';createAppearancePreferences',{fetch:noNetwork,XMLHttpRequest:noNetwork,WebSocket:noNetwork,navigator:{sendBeacon:noNetwork}});
  return {store:factory(()=>{if(blocked)throw Error('Storage blocked');return storage;}),values};
}
test('missing and malformed storage safely use defaults',()=>{
  for(const raw of [null,'{','null','[]','42','"value"']){const {store}=fixture(raw);assert.deepEqual({...store.load()},{...store.defaults});}
});
test('only own allowlisted fields survive saving and reloading',()=>{
  const {store,values}=fixture();
  const hostile=JSON.parse('{"token":"synthetic-secret","subject":"synthetic-person","url":"https://invalid.example","__proto__":{"grain":false},"constructor":{"prototype":{"polluted":true}},"tone":"strong","greeting":false}');
  store.save(hostile);
  const saved=JSON.parse(values.get(store.key));assert.deepEqual(Object.keys(saved).sort(),Object.keys(store.defaults).sort());
  assert.equal(saved.tone,'strong');assert.equal(saved.greeting,false);assert.equal(Object.hasOwn(saved,'grain'),false);assert.equal(Object.hasOwn(saved,'reducedMotion'),false);
  assert.doesNotMatch(values.get(store.key),/synthetic|token|subject|url|__proto__|constructor|polluted/);
  assert.equal(store.load().tone,'strong');assert.equal({}.polluted,undefined);
});
test('numbers clamp; zero values remain valid; strings and nonfinite values cannot enter storage',()=>{
  const {store}=fixture();
  assert.equal(store.validate({speed:0,dither:0}).speed,0);assert.equal(store.validate({dither:0}).dither,0);
  assert.equal(store.validate({speed:20,dither:-2}).speed,20);assert.equal(store.validate({speed:21}).speed,1);assert.equal(store.validate({speed:-1}).speed,1);assert.equal(store.validate({dither:-2}).dither,0);
  for(const value of [NaN,Infinity,-Infinity,'1',null,true,{}]){assert.equal(store.validate({speed:value}).speed,1);assert.equal(store.validate({dither:value}).dither,0.6);}
});
test('boolean and tone fields have strict types and ignore inherited properties',()=>{
  const {store}=fixture();
  for(const name of ['atom','animation','greeting']){
    for(const value of ['false',0,1,null,{}])assert.equal(store.validate({[name]:value})[name],store.defaults[name]);
    assert.equal(store.validate({[name]:false})[name],false);
  }
  assert.equal(store.validate(Object.create({greeting:false,tone:'strong'})).greeting,true);assert.equal(Object.hasOwn(store.validate({grain:false,reducedMotion:true}),'grain'),false);assert.equal(Object.hasOwn(store.validate({grain:false,reducedMotion:true}),'reducedMotion'),false);
  assert.equal(store.validate({tone:'<script>'}).tone,'neutral');
});
test('blocked storage keeps changes in memory and reports unsuccessful persistence',()=>{
  const {store}=fixture(null,true);assert.equal(store.load().tone,'neutral');
  const result=store.save({tone:'strong'});assert.equal(result.saved,false);assert.equal(result.state.tone,'strong');assert.equal(store.reset().saved,false);
});
test('reset removes only appearance key and preserves cursor and unrelated values',()=>{
  const {store,values}=fixture();store.save({greeting:false});assert.equal(store.reset().saved,true);
  assert.equal(values.has(store.key),false);assert.equal(values.get('unrelated'),'preserved');assert.equal(values.get('plutonium.cursor.aero.v1'),'false');
});
test('new appearance code has no service, token, server-write or account integration',()=>{
  const appearance=source.slice(source.indexOf('// Desktop appearance:'));
  assert.doesNotMatch(appearance,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|\/api\/|\/launch\/|plex|owner.?token|currentUser|innerHTML|localStorage\.clear/i);
  const html=fs.readFileSync(path.join(__dirname,'desktop.html'),'utf8');
  assert.match(html,/<dialog class="appearance-dialog"[^>]+aria-labelledby="appearance-title"/);
  assert.match(html,/id="appearance-status" role="status" aria-live="polite"/);
});

test('speed mapping spans 0–20×, is monotonic and gives finer control near zero',()=>{
  const {appearanceSpeed:toSpeed,appearanceSpeedPosition:toPosition}=vm.runInNewContext(code+';({appearanceSpeed,appearanceSpeedPosition})');
  assert.equal(toSpeed(0),0);assert.equal(toSpeed(1000),20);assert.equal(toPosition(0),0);assert.equal(toPosition(20),1000);
  assert.equal(toSpeed(-5),0);assert.equal(toSpeed(1500),20);
  let previous=-1;
  for(let position=0;position<=1000;position++){const speed=toSpeed(position);assert.ok(speed>previous);assert.ok(speed>=0&&speed<=20);previous=speed;}
  assert.ok(toSpeed(10)-toSpeed(0)<toSpeed(1000)-toSpeed(990));
  for(const speed of [0,0.1,0.25,0.5,1,2,5,10,20])assert.ok(Math.abs(toSpeed(toPosition(speed))-speed)<0.035);
});
test('old appearance values migrate without deleted controls or unknown persisted fields',()=>{
  const {store,values}=fixture(JSON.stringify({speed:2,grain:false,reducedMotion:true,token:'synthetic',greeting:false}));
  const state=store.load();assert.equal(state.speed,2);assert.equal(state.greeting,false);assert.equal(Object.keys(state).length,6);
  store.save(state);assert.doesNotMatch(values.get(store.key),/grain|reducedMotion|token|synthetic/);
});
test('one appearance entry remains; original iOS cursor switch lives only inside the dialog',()=>{
  const html=fs.readFileSync(path.join(__dirname,'desktop.html'),'utf8');
  const account=html.slice(html.indexOf('<dialog class="account-dialog"'),html.indexOf('<dialog class="appearance-dialog"'));
  const appearance=html.slice(html.indexOf('<dialog class="appearance-dialog"'));
  assert.doesNotMatch(account,/aero-cursor-enabled|cursor-preference/);
  assert.match(appearance,/<input type="checkbox" role="switch" id="aero-cursor-enabled"/);
  assert.match(appearance,/class="cursor-switch-track"/);
  assert.equal((html.match(/id="appearance-open"/g)||[]).length,1);
  assert.doesNotMatch(html,/appearance-toolbar|name="grain"|name="reducedMotion"/);
  assert.match(html,/0–20×/);assert.match(html,/name="speed" min="0" max="1000" step="1"/);
  const css=fs.readFileSync(path.join(__dirname,'styles.css'),'utf8');
  assert.match(css,/opacity:\.035;background-image/);assert.doesNotMatch(css,/appearance-no-grain/);
});
function rendererFixture(pixelRatio=1){
  const rendererSource=source.slice(source.indexOf('function createAtomRenderer('),source.indexOf('// End atom renderer.'));
  let image;
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData:p=>{image=new Uint8ClampedArray(p.data);}};
  const canvas={getContext:()=>ctx};
  const renderer=vm.runInNewContext(rendererSource+';createAtomRenderer')(canvas,pixelRatio);
  return {renderer,canvas,pixels:()=>image};
}
test('3D renderer produces projected shaded depth geometry and different rotated views',()=>{
  const f=rendererFixture();const first=f.renderer.render(0,0.6),a=f.pixels();f.renderer.render(1.3,0.6);const b=f.pixels();
  assert.ok(first.triangles>5000);assert.ok(a.some((v,i)=>i%4===3&&v===255));
  assert.notDeepEqual(a,b);assert.equal(a.filter((v,i)=>i%4!==3&&v!==0&&v!==230).length,0);
  f.renderer.render(0,0);const shades=new Set(f.pixels().filter((v,i)=>i%4===0&&v>0));assert.ok(shades.size>40);
});
test('3D resolution and pixel ratio are capped without changing monochrome dither output',()=>{
  for(const ratio of [0.1,1,1.5,2,4]){const f=rendererFixture(ratio);assert.ok(f.renderer.pixelRatio>=1&&f.renderer.pixelRatio<=1.5);assert.ok(f.canvas.width<=330&&f.canvas.height<=270);f.renderer.render(0,1);assert.equal(f.pixels().length,f.canvas.width*f.canvas.height*4);}
});
test('animation guards include system motion, visibility, window focus, intersection and 20fps cap',()=>{
  const runtime=source.slice(source.indexOf('function setupDesktopAppearance('));
  assert.match(runtime,/prefers-reduced-motion: reduce/);assert.match(runtime,/!reduced.matches/);assert.match(runtime,/!doc.hidden&&focused&&visible/);
  assert.match(runtime,/elapsed>=50/);assert.match(runtime,/setTimeout\(tick,50\)/);assert.match(runtime,/addEventListener\('blur'/);assert.match(runtime,/IntersectionObserver/);
  assert.doesNotMatch(runtime,/state\.grain|state\.reducedMotion|appearance-toolbar/);
});
