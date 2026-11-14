'use strict';
const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {randomBytes}=require('node:crypto');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'portal-chat-candidate-'));
fs.copyFileSync(path.join(__dirname,'server.cjs'),path.join(root,'server.cjs'));
fs.cpSync(path.join(__dirname,'public'),path.join(root,'public'),{recursive:true});
// A regression that loads either historical module fails startup, without network/data access.
for(const name of ['plex.cjs','invitation-service.cjs'])fs.writeFileSync(path.join(root,name),"throw new Error('Historical module must stay disconnected');");
const config=path.join(root,'linked-apps.json');
fs.writeFileSync(config,JSON.stringify([{subject:'chat-fixture',username:'adrian',files:'https://cask.plutoniumcloud.com/apps/user_oidc/login/1',photos:'https://photos.plutoniumcloud.com/auth/login?autoLaunch=1'}]));
const key=randomBytes(32).toString('hex');
const actor={'X-Portal-Bridge-Key':key,'X-Authentik-Uid':'chat-fixture','X-Authentik-Username':'adrian','X-Authentik-Groups':'plutonium-members'};
const base='http://127.0.0.1:8782';
let child,connections=0;const forbidden=net.createServer(socket=>{connections++;socket.destroy();});
before(async()=>{
  await new Promise(resolve=>forbidden.listen(0,'127.0.0.1',resolve));
  const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP'].includes(k.toUpperCase())));
  child=spawn(process.execPath,['server.cjs'],{cwd:root,env:{...env,PC_BRIDGE_KEY:key,PC_LINK_CONFIG:config,BIND_ADDRESS:'127.0.0.1',PORT:'8782',PLEX_TOKEN:'synthetic-unused',PLEX_BASE_URL:'http://127.0.0.1:'+forbidden.address().port},stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Candidate startup failed')),6000);child.stdout.once('data',()=>{clearTimeout(timer);resolve();});child.once('error',reject);child.once('exit',()=>{clearTimeout(timer);reject(new Error('Candidate exited'));});});
});
after(async()=>{
  if(child&&child.exitCode===null&&child.signalCode===null){const stopped=new Promise(resolve=>child.once('exit',resolve));child.kill();await stopped;}
  await new Promise(resolve=>forbidden.close(resolve));
  fs.rmSync(root,{recursive:true,force:true,maxRetries:3,retryDelay:100});
});
test('linked pilot receives fixed Files/Photos/Chat embeds and Chat native reconnect destination',async()=>{
  const r=await fetch(base+'/api/me?subject=other&next=https://attacker.invalid',{headers:actor});const text=await r.text();const me=JSON.parse(text);
  assert.deepEqual(me.apps.filter(a=>a.enabled).map(a=>a.id),['files','photos','chat']);
  for(const [id,url] of Object.entries({files:'https://cask.plutoniumcloud.com/apps/files/',photos:'https://photos.plutoniumcloud.com/photos',chat:'https://chat.plutoniumcloud.com/c/new'})){
    const app=me.apps.find(a=>a.id===id);assert.equal(app.embedUrl,url);assert.equal(app.launchPath,'/launch/'+id);assert.equal(app.presentation,'embedded');
  }
  const launch=await fetch(base+'/launch/chat?next=https://attacker.invalid',{headers:actor,redirect:'manual'});assert.equal(launch.status,302);assert.equal(launch.headers.get('location'),'https://chat.plutoniumcloud.com/');
  assert.ok(!text.includes(key));assert.doesNotMatch(text,/synthetic-unused|tokenHash|previewUrl|apiKey|identity_created/);
});
test('foreign subjects, username substitutions, administrators and forged gateway cannot inherit Chat access',async()=>{
  for(const headers of [{...actor,'X-Authentik-Uid':'foreign'},{...actor,'X-Authentik-Username':'other'},{...actor,'X-Authentik-Uid':'foreign','X-Authentik-Groups':'plutonium-members|plutonium-admins'}]){
    const me=await(await fetch(base+'/api/me',{headers})).json();assert.equal(me.apps.some(a=>a.enabled||a.embedUrl),false);
    for(const id of ['chat','files','photos','plex'])assert.equal((await fetch(base+'/launch/'+id,{headers,redirect:'manual'})).status,403);
  }
  assert.equal((await fetch(base+'/launch/chat',{headers:{...actor,'X-Portal-Bridge-Key':'forged'},redirect:'manual'})).status,403);
  assert.equal((await fetch(base+'/launch/chat',{headers:{'X-Portal-Bridge-Key':key},redirect:'manual'})).status,401);
});
test('Cinema remains unassigned despite legacy credential variables and makes no owner-token connection',async()=>{
  for(const headers of [actor,{...actor,'X-Authentik-Groups':'plutonium-members|plutonium-admins'},{...actor,'X-Authentik-Uid':'foreign'}]){
    const me=await(await fetch(base+'/api/me',{headers})).json();const cinema=me.apps.find(a=>a.id==='plex');
    assert.equal(cinema.enabled,false);assert.equal(cinema.embedUrl,undefined);assert.equal(cinema.launchPath,undefined);
    for(const endpoint of ['/api/plex/status','/launch/plex'])assert.equal((await fetch(base+endpoint,{headers,redirect:'manual'})).status,403);
  }
  assert.equal(connections,0);
});
test('private current window modules have proper MIME, scoped framing policy and no public source access',async()=>{
  for(const resource of ['/desktop-window.mjs','/window-model.mjs','/app.js']){
    assert.equal((await fetch(base+resource)).status,403);
    assert.equal((await fetch(base+resource,{headers:{'X-Portal-Bridge-Key':key}})).status,401);
    const r=await fetch(base+resource,{headers:actor});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/javascript/);
    assert.equal(r.headers.get('cache-control'),'no-store');
  }
  for(const resource of ['/plex.cjs','/invitation-service.cjs','/chat-window-source.json','/linked-apps.json'])assert.equal((await fetch(base+resource,{headers:actor})).status,404);
  const policy=(await fetch(base+'/api/me',{headers:actor})).headers.get('content-security-policy');
  assert.match(policy,/frame-src https:\/\/photos\.plutoniumcloud\.com https:\/\/cask\.plutoniumcloud\.com https:\/\/chat\.plutoniumcloud\.com https:\/\/plex\.plutoniumcloud\.com;/);
  assert.match(policy,/frame-ancestors 'none'/);assert.doesNotMatch(policy,/unsafe-inline|auth\.plutoniumcloud\.com/);
  const module=fs.readFileSync(path.join(root,'public/desktop-window.mjs'),'utf8');
  assert.ok(module.includes('https://plex.plutoniumcloud.com/web/index.html'));assert.doesNotMatch(module,/allow-top-navigation|allow-popups-to-escape-sandbox/);
});

test('source manifest records exact candidate LF hashes and retained public derivation',()=>{
  const {createHash}=require('node:crypto');
  const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'chat-window-source.json'),'utf8'));
  const manifestBytes=fs.readFileSync(path.join(__dirname,'chat-window-source.json'));
  const originalManifestHash='c2d53957c51ef527d5fc52d4eecedeec2b6ee5877ed912bacdf9c7cf9eb0b8b9';
  assert.equal(createHash('sha256').update(manifestBytes).digest('hex'),originalManifestHash);
  const derivation=JSON.parse(fs.readFileSync(path.join(__dirname,'chat-window-derivation-2026-11-11.json'),'utf8'));
  assert.equal(derivation.base_manifest_sha256,originalManifestHash);
  assert.equal(derivation.base_commit,'4e197aa89f23fc587c29ef45dd86f5d90d80931e');
  assert.equal(derivation.merged_main,'b32a5c41703874f22c28d44861006b95988c8dd6');
  assert.equal(derivation.deployable,false);
  assert.equal(derivation.original_server.path,'server.cjs');
  assert.equal(derivation.server_before_lf_sha256,manifest.files['server.cjs'].candidate_lf_sha256);
  const originalServer=Buffer.from(derivation.original_server.content_hex,'hex').toString('utf8');
  assert.equal(createHash('sha256').update(originalServer).digest('hex'),derivation.server_before_lf_sha256);
  const currentServer=fs.readFileSync(path.join(__dirname,'server.cjs'),'utf8').replaceAll('\r\n','\n');
  assert.equal(createHash('sha256').update(currentServer).digest('hex'),derivation.server_after_lf_sha256);

  assert.equal(manifest.deployable,false);
  assert.equal(manifest.r03_source,'334af34e96a7426f004f6169041180ecc9f7edc0');
  assert.deepEqual(Object.keys(manifest.files).sort(),['server.cjs','public/app.js','public/desktop-window.mjs','public/desktop.html','public/index.html','public/mark.svg','public/styles.css','public/window-model.mjs'].sort());
  // Retain the original eight-file proof; verify the approved cursor derivation separately.
  const cursorBytes=fs.readFileSync(path.join(__dirname,'cursor-derivation.json'));
  assert.equal(createHash('sha256').update(cursorBytes).digest('hex'),'9f82420d6402eb9a25b74463d667f8338c7f389ed98a824f9c0d42984b2be61a');
  const cursor=JSON.parse(cursorBytes);
  assert.equal(cursor.previous_cursor_derivation_sha256,'2c3f54ca38c3674894c72ad05d25b399f85dc8d161d8f289838c03ea71019dc0');
  assert.equal(cursor.deployable,false);
  assert.equal(cursor.base_commit,'b7149e1ed5cf6836d0486841ebcea996eade3856');
  assert.equal(cursor.base_manifest_sha256,originalManifestHash);
  assert.deepEqual(Object.keys(cursor.before).sort(),['public/app.js','public/desktop.html','public/styles.css']);
  assert.deepEqual(Object.keys(cursor.after_lf_sha256).sort(),Object.keys(cursor.before).sort());
  assert.equal(createHash('sha256').update(fs.readFileSync(path.join(__dirname,'cursor-assets.json'))).digest('hex'),cursor.assets_manifest_sha256);
  assert.equal(cursor.before['public/app.js'].git_blob,'2cd2b21a9b2621bcb7c0eabaf0ebcb721bbf3193');
  assert.equal(cursor.before['public/styles.css'].git_blob,'15f0e8ee77b94ed8aa811f0c54da9e81411f2c74');
  assert.equal(cursor.before['public/desktop.html'].git_blob,'0c315b7807ba16bb02c6bafa83792418592922c9');
  const appearanceBytes=fs.readFileSync(path.join(__dirname,'photos-ui-derivation.json'));
  assert.equal(createHash('sha256').update(appearanceBytes).digest('hex'),'144438ca07160ab1abfbdf288e9ce771d4a39134f7bc76371ce655369b910579');
  const appearance=JSON.parse(appearanceBytes);
  assert.equal(appearance.kind,'portal-photos-appearance-derivation-v1');
  assert.equal(appearance.deployable,false);
  assert.equal(appearance.base_commit,'a139e9b227122655a7c993eebb9ddafd26d081fd');
  assert.equal(appearance.previous_cursor_derivation_sha256,createHash('sha256').update(cursorBytes).digest('hex'));
  assert.deepEqual(Object.keys(appearance.before).sort(),Object.keys(cursor.before).sort());
  assert.deepEqual(Object.keys(appearance.after_lf_sha256).sort(),Object.keys(cursor.before).sort());
  const atomBytes=fs.readFileSync(path.join(__dirname,'atom-ui-derivation.json'));
  assert.equal(createHash('sha256').update(atomBytes).digest('hex'),'9c11788f10df868f16d56a6dfdf01720da7a2e1af9621457ff726a6501e79959');
  const atom=JSON.parse(atomBytes);
  assert.equal(atom.kind,'portal-3d-atom-derivation-v1');
  assert.equal(atom.deployable,false);
  assert.equal(atom.base_commit,'cbec3af9610fbd3641eed3c25161978dbe8b8f11');
  assert.equal(atom.previous_appearance_derivation_sha256,createHash('sha256').update(appearanceBytes).digest('hex'));
  assert.deepEqual(Object.keys(atom.before).sort(),Object.keys(appearance.before).sort());
  assert.deepEqual(Object.keys(atom.after_lf_sha256).sort(),Object.keys(appearance.before).sort());
  for(const [name,previous] of Object.entries(atom.before)){
    const original=Buffer.from(previous.content_hex,'hex');
    assert.equal(createHash('sha256').update(original).digest('hex'),previous.sha256,name);
    assert.equal(previous.sha256,appearance.after_lf_sha256[name],name);
    assert.equal(createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex'),previous.git_blob,name);
    const current=fs.readFileSync(path.join(__dirname,name),'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(current).digest('hex'),atom.after_lf_sha256[name],name);
  }
  for(const [name,previous] of Object.entries(appearance.before)){
    const original=Buffer.from(previous.content_hex,'hex');
    assert.equal(createHash('sha256').update(original).digest('hex'),previous.sha256,name);
    assert.equal(previous.sha256,cursor.after_lf_sha256[name],name);
    assert.equal(createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex'),previous.git_blob,name);
    const current=Buffer.from(atom.before[name].content_hex,'hex').toString('utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(current).digest('hex'),appearance.after_lf_sha256[name],name);
  }
  for(const [name,proof] of Object.entries(cursor.before)){
    const original=Buffer.from(proof.content_hex,'hex');
    assert.equal(createHash('sha256').update(original).digest('hex'),proof.sha256);
    assert.equal(proof.sha256,manifest.files[name].candidate_lf_sha256);
    assert.equal(createHash('sha1').update(Buffer.from('blob '+original.length+'\0')).update(original).digest('hex'),proof.git_blob);
    const candidate=Buffer.from(appearance.before[name].content_hex,'hex').toString('utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(candidate).digest('hex'),cursor.after_lf_sha256[name],name);
  }
  for(const [name,item] of Object.entries(manifest.files)){
    const source=name==='server.cjs'?originalServer:cursor.before[name]?Buffer.from(cursor.before[name].content_hex,'hex').toString('utf8'):fs.readFileSync(path.join(__dirname,name),'utf8').replaceAll('\r\n','\n');
    assert.equal(createHash('sha256').update(source).digest('hex'),item.candidate_lf_sha256,name);
    if(name!=='server.cjs'&&name!=='public/app.js')assert.equal(item.candidate_lf_sha256,item.r03_canonical_lf_sha256,name);
  }
});
