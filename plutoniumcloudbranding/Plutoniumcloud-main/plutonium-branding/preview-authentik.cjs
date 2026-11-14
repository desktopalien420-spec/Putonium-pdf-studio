const {chromium}=require('../plutonium-portal-prototype/node_modules/playwright-core');
const fs=require('node:fs/promises');const assert=require('node:assert/strict');
(async()=>{
 const css=await fs.readFile('authentik.css','utf8');const logo='data:image/svg+xml;base64,'+(await fs.readFile('assets/wordmark.svg')).toString('base64');
 const browser=await chromium.launch({executablePath:'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',headless:true,args:['--host-resolver-rules=MAP auth.plutoniumcloud.com 192.168.8.153']});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark',reducedMotion:'reduce'});const page=await context.newPage();const errorTypes=[];
  page.on('pageerror',e=>errorTypes.push(e.name));
  await page.goto('https://auth.plutoniumcloud.com/if/flow/default-authentication-flow/',{waitUntil:'networkidle',timeout:60000});
  await page.getByRole('textbox').first().waitFor({state:'visible',timeout:20000});
  const apply=()=>page.evaluate(({css,logo})=>{
   const sheet=new CSSStyleSheet();sheet.replaceSync(css);let roots=0;
   function walk(root){root.adoptedStyleSheets=[...root.adoptedStyleSheets,sheet];roots++;for(const node of root.querySelectorAll('*')){if(node.shadowRoot)walk(node.shadowRoot);if(node.matches?.('.branding-logo'))node.src=logo;if(node.matches?.('.pf-c-title')&&node.textContent.includes('Welcome to authentik'))node.textContent='Welcome home.';}}
   walk(document);document.title='Plutonium Cloud · local styling preview';return roots;
  },{css,logo});
  const roots=await apply();await page.waitForTimeout(150);await fs.mkdir('artifacts',{recursive:true});
  const result=await page.evaluate(()=>{
   const executor=document.querySelector('ak-flow-executor');const main=executor?.shadowRoot?.querySelector('[part=main]');
   const inputs=[];const buttons=[];function walk(root){for(const el of root.querySelectorAll('*')){if(el.matches('input:not([type=hidden])'))inputs.push({type:el.type,visible:el.getBoundingClientRect().width>0,color:getComputedStyle(el).color});if(el.matches('button[type=submit]'))buttons.push({visible:el.getBoundingClientRect().width>0,color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor});if(el.shadowRoot)walk(el.shadowRoot);}}
   walk(document);return {mainBackground:main?getComputedStyle(main).backgroundColor:null,mainRadius:main?getComputedStyle(main).borderRadius:null,inputs,buttons,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.overflow,false);assert.ok(result.inputs.some(x=>x.visible));assert.ok(result.buttons.some(x=>x.visible));
  await page.screenshot({path:'artifacts/authentik-identification-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await apply();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'artifacts/authentik-identification-phone.png',fullPage:true});
  console.log(JSON.stringify({preview:'Browser-memory styling only; no settings saved and no login submitted',shadowRoots:roots,...result,pageErrorTypes:errorTypes}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.name+': branding preview failed; raw browser details withheld');process.exit(1);});
