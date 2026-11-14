'use strict';
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {timingSafeEqual}=require('node:crypto');
const bridgeKey=process.env.PC_BRIDGE_KEY;
if(!bridgeKey||bridgeKey.length<40)throw new Error('A private gateway key is required');
const fsSync=require('node:fs');
const linkConfigPath=process.env.PC_LINK_CONFIG||path.join(__dirname,'linked-apps.json');
let linkedAccounts=[];
try{
  const value=JSON.parse(fsSync.readFileSync(linkConfigPath,'utf8'));
  if(!Array.isArray(value))throw new Error();
  for(const item of value){
    if(typeof item.subject!=='string'||!item.subject||item.username!=='adrian'||!/^https:\/\/cask\.plutoniumcloud\.com\/apps\/user_oidc\/login\/[1-9][0-9]*$/.test(item.files)||item.photos!=='https://photos.plutoniumcloud.com/auth/login?autoLaunch=1')throw new Error();
  }
  linkedAccounts=value;
}catch(error){if(error.code!=='ENOENT')throw new Error('Linked service configuration is invalid');}
const port=Number(process.env.PORT||3000);
const bind=process.env.BIND_ADDRESS||'0.0.0.0';
const root=path.join(__dirname,'public');
const publicFiles=new Map([['/','index.html'],['/index.html','index.html'],['/styles.css','styles.css'],['/mark.svg','mark.svg']]);
const privateFiles=new Map([['/desktop','desktop.html'],['/desktop.html','desktop.html'],['/app.js','app.js'],['/desktop-window.mjs','desktop-window.mjs'],['/window-model.mjs','window-model.mjs']]);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.svg':'image/svg+xml'};
const catalog=[
  {id:'files',name:'Files',service:'Nextcloud',description:'Documents. Projects. Everything yours.',group:'personal',state:'Account connection next'},
  {id:'photos',name:'Photos',service:'Immich',description:'A home for the moments you keep.',group:'personal',state:'Account connection next'},
  {id:'plex',name:'Cinema',service:'Plex',description:'Your films, series, and music.',group:'personal',state:'Plex invitation required'},
  {id:'chat',name:'Chat',service:'Plutonium AI',description:'A little room for bigger ideas.',group:'compute',state:'Sign in to Chat'},
  {id:'vms',name:'Machines',service:'Virtual machines',description:'Open a fresh environment.',group:'compute',state:'Machines not created'},
  {id:'desktop',name:'Desktop',service:'Ubuntu workspace',description:'Pick up where you left off.',group:'compute',state:'Administrator gateway pending'}
];
function cleanHeader(value,max=256){return typeof value==='string'&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value)?value:'';}
function verifiedBridge(req){const supplied=cleanHeader(req.headers['x-portal-bridge-key']);const a=Buffer.from(supplied);const b=Buffer.from(bridgeKey);return a.length===b.length&&timingSafeEqual(a,b);}
function identity(req){
  const uid=cleanHeader(req.headers['x-authentik-uid']);
  const username=cleanHeader(req.headers['x-authentik-username']);
  const name=cleanHeader(req.headers['x-authentik-name']);
  const groups=cleanHeader(req.headers['x-authentik-groups'],8192).split('|').filter(Boolean);
  if(!uid||!username||!groups.includes('plutonium-members'))return null;
  return {subject:uid,username,name:name||username,isAdmin:groups.includes('plutonium-admins')};
}
function appsFor(user){
  const linked=linkedAccounts.find(item=>item.subject===user.subject&&item.username===user.username);
  return catalog.filter(app=>app.id!=='desktop'||user.isAdmin).map(app=>{
    if(app.id==='plex')return {...app,enabled:false,state:'Cinema access is not connected'};
    const enabled=Boolean(linked&&['files','photos'].includes(app.id));
    if(app.id==='chat'&&linked)return {...app,enabled:true,state:'Open in your desktop',launchPath:'/launch/chat',presentation:'embedded',embedUrl:'https://chat.plutoniumcloud.com/c/new'};
    return {...app,enabled,...(enabled?{state:'Open in your desktop',launchPath:'/launch/'+app.id,presentation:'embedded',embedUrl:app.id==='photos'?'https://photos.plutoniumcloud.com/photos':'https://cask.plutoniumcloud.com/apps/files/'}:{})};
  });
}

function send(res,status,body,type='application/json; charset=utf-8',head=false){res.writeHead(status,{'Content-Type':type});res.end(head?undefined:typeof body==='string'?body:JSON.stringify(body));}
const server=http.createServer({maxHeaderSize:16384},async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-src https://photos.plutoniumcloud.com https://cask.plutoniumcloud.com https://chat.plutoniumcloud.com https://plex.plutoniumcloud.com; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  if(!['GET','HEAD','POST'].includes(req.method))return send(res,405,{error:'Method not allowed'});
  const head=req.method==='HEAD';
  try{
    const pathname=new URL(req.url,'http://portal.invalid').pathname;
    if(pathname==='/healthz')return send(res,200,{ready:true},undefined,head);
    if(!verifiedBridge(req))return send(res,403,{error:'Private gateway required'},undefined,head);
    // Unfinished onboarding stays unavailable for every identity and method.
    // No module, store, delivery or environment switch is wired here.
    if(pathname==='/invite'||pathname.startsWith('/invite/')||pathname==='/api/users/invitations'||pathname.startsWith('/api/users/invitations/'))return send(res,404,{error:'Not found'},undefined,head);
    if(req.method==='POST')return send(res,405,{error:'Method not allowed'},undefined,head);
    let filename=publicFiles.get(pathname);
    if(!filename){
      const user=identity(req);
      if(!user)return send(res,401,{error:'Authentication required'},undefined,head);
      if(pathname==='/api/me')return send(res,200,{user,apps:appsFor(user)},undefined,head);
      if(pathname==='/api/plex/status'){
        if(!linkedAccounts.some(item=>item.subject===user.subject&&item.username===user.username))return send(res,403,{error:'Cinema access is not connected'},undefined,head);
        return send(res,403,{error:'Cinema access is not connected'},undefined,head);
      }
      if(pathname.startsWith('/launch/')){
        const id=pathname.slice('/launch/'.length);
        const linked=linkedAccounts.find(item=>item.subject===user.subject&&item.username===user.username);
        if(id==='chat'&&linked){res.writeHead(302,{Location:'https://chat.plutoniumcloud.com/'});return res.end();}
        if(!linked||!['files','photos'].includes(id))return send(res,403,{error:'Service account is not connected'},undefined,head);
        res.writeHead(302,{'Location':linked[id]});return res.end();
      }
      filename=privateFiles.get(pathname);
    }
    if(!filename)return send(res,404,{error:'Not found'},undefined,head);
    const body=await fs.readFile(path.join(root,filename));
    res.writeHead(200,{'Content-Type':types[path.extname(filename)]});res.end(head?undefined:body);
  }catch{return send(res,500,{error:'Request could not be completed'},undefined,head);}
});
server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
server.listen(port,bind,()=>console.log('Portal backend ready; identity supplied by private authentication gateway.'));
