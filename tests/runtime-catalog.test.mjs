import test,{beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {applyCatalog,loadCatalog,unavailableCatalog,aiExamples,bundledExamples,bundledStyles,PRINT_PRICE,AI_MONTHLY_PRICE} from '../storefront/runtime-catalog.js';
import {freshMembership,subscribe,credits,addRender,startRender,updateRender,refreshMembership} from '../storefront/ai-membership.js';
import {createAIOrder,payAIOrder,refreshAIOrder,canApplyAIOrder} from '../storefront/ai-core.js';
import {freshOrders,commitPrintOrder} from '../storefront/print-orders.js';
import {createPersonalPass} from '../storefront/simple-core.js';
import {stylePanel,membershipPage,aiPage} from '../storefront/ai-view.js';
import {createLiveRender,submitLiveRender} from '../storefront/ai-service.js';
const fixture=()=>({version:2,plans:[{kind:'print',price:'9.90',currency:'USD',monthly_credits:0,trial_credits:0},{kind:'ai_monthly',price:'5.99',currency:'USD',monthly_credits:15,trial_credits:1}],ai_styles:bundledStyles.map(s=>({code:s.id,name:s.name,image_path:s.image,description:s.description})),ai_examples:bundledExamples.map(e=>({code:e.id,name:e.name,subject:e.subject,original_path:e.original,results:Object.entries(e.results).map(([style_code,image_path])=>({style_code,image_path}))}))});
const input={photo:'data:image/jpeg;base64,AQID',styleId:'anime',exampleId:'pets',sourceKind:'sample'};
const now=Date.UTC(2026,0,31,12);
const pass=()=>createPersonalPass({source:'collection',designId:'bloom',model:'iPhone 16 Pro',effect:'original',intensity:65,zoom:100,x:50,y:50});
beforeEach(()=>applyCatalog(fixture()));
test('consent and submission identify the configured relay without exposing credentials',async t=>{
 const data={...fixture(),ai_generation_connected:true,ai_provider:'ai778'};applyCatalog(data);
 const job=createLiveRender({...input,model:'iPhone 17'});
 const html=aiPage(job,{...freshMembership(),server:true,authenticated:true,trialRemaining:1});
 assert.match(html,/Local demo: shows a preset sample/);
 assert.doesNotMatch(html,/Your photo will be sent to OpenAI/);
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  if(url.endsWith('auth/csrf/'))return {ok:true,json:async()=>({csrfToken:'test-csrf'})};
  const body=JSON.parse(options.body);assert.equal(body.provider,'ai778');assert.equal(body.accepted,true);
  assert.equal(body.photo,input.photo);assert.equal(body.api_key,undefined);
  return {ok:true,json:async()=>({id:'a3333333-1111-4444-8888-abcdef123456',requestKey:job.id.slice(3),mode:'live',status:'queued',result:null})};
 });
 assert.equal((await submitLiveRender(job,true,globalThis.fetch)).status,'queued');
 applyCatalog({...data,ai_provider:'openai'});
 assert.match(aiPage(job,{...freshMembership(),server:true,authenticated:true,trialRemaining:1}),/Your photo is not uploaded or transformed/);
});
test('server prices drive new orders while paid order revisions retain their confirmed price',()=>{
 const first=commitPrintOrder(freshOrders(),pass(),{accepted:true});assert.equal(first.order.priceCents,990);
 const next=fixture();next.plans[0].price='12.50';applyCatalog(next);
 const edited=commitPrintOrder(first.book,pass(),{accepted:true,editId:first.order.id});assert.equal(edited.order.priceCents,990);
 assert.equal(commitPrintOrder(edited.book,pass(),{accepted:true}).order.priceCents,1250);
 unavailableCatalog();assert.throws(()=>commitPrintOrder(freshOrders(),pass(),{accepted:true}),/unavailable/);
 assert.equal(commitPrintOrder(first.book,pass(),{accepted:true,editId:first.order.id}).order.priceCents,990);
});
test('configured monthly allowance is reserved correctly and current subscriptions survive later edits',()=>{
 let a=subscribe({...freshMembership(),trialUsed:true},{accepted:true,now});assert.equal(a.subscription.priceCents,599);
 for(let n=0;n<15;n++){const t=now+n*40000,r=addRender(a,input,t);a=startRender(r.account,r.job.id,{accepted:true,now:t});a=updateRender(a,r.job.id,'refresh',t+30000);}
 assert.equal(credits(a,now+700000).monthly,0);
 const blocked=addRender(a,input,now+700001);assert.throws(()=>startRender(blocked.account,blocked.job.id,{accepted:true,now:now+700001}),/No AI/);
 const changed=fixture();changed.plans[1].monthly_credits=10;changed.plans[1].price='7.99';applyCatalog(changed);
 assert.equal(a.subscription.monthlyLimit,15);
 const renewed=refreshMembership(a,a.subscription.endsAt);assert.equal(credits(renewed,renewed.subscription.startsAt).monthly,10);assert.equal(renewed.subscription.priceCents,799);
});
test('zero and multiple trial credits work, including legacy usage and idempotent refunds',()=>{
 const data=fixture();data.plans[1].trial_credits=0;applyCatalog(data);
 const noTrial=addRender(freshMembership(),input,now);assert.throws(()=>startRender(noTrial.account,noTrial.job.id,{accepted:true,now}),/No AI/);
 data.plans[1].trial_credits=3;applyCatalog(data);let a={...freshMembership(),trialUsed:true};assert.equal(credits(a,now).trial,2);
 const r=addRender(a,input,now);a=startRender(r.account,r.job.id,{accepted:true,now});assert.equal(credits(a,now).trial,1);
 a=updateRender(a,r.job.id,'cancel',now+1);assert.equal(credits(a,now+1).trial,2);assert.deepEqual(updateRender(a,r.job.id,'cancel',now+2),a);
 for(let n=0;n<2;n++){const t=now+100+n*40000,j=addRender(a,input,t);a=startRender(j.account,j.job.id,{accepted:true,now:t});a=updateRender(a,j.job.id,'refresh',t+30000);}
 assert.equal(credits(a,now+90000).trial,0);
});
test('all four examples have three existing effect files and preserve exact render snapshots',async()=>{
 assert.equal(aiExamples.length,4);
 for(const e of aiExamples){assert.equal(Object.keys(e.results).length,3);for(const path of [e.original,...Object.values(e.results)])await access(new URL('../storefront/'+path,import.meta.url));}
 const job=payAIOrder(createAIOrder(input,100),{accepted:true,now:1000});
 const changed=fixture();changed.ai_examples=[];changed.ai_styles=[];applyCatalog(changed);
 const done=refreshAIOrder(JSON.parse(JSON.stringify(job)),31000);assert.equal(done.result,'./assets/ai-styles/pets-anime.png');assert.ok(canApplyAIOrder(done));
 assert.match(aiPage(done,freshMembership()),/Anime portrait/);assert.ok(!canApplyAIOrder({...done,result:'javascript:alert(1)'}));
});
test('catalog load fails closed on network, invalid shape, and unsafe asset paths without partial updates',async()=>{
 const bad=fixture();bad.plans[0].price='8.88';bad.ai_examples[0].original_path='javascript:alert(1)';assert.throws(()=>applyCatalog(bad));assert.equal(PRINT_PRICE,'$9.90');
 assert.equal(await loadCatalog(async()=>({ok:true,json:async()=>bad})),false);assert.throws(()=>subscribe(freshMembership(),{accepted:true}),/unavailable/);assert.equal(aiExamples.length,0);
 assert.equal(await loadCatalog(async()=>{throw Error('offline');}),false);
 assert.equal(await loadCatalog(async(url,opts)=>{assert.equal(url,'/api/v1/catalog/');assert.equal(opts.cache,'no-store');return {ok:true,json:async()=>fixture()};}),true);
 assert.equal(AI_MONTHLY_PRICE,'$5.99');
});
test('the editor defers pricing while plan views retain configured prices and all views escape managed text',()=>{
 const data=fixture();data.ai_examples[0].name='<img onerror=alert(1)>';data.ai_styles[0].name='<script>alert(1)</script>';applyCatalog(data);
 const html=stylePanel({aiExample:'portrait',aiStyle:'anime'},null,true,freshMembership());
 assert.doesNotMatch(html,/\$\d/);assert.match(html,/&lt;script&gt;/);assert.ok(!html.includes('<script>alert'));
 const plan=membershipPage(freshMembership());assert.match(plan,/15 AI generations/);assert.match(plan,/\$5\.99/);assert.match(plan,/\$9\.90 per print/);assert.ok(!plan.includes('20 generations'));
 assert.match(aiPage(null,freshMembership()),/\$5\.99\/month · 15 generations/);
 const disabled=fixture();disabled.plans=[];disabled.ai_examples=[];applyCatalog(disabled);
 assert.match(stylePanel({},null),/No style examples/);assert.ok(!membershipPage(freshMembership()).includes('id="ai-subscription-form"'));
});
test('legacy completed renders and already active subscriptions retain their original metadata',()=>{
 const old={...payAIOrder(createAIOrder({...input,exampleId:'portrait'},100),{accepted:true,now:1000})};delete old.sample;delete old.exampleId;
 const legacy=subscribe(freshMembership(),{accepted:true,now:Date.now()});delete legacy.subscription.monthlyLimit;delete legacy.subscription.priceCents;
 assert.equal(credits(legacy).monthly,20);
 unavailableCatalog();assert.ok(canApplyAIOrder(refreshAIOrder(old,31000)));assert.match(membershipPage(legacy),/20 AI generations/);
});

// Registration promotions can change without editing subscription prices.
test('independent signup allowance overrides legacy plan allowance, including zero',()=>{
 const data=fixture();data.signupCredits=4;data.plans[1].trial_credits=99;applyCatalog(data);
 assert.equal(credits(freshMembership(),now).trial,4);
 data.signupCredits=0;applyCatalog(data);assert.equal(credits(freshMembership(),now).trial,0);
 data.signupCredits=-1;assert.throws(()=>applyCatalog(data),/Invalid signup/);
});
