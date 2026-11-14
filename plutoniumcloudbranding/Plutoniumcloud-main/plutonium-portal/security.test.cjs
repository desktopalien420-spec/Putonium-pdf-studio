const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'portal-launch-test-'));
// Run without the legacy module: any accidental import fails startup.
fs.copyFileSync(path.join(__dirname,'server.cjs'),path.join(fixture,'server.cjs'));
fs.cpSync(path.join(__dirname,'public'),path.join(fixture,'public'),{recursive:true});
const storePath=path.join(fixture,'invitation-state.json');
const poison=Buffer.from('unknown prior store: never parse, rewrite, or migrate');
fs.writeFileSync(storePath,poison);
const configPath=path.join(fixture,'linked-apps.json');
fs.writeFileSync(configPath,JSON.stringify([{subject:'test-subject-a',username:'adrian',files:'https://cask.plutoniumcloud.com/apps/user_oidc/login/1',photos:'https://photos.plutoniumcloud.com/auth/login?autoLaunch=1'}]));
const key=randomBytes(32).toString('hex');
const base='http://127.0.0.1:8767';
let child;
const member={'X-Portal-Bridge-Key':key,'X-Authentik-Uid':'test-subject-a','X-Authentik-Username':'adrian','X-Authentik-Name':'Adrian','X-Authentik-Groups':'plutonium-members'};
const inviter={...member,'X-Authentik-Groups':'plutonium-members|plutonium-inviters'};
before(async()=>{
  child=spawn(process.execPath,['server.cjs'],{cwd:fixture,env:{...process.env,PC_BRIDGE_KEY:key,PC_LINK_CONFIG:configPath,PC_INVITATIONS_PATH:storePath,PC_INVITATION_DELIVERY:'mock',PC_INVITATIONS_ENABLED:'true',PLEX_TOKEN:'synthetic-unused',PLEX_BASE_URL:'http://127.0.0.1:1',PORT:'8767',BIND_ADDRESS:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Test backend failed to start')),8000);child.once('error',reject);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('exit',code=>reject(new Error('Test backend exited '+code)));});
});
after(async()=>{
  if(child&&child.exitCode===null&&child.signalCode===null){
    const exited=new Promise(resolve=>child.once('exit',resolve));
    child.kill();await exited;
  }
  fs.rmSync(fixture,{recursive:true,force:true,maxRetries:3,retryDelay:100});
});
test('direct requests and forged identity headers cannot bypass private gateway',async()=>{
  for(const url of ['/','/desktop','/api/me']){
    const r=await fetch(base+url,{headers:{'X-Authentik-Uid':'forged','X-Authentik-Username':'akadmin','X-Authentik-Groups':'plutonium-members|plutonium-admins'}});assert.equal(r.status,403);
  }
});
test('gateway key alone is insufficient for personal routes',async()=>{
  const r=await fetch(base+'/api/me',{headers:{'X-Portal-Bridge-Key':key}});assert.equal(r.status,401);
});
test('nonmember identity rejected even behind gateway',async()=>{
  const r=await fetch(base+'/api/me',{headers:{...member,'X-Authentik-Groups':'unrelated'}});assert.equal(r.status,401);
});
test('personal identity is request-scoped and cannot be changed by preview query',async()=>{
  const a=await (await fetch(base+'/api/me?preview=julian',{headers:member})).json();
  const b=await (await fetch(base+'/api/me',{headers:{...member,'X-Authentik-Uid':'test-subject-b','X-Authentik-Username':'julian','X-Authentik-Name':'Julian'}})).json();
  assert.equal(a.user.subject,'test-subject-a');assert.equal(a.user.username,'adrian');assert.equal(b.user.subject,'test-subject-b');assert.equal(b.user.username,'julian');
  assert.equal(a.apps.some(x=>x.id==='desktop'),false);assert.equal(b.apps.some(x=>x.id==='desktop'),false);
});
test('administrator tiles require explicit portal administrator group',async()=>{
  const r=await (await fetch(base+'/api/me',{headers:{...member,'X-Authentik-Username':'akadmin'}})).json();assert.equal(r.user.isAdmin,false);
  const a=await (await fetch(base+'/api/me',{headers:{...member,'X-Authentik-Groups':'plutonium-members|plutonium-admins'}})).json();assert.equal(a.user.isAdmin,true);
});
test('credentials, source files and write endpoints are not served',async()=>{
  for(const endpoint of ['/.env','/server.cjs','/package.json','/../secrets.env'])assert.equal((await fetch(base+endpoint,{headers:member})).status,404);
  assert.equal((await fetch(base+'/api/me',{method:'POST',headers:member,body:'attempt'})).status,405);
  const r=await fetch(base+'/api/me',{headers:member});assert.equal(r.headers.get('cache-control'),'no-store');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);assert.equal(r.headers.get('set-cookie'),null);
});

test('verified linked subject can launch only the fixed service destinations',async()=>{
 for(const [id,destination] of [['files','https://cask.plutoniumcloud.com/apps/user_oidc/login/1'],['photos','https://photos.plutoniumcloud.com/auth/login?autoLaunch=1']]){
  const r=await fetch(base+'/launch/'+id+'?next=https://attacker.invalid',{headers:member,redirect:'manual'});
  assert.equal(r.status,302);assert.equal(r.headers.get('location'),destination);
 }
 const me=await(await fetch(base+'/api/me',{headers:member})).json();
 assert.deepEqual(me.apps.filter(x=>x.enabled).map(x=>x.id),['files','photos','chat']);
 assert.equal((await fetch(base+'/launch/chat',{headers:member,redirect:'manual'})).status,302);
});
test('other subjects, administrator names and anonymous callers cannot inherit account launch rights',async()=>{
 for(const headers of [{},{...member,'X-Portal-Bridge-Key':'forged'},{...member,'X-Authentik-Uid':'another-subject'},{...member,'X-Authentik-Username':'julian'},{...member,'X-Authentik-Uid':'another-subject','X-Authentik-Username':'akadmin','X-Authentik-Groups':'plutonium-members|plutonium-admins'}]){
  const r=await fetch(base+'/launch/files',{headers,redirect:'manual'});assert.notEqual(r.status,302);
 }
 const other=await(await fetch(base+'/api/me',{headers:{...member,'X-Authentik-Uid':'another-subject'}})).json();
 assert.equal(other.apps.some(x=>x.enabled),false);
 assert.equal((await fetch(base+'/linked-apps.json',{headers:member})).status,404);
});

const admin={...member,'X-Authentik-Groups':'plutonium-members|plutonium-admins|plutonium-inviters'};
const invitationPaths=['/invite','/invite/synthetic-token','/api/users/invitations','/api/users/invitations/foreign/revoke','/api/users/invitations/foreign/resend','/api/users/invitations/foreign/retry'];
test('invitation inspection, listing, management and acceptance are unavailable for every identity',async()=>{
  for(const headers of [member,inviter,admin,{...inviter,'X-Authentik-Uid':'foreign-subject'},{'X-Portal-Bridge-Key':key}]){
    for(const endpoint of invitationPaths){
      for(const method of ['GET','HEAD','POST']){
        const r=await fetch(base+endpoint,{headers,method,redirect:'manual'});
        assert.equal(r.status,404,`${method} ${endpoint}`);
        assert.equal(r.headers.get('location'),null);
        assert.equal(r.headers.get('set-cookie'),null);
        assert.equal(await r.text(),method==='HEAD'?'':JSON.stringify({error:'Not found'}));
      }
    }
  }
});
test('missing, wrong-scheme, wrong-port and cross-site origins cannot activate elevated invitation requests',async()=>{
  for(const origin of [undefined,'null','http://desktop.plutoniumcloud.com','https://desktop.plutoniumcloud.com:444','https://attacker.invalid','https://desktop.plutoniumcloud.com']){
    for(const site of ['same-origin','same-site','cross-site','none']){
      const headers={...admin,'Content-Type':'application/json','Sec-Fetch-Site':site,...(origin?{Origin:origin}:{})};
      const r=await fetch(base+'/api/users/invitations',{method:'POST',headers,body:JSON.stringify({email:'synthetic@example.invalid',role:'administrator',quotaProfile:'administrator',applications:['files','photos','chat','plex']})});
      assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'Not found'});
    }
  }
});
test('concurrent create, resend and foreign token requests never persist or advance identity',async()=>{
  const results=await Promise.all(Array.from({length:24},(_,i)=>fetch(base+invitationPaths[i%invitationPaths.length],{method:'POST',headers:i%2?admin:inviter,body:'{"token":"synthetic-only","identity_created":true}'})));
  for(const r of results){assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'Not found'});}
  assert.deepEqual(fs.readFileSync(storePath),poison);
  assert.deepEqual(fs.readdirSync(fixture).sort(),['invitation-state.json','linked-apps.json','public','server.cjs']);
});
test('unknown methods and encoded aliases cannot reach historical invitation code',async()=>{
  for(const method of ['PUT','PATCH','DELETE','OPTIONS'])assert.equal((await fetch(base+'/api/users/invitations',{method,headers:admin})).status,405);
  for(const endpoint of ['/api/users/%69nvitations','/invite%2Fsynthetic-token','/api/users/invitations//foreign/revoke','/api/users/invitations?enable=true']){
    const r=await fetch(base+endpoint,{headers:admin});assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:'Not found'});
  }
});
test('legacy source, stores and provider configuration stay private',async()=>{
  for(const endpoint of ['/invitation-service.cjs','/invitation-state.json','/app-secrets.json','/linked-apps.json','/public/../invitation-service.cjs'])assert.equal((await fetch(base+endpoint,{headers:admin})).status,404);
  const me=await(await fetch(base+'/api/me',{headers:admin})).json();
  assert.deepEqual(Object.keys(me).sort(),['apps','user']);
  assert.doesNotMatch(JSON.stringify(me),/previewUrl|tokenHash|identity_created|provisioning|synthetic-token/);
});
test('desktop and served client contain no invitation controls or request handlers',async()=>{
  const desktop=await(await fetch(base+'/desktop',{headers:admin})).text();
  const app=await(await fetch(base+'/app.js',{headers:admin})).text();
  assert.doesNotMatch(desktop,/users-nav|users-dialog|invite-form|data-users|data-invite/);
  assert.doesNotMatch(app,/api\/users|previewUrl|submitInvitation|invitationAction|usersDialog|users-nav/);
});
