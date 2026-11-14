export const MOBILE=640;
export function bounds(view){const gap=view.width<=MOBILE?0:12;const top=Number(view.top)||76;return {x:gap,y:top,width:Math.max(1,view.width-gap*2),height:Math.max(1,view.height-top-86)};}
export function clampRect(rect,area){const width=Math.max(Math.min(360,area.width),Math.min(Number(rect.width)||680,area.width));const height=Math.max(Math.min(260,area.height),Math.min(Number(rect.height)||480,area.height));return {x:Math.max(area.x,Math.min(Number(rect.x)||area.x,area.x+area.width-width)),y:Math.max(area.y,Math.min(Number(rect.y)||area.y,area.y+area.height-height)),width,height};}
export function canSnap(view){return view.width>MOBILE&&bounds(view).width>=728;}
export function displayRect(window,view){const area=bounds(view);if(view.width<=MOBILE||window.mode==='maximized')return area;if(['left','right'].includes(window.mode)&&canSnap(view)){const width=(area.width-8)/2;return {...area,x:window.mode==='right'?area.x+width+8:area.x,width};}return clampRect(window.normal,area);}
export class WindowModel{
 constructor(view){this.view=view;this.windows=new Map();this.active=null;this.sequence=0;}
 open(id,saved={}){if(this.windows.has(id)){this.focus(id);return false;}const area=bounds(this.view);const n=this.windows.size;const reference=this.view.width<=MOBILE?bounds({width:1440,height:1000}):area;let normal=clampRect(saved.normal||{x:reference.x+70+n*42,y:reference.y+48+n*34,width:680,height:490},reference);if(this.view.width<=MOBILE&&saved.normal&&['x','y','width','height'].every(key=>Number.isFinite(saved.normal[key])))normal=Object.fromEntries(['x','y','width','height'].map(key=>[key,saved.normal[key]]));const mode=['normal','maximized','left','right'].includes(saved.mode)?saved.mode:'normal';this.windows.set(id,{id,normal,mode,minimized:false,z:++this.sequence});this.active=id;return true;}
 focus(id){const win=this.windows.get(id);if(!win)return;win.minimized=false;win.z=++this.sequence;this.active=id;}
 nextActive(){this.active=[...this.windows.values()].filter(w=>!w.minimized).sort((a,b)=>b.z-a.z)[0]?.id||null;}
 minimize(id){const w=this.windows.get(id);if(!w)return;w.minimized=true;if(this.active===id)this.nextActive();}
 close(id){this.windows.delete(id);if(this.active===id)this.nextActive();}
 showDesktop(){for(const w of this.windows.values())w.minimized=true;this.active=null;}
 toggleMax(id){const w=this.windows.get(id);if(!w)return;w.mode=w.mode==='maximized'?'normal':'maximized';this.focus(id);}
 snap(id,side){if(!canSnap(this.view))return false;const w=this.windows.get(id);if(!w||!['left','right'].includes(side))return false;w.mode=side;this.focus(id);return true;}
 adjust(id,delta){const w=this.windows.get(id);if(!w||this.view.width<=MOBILE)return;w.mode='normal';w.normal=clampRect({...w.normal,...delta},bounds(this.view));}
 viewport(view){this.view=view;if(view.width>MOBILE)for(const w of this.windows.values())w.normal=clampRect(w.normal,bounds(view));}
 snapshot(){return Object.fromEntries([...this.windows.values()].map(w=>[w.id,{normal:{...w.normal},mode:w.mode}]));}
}
