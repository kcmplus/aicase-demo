import test from 'node:test';
import assert from 'node:assert/strict';
import {aiRequest,createLiveRender,mergeLiveRender,hydrateLiveImage} from '../storefront/ai-service.js';
import {refreshAIOrder,canApplyAIOrder} from '../storefront/ai-core.js';
import {aiPage} from '../storefront/ai-view.js';
import {freshMembership,refreshMembership} from '../storefront/ai-membership.js';
import {createPersonalPass,readPass} from '../storefront/simple-core.js';
import {generationProgressState} from '../storefront/ai-wait.js';

const photo='data:image/jpeg;base64,AQID';
const job=()=>createLiveRender({photo,styleId:'anime',exampleId:'portrait',model:'iPhone 17'});
const response=j=>({id:'a3333333-1111-4444-8888-abcdef123456',requestKey:j.id.slice(3),mode:'live',status:'queued',payment:'credit_reserved',allocation:{type:'trial'},createdAt:1000,result:null});
test('real jobs never advance on a demo timer or substitute reference images',()=>{
 const pending=job();const queued=mergeLiveRender(pending,response(pending));
 assert.equal(pending.mode,'live');assert.equal(pending.status,'awaiting_confirmation');
 assert.deepEqual(refreshAIOrder(queued,Date.now()+9999999),queued);assert.equal(canApplyAIOrder(queued),false);
 const r={...response(pending),status:'ready',result:'/api/v1/store/ai-renders/a3333333-1111-4444-8888-abcdef123456/image/'};
 const ready=mergeLiveRender(queued,r);assert.equal(canApplyAIOrder(ready),false);
 assert.equal(canApplyAIOrder({...ready,resultPhoto:photo}),true);
 assert.equal(canApplyAIOrder({...ready,resultPhoto:photo,result:pending.sample.result}),false);
});
test('responses must match the saved request and private image route',()=>{
 const j=job();const r=response(j);
 for(const change of [{id:'bad'},{requestKey:crypto.randomUUID()},{mode:'demo'},{status:'complete'},{status:'ready',result:'https://example.com/tracker.png'}])assert.throws(()=>mergeLiveRender(j,{...r,...change}));
});
test('expired server images stop loading while an existing local copy remains usable',async()=>{
 const j=job(),r=response(j);
 const expired=mergeLiveRender(j,{...r,status:'ready',result:`/api/v1/store/ai-renders/${r.id}/image/`,imageExpired:true,imageExpiresAt:12345});
 assert.equal(await hydrateLiveImage(expired),expired);
 const html=aiPage(expired,freshMembership());
 assert.match(html,/Image retention period ended/);
 assert.doesNotMatch(html,/Loading your image|Reload my image|data-ai-action="apply"|STYLE REFERENCE/);
 const local={...expired,resultPhoto:photo};
 assert.equal(await hydrateLiveImage(local),local);
 assert.equal(canApplyAIOrder(local),true);
 assert.match(aiPage(local,freshMembership()),/data-ai-action="apply"/);
});
test('expiry between status polling and image loading becomes an expired state',async t=>{
 t.mock.method(globalThis,'fetch',async()=>({ok:false,status:410,json:async()=>({detail:'Image expired'})}));
 const j=job(),r=response(j);
 const ready=mergeLiveRender(j,{...r,status:'ready',result:`/api/v1/store/ai-renders/${r.id}/image/`});
 const expired=await hydrateLiveImage(ready,globalThis.fetch);
 assert.equal(expired.imageExpired,true);
 assert.equal(expired.status,'ready');
 assert.equal(expired.payment,'credit_reserved');
});
test('result screen shows the actual input and actual generated image',()=>{
 const j=job();const r=response(j);const ready={...mergeLiveRender(j,{...r,status:'ready',result:`/api/v1/store/ai-renders/${r.id}/image/`}),resultPhoto:'data:image/jpeg;base64,BAUG'};
 const html=aiPage(ready,freshMembership());
 assert.ok(html.includes(photo));assert.ok(html.includes(ready.resultPhoto));assert.ok(!html.includes(j.sample.result));
 assert.match(html,/YOUR AI RESULT/);assert.match(html,/Use this look on my case/);assert.doesNotMatch(html,/Live photo generation is not connected|Use this sample instead|Simulate render failure/);
 const failed=aiPage({...j,status:'failed',errorCode:'credit_balance_exhausted',errorMessage:'private provider diagnostics'},freshMembership(),false,{error:'<script>bad</script>'});assert.match(failed,/&lt;script&gt;/);assert.doesNotMatch(failed,/private provider diagnostics/);
});
test('legacy demo records have a path to generate from their original upload',()=>{
 const html=aiPage({...job(),mode:'demo',status:'ready'},freshMembership());
 assert.match(html,/old demo sample/);assert.match(html,/Generate from my photo/);assert.doesNotMatch(html,/data-ai-action="apply"/);
});
test('server allowances are never refreshed from local clocks',()=>{
 const a={...freshMembership(),server:true,subscription:{anchor:1,endsAt:10,renew:true,cycle:0,used:15,monthlyLimit:15}};
 assert.deepEqual(refreshMembership(a,Date.now()),a);
});
test('AI requests carry customer session cookies',async()=>{
 const result=await aiRequest('ai-account/',{key:'a'.repeat(64),fetcher:async(url,options)=>{
  assert.equal(url,'/api/v1/store/ai-account/');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.headers['X-Order-Key'],undefined);return {ok:true,json:async()=>({server:true})};
 }});assert.equal(result.server,true);
 await assert.rejects(()=>aiRequest('ai-account/',{key:'a'.repeat(64),fetcher:async()=>({ok:false,status:503,json:async()=>({detail:'Service unavailable'})})}),/Service unavailable/);
});
test('live image provenance survives a phone case order snapshot',()=>{
 const j=job();const pass=createPersonalPass({source:'photo',designId:'bloom',model:'iPhone 17',photo,effect:'original',intensity:65,zoom:100,x:50,y:50,ai:{mode:'live',styleId:j.styleId,jobId:j.id}});
 assert.equal(readPass(pass.code,structuredClone(pass)).ai.mode,'live');
});
test('active previews never substitute a sample or offer cancellation after generation starts',()=>{
 const j=job();
 const queued=aiPage({...j,status:'queued',payment:'credit_reserved'},freshMembership());
 const running=aiPage({...j,status:'generating',payment:'credit_reserved'},freshMembership());
 assert.match(queued,/Cancel &amp; return generation|Cancel & return generation/);
 assert.doesNotMatch(running,/data-ai-action="cancel"/);
 for(const html of [queued,running]){
  assert.doesNotMatch(html,/STYLE REFERENCE|data-ai-action="apply"|About \d+s|aria-valuenow="100"/);
  assert.match(html,/Estimated progress/);assert.match(html,/role="progressbar"/);
  assert.match(html,/Progress is estimated; completion is confirmed when your image arrives/);
  assert.match(html,/A little magic in progress/);assert.match(html,/Usually takes around 10–20 seconds/);
 }
});
test('estimated progress is monotonic, survives reopening, and never completes a running job',()=>{
 const queued={...job(),status:'queued',paidAt:1000};
 const generating={...queued,status:'generating',startedAt:32000};
 const before=structuredClone(generating);
 assert.equal(generationProgressState(queued,1000).value,8);
 assert.equal(generationProgressState(queued,999999999).value,18);
 assert.ok(generationProgressState(generating,32000).value>18);
 let previous=0;
 for(const elapsed of [0,1000,10000,20000,30000,60000,600000]){
  const value=generationProgressState(generating,32000+elapsed).value;
  assert.ok(value>=previous&&value<=92);previous=value;
 }
 assert.deepEqual(generationProgressState(structuredClone(generating),52000),generationProgressState(generating,52000));
 assert.deepEqual(generating,before);assert.equal(canApplyAIOrder(generating),false);
});
test('100 percent requires a usable result and unsuccessful jobs do not show a meter',()=>{
 const ready={...job(),status:'ready'};
 assert.equal(generationProgressState(ready).value,96);
 assert.equal(generationProgressState({...ready,resultPhoto:photo}).value,100);
 assert.equal(generationProgressState({...ready,imageExpired:true}),null);
 for(const status of ['failed','cancelled','awaiting_confirmation']){
  const j={...job(),status};assert.equal(generationProgressState(j),null);
  assert.doesNotMatch(aiPage(j,freshMembership()),/role="progressbar"/);
 }
 assert.equal(generationProgressState({...job(),mode:'demo',status:'generating'}),null);
 assert.match(aiPage({...ready,resultPhoto:photo},freshMembership()),/aria-valuenow="100"/);
});
test('missing or future timestamps never produce invalid progress or a countdown',()=>{
 for(const startedAt of [undefined,null,Infinity,NaN,999999999]){
  const j={...job(),status:'generating',startedAt,paidAt:null};
  const progress=generationProgressState(j,1000);
  assert.equal(progress.value,22);assert.equal(progress.estimated,true);
  assert.doesNotMatch(progress.message,/\d+ seconds? left/);
 }
});
test('ready previews retain slider endpoints and use each supplied phone mask',()=>{
 for(const [model,template] of [['iPhone 17','iphone-17-a-v1'],['iPhone 16e','iphone-16e-v1']]){
  const j={...job(),model,status:'ready',resultPhoto:photo,payment:'credit_reserved'};
  const html=aiPage(j,freshMembership(),false,{mode:'compare',compare:0});
  assert.match(html,/--reveal:0%/);assert.match(html,/data-ai-view="compare" aria-pressed="true"/);
  assert.ok(html.includes(`data-phone-template="${template}"`));
  assert.match(html,/Original photo visibility/);assert.match(html,/data-ai-pane="case" hidden/);
 }
});
