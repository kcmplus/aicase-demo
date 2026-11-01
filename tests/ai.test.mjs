import test from 'node:test';
import assert from 'node:assert/strict';
import {createAIOrder,payAIOrder,refreshAIOrder,cancelAIOrder,failAIOrder,canApplyAIOrder} from '../storefront/ai-core.js';
import {createPersonalPass,readPass,startPrint} from '../storefront/simple-core.js';
const input=()=>({photo:'data:image/jpeg;base64,AQID',styleId:'anime',sourceKind:'sample'});
const paid=()=>payAIOrder(createAIOrder(input(),100),{accepted:true,now:1000});
test('every render requires explicit confirmation of the $2.99 extra',()=>{
 const order=createAIOrder(input(),100);assert.equal(order.priceCents,299);assert.equal(order.status,'awaiting_payment');
 assert.throws(()=>payAIOrder(order),/Confirm/);assert.equal(refreshAIOrder(order,900000).status,'awaiting_payment');assert.equal(canApplyAIOrder(order),false);
});
test('declined payments never enter the queue, and a retry pays only once',()=>{
 const declined=payAIOrder(createAIOrder(input()),{accepted:true,fail:true,now:1000});
 assert.equal(declined.payment,'unpaid');assert.equal(declined.status,'payment_failed');assert.equal(refreshAIOrder(declined,900000).result,null);
 const success=payAIOrder(declined,{accepted:true,now:2000});assert.equal(success.status,'queued');assert.deepEqual(payAIOrder(success,{accepted:true,now:3000}),success);
});
test('queue restoration is based on persisted time, with results unavailable before completion',()=>{
 const order=JSON.parse(JSON.stringify(paid()));
 assert.equal(refreshAIOrder(order,10999).status,'queued');assert.equal(refreshAIOrder(order,11000).status,'generating');
 assert.equal(canApplyAIOrder(refreshAIOrder(order,30999)),false);
 const result=refreshAIOrder(order,31000);assert.equal(result.status,'ready');assert.equal(canApplyAIOrder(result),true);assert.equal(result.result,'./assets/ai-styles/anime.png');assert.equal(order.result,null);
});
test('cancellation refunds paid queued jobs, but cannot cancel an already started render',()=>{
 const cancelled=cancelAIOrder(paid(),10999);assert.equal(cancelled.payment,'refunded');assert.equal(cancelled.refundedCents,299);assert.equal(refreshAIOrder(cancelled,900000).status,'cancelled');
 assert.deepEqual(payAIOrder(cancelled,{accepted:true}),cancelled);assert.equal(canApplyAIOrder(cancelled),false);
 assert.throws(()=>cancelAIOrder(paid(),11000),/started/);
 assert.equal(cancelAIOrder(createAIOrder(input()),1000).refundedCents,0);
});
test('failed renders refund the demo fee and a new attempt gets a new unpaid order',()=>{
 const failed=failAIOrder(paid(),12000);assert.equal(failed.status,'failed');assert.equal(failed.refundedCents,299);assert.equal(canApplyAIOrder(failed),false);
 const retry=createAIOrder(input());assert.notEqual(retry.id,failed.id);assert.equal(retry.payment,'unpaid');
});
test('order source snapshot stays unchanged and invalid inputs are rejected',()=>{
 const draft=input(),job=createAIOrder(draft);draft.photo='data:image/jpeg;base64,BAUG';draft.styleId='realism';
 assert.equal(job.photo,'data:image/jpeg;base64,AQID');assert.equal(job.styleId,'anime');
 for(const change of [{photo:''},{photo:'javascript:alert(1)'},{styleId:'bogus'},{sourceKind:'unknown'}])assert.throws(()=>createAIOrder({...input(),...change}));
 assert.throws(()=>refreshAIOrder({...paid(),payment:'unpaid'}),/before payment/);
});
test('applied sample provenance survives the design pass and station snapshot',()=>{
 const pass=createPersonalPass({source:'photo',designId:'bloom',model:'iPhone 16 Pro',photo:input().photo,effect:'original',intensity:65,zoom:100,x:50,y:50,ai:{mode:'demo',styleId:'anime',jobId:'AI-test'}});
 const restored=readPass(pass.code,JSON.parse(JSON.stringify(pass)));
 assert.equal(restored.ai.styleId,'anime');assert.equal(startPrint(restored,'DEMO-01').pass.ai.mode,'demo');
});

test('new subject examples keep the chosen sample through payment, restoration and result application',()=>{
 for(const [exampleId,styleId] of [['pets','3d'],['couples','anime'],['travel','realism']]){
  const selection={...input(),exampleId,styleId};
  const order=createAIOrder(selection,100);selection.exampleId='portrait';
  const paidOrder=payAIOrder(order,{accepted:true,now:1000});
  const result=refreshAIOrder(JSON.parse(JSON.stringify(paidOrder)),31000);
  assert.equal(result.exampleId,exampleId);assert.equal(result.styleId,styleId);
  assert.equal(result.result,`./assets/ai-styles/${exampleId}-${styleId}.png`);assert.equal(canApplyAIOrder(result),true);
  assert.equal(canApplyAIOrder({...result,result:'./assets/ai-styles/anime.png'}),false);
 }
});
test('unknown samples and unavailable sample/style pairs cannot create a demo order',()=>{
 assert.throws(()=>createAIOrder({...input(),exampleId:'unknown'}));
 assert.throws(()=>createAIOrder({...input(),exampleId:'pets',styleId:'missing'}));
});
test('older portrait orders without example metadata still finish correctly',()=>{
 const old=paid();delete old.exampleId;
 const restored=refreshAIOrder(old,31000);assert.equal(restored.result,'./assets/ai-styles/anime.png');assert.equal(canApplyAIOrder(restored),true);
});
