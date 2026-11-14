import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WindowModel,bounds,displayRect,clampRect,canSnap} from './public/window-model.mjs';
const view={width:1440,height:1000};
test('untrusted or offscreen saved bounds remain inside the available desktop',()=>{
 for(const rect of [{x:-500,y:-20,width:20000,height:20000},{x:99999,y:99999,width:2,height:2},{x:NaN,y:NaN,width:Infinity,height:-4}]){
  const area=bounds(view), r=clampRect(rect,area);assert.ok(r.x>=area.x&&r.y>=area.y);assert.ok(r.width>=360&&r.height>=260);assert.ok(r.x+r.width<=area.x+area.width);assert.ok(r.y+r.height<=area.y+area.height);
 }
});
test('opening an existing app restores it instead of creating another instance',()=>{
 const wm=new WindowModel(view);assert.equal(wm.open('files'),true);wm.minimize('files');assert.equal(wm.active,null);assert.equal(wm.open('files'),false);assert.equal(wm.windows.size,1);assert.equal(wm.windows.get('files').minimized,false);assert.equal(wm.active,'files');
});
test('minimize and close select the most recently focused visible window',()=>{
 const wm=new WindowModel(view);wm.open('files');wm.open('photos');wm.open('chat');wm.focus('files');wm.minimize('files');assert.equal(wm.active,'chat');wm.close('chat');assert.equal(wm.active,'photos');wm.showDesktop();assert.equal(wm.active,null);assert.equal(wm.windows.size,2);
});
test('maximize and snap preserve normal geometry for restore',()=>{
 const wm=new WindowModel(view);wm.open('files');const original={...wm.windows.get('files').normal};wm.toggleMax('files');assert.deepEqual(displayRect(wm.windows.get('files'),view),bounds(view));wm.toggleMax('files');assert.deepEqual(wm.windows.get('files').normal,original);wm.snap('files','left');const left=displayRect(wm.windows.get('files'),view);wm.snap('files','right');const right=displayRect(wm.windows.get('files'),view);assert.equal(left.width,right.width);assert.ok(left.x+left.width<right.x);assert.deepEqual(wm.windows.get('files').normal,original);
});
test('phone display fills the safe area and preserves an existing desktop layout',()=>{
 const wm=new WindowModel(view);wm.open('photos');const normal={...wm.windows.get('photos').normal};const phone={width:390,height:844};wm.viewport(phone);assert.deepEqual(displayRect(wm.windows.get('photos'),phone),bounds(phone));assert.deepEqual(wm.windows.get('photos').normal,normal);assert.equal(wm.snap('photos','left'),false);wm.viewport(view);assert.deepEqual(displayRect(wm.windows.get('photos'),view),normal);assert.equal(canSnap({width:700,height:900}),false);
});
test('shrinking viewport keeps window controls reachable; saved state contains geometry only',()=>{
 const wm=new WindowModel(view);wm.open('chat');wm.adjust('chat',{x:1100,y:700});const small={width:800,height:600};wm.viewport(small);const r=displayRect(wm.windows.get('chat'),small),a=bounds(small);assert.ok(r.x+r.width<=a.x+a.width);assert.ok(r.y+r.height<=a.y+a.height);assert.deepEqual(Object.keys(wm.snapshot().chat).sort(),['mode','normal']);assert.deepEqual(Object.keys(wm.snapshot().chat.normal).sort(),['height','width','x','y']);
});

test('opening on a phone does not replace a remembered desktop rectangle with phone dimensions',()=>{const saved={normal:{x:700,y:220,width:850,height:600},mode:'normal'};const wm=new WindowModel({width:390,height:844});wm.open('files',saved);assert.deepEqual(wm.windows.get('files').normal,saved.normal);wm.viewport({width:1920,height:1080});assert.deepEqual(displayRect(wm.windows.get('files'),wm.view),saved.normal);});
