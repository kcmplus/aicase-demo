import test from 'node:test';
import assert from 'node:assert/strict';
import {freshMembership,credits,subscribe,stopRenewal,refreshMembership,addRender,startRender,updateRender,migrateRender} from '../storefront/ai-membership.js';
import {createAIOrder,canApplyAIOrder} from '../storefront/ai-core.js';
import {freshOrders,commitPrintOrder,currentOrder,beginOrderPrint} from '../storefront/print-orders.js';
import {createPersonalPass} from '../storefront/simple-core.js';
const input={photo:'data:image/jpeg;base64,AQID',styleId:'anime',sourceKind:'sample'};
const now=Date.UTC(2026,0,31,12);
function render(a,t=now){const r=addRender(a,input,t);a=startRender(r.account,r.job.id,{accepted:true,now:t});return {a,id:r.job.id};}
test('free trial is reserved once and retries cannot double-charge',()=>{
 const {a,id}=render(freshMembership());assert.equal(credits(a,now).trial,0);assert.equal(a.jobs[id].allocation.type,'trial');
 assert.deepEqual(startRender(a,id,{accepted:true,now}),a);assert.throws(()=>addRender(a,input,now),/Finish/);
 const done=updateRender(a,id,'refresh',now+30000);assert.ok(canApplyAIOrder(done.jobs[id]));
 const next=addRender(done,input,now+31000);assert.throws(()=>startRender(next.account,next.job.id,{accepted:true,now:now+31000}),/No AI/);
});
test('confirmation precedes quota reservation and trial is independent of subscription',()=>{
 assert.throws(()=>subscribe(freshMembership(),{now}),/Confirm/);
 const a=subscribe(freshMembership(),{accepted:true,now}),r=addRender(a,input,now);
 assert.throws(()=>startRender(r.account,r.job.id,{now}),/Confirm/);assert.equal(credits(r.account,now).trial,1);
 const started=startRender(r.account,r.job.id,{accepted:true,now});assert.equal(credits(started,now).monthly,20);
});
test('cancelling queued trials and failed renders restores quota exactly once',()=>{
 let {a,id}=render(freshMembership());a=updateRender(a,id,'cancel',now+1);assert.equal(credits(a,now+1).trial,1);
 assert.deepEqual(updateRender(a,id,'cancel',now+2),a);
 ({a,id}=render(a,now+3));assert.throws(()=>updateRender(a,id,'cancel',now+10003),/started/);
 a=updateRender(a,id,'fail',now+10004);assert.equal(a.jobs[id].payment,'credit_restored');assert.equal(credits(a,now+10004).trial,1);
});
test('20 monthly generations exhaust, renewal does not reset early, next period resets with no rollover',()=>{
 let a=subscribe({...freshMembership(),trialUsed:true},{accepted:true,now});
 for(let n=0;n<20;n++){const r=render(a,now+n*40000);a=updateRender(r.a,r.id,'refresh',now+n*40000+30000);}
 assert.equal(credits(a,now+900000).monthly,0);a=subscribe(a,{accepted:true,now:now+900000});assert.equal(a.subscription.used,20);
 const pending=addRender(a,input,now+900001);assert.throws(()=>startRender(pending.account,pending.job.id,{accepted:true,now:now+900001}),/No AI/);
 const end=Date.UTC(2026,1,28,12);assert.equal(a.subscription.endsAt,end);
 a=refreshMembership(a,end);assert.equal(credits(a,end).monthly,20);assert.equal(a.subscription.endsAt,Date.UTC(2026,2,31,12));
});
test('cancel renewal preserves current allowance, expires at period end; old-period refund never adds new credits',()=>{
 let a=subscribe({...freshMembership(),trialUsed:true},{accepted:true,now}),end=a.subscription.endsAt;
 let r=render(a,end-5000);a=updateRender(r.a,r.id,'cancel',end+1);assert.equal(credits(a,end+1).monthly,20);
 a=stopRenewal(a,end+2);assert.equal(credits(a,end+2).active,true);assert.equal(credits(a,a.subscription.endsAt).active,false);
});
test('legacy unpaid render migrates to credit confirmation without consuming a trial',()=>{
 const old=createAIOrder(input,now),a=migrateRender(freshMembership(),old);assert.equal(a.jobs[old.id].status,'awaiting_confirmation');assert.equal(credits(a,now).trial,1);
});
const pass=()=>createPersonalPass({source:'collection',designId:'bloom',model:'iPhone 16 Pro',effect:'original',intensity:65,zoom:100,x:50,y:50});
test('print payment confirmation creates immutable snapshot and duplicate confirmation creates no extra order',()=>{
 const p=pass();assert.throws(()=>commitPrintOrder(freshOrders(),p),/Confirm/);
 const r=commitPrintOrder(freshOrders(),p,{accepted:true});p.designId='sunset';assert.equal(r.order.pass.designId,'bloom');assert.equal(r.order.priceCents,1000);
 assert.equal(Object.keys(commitPrintOrder(r.book,r.order.pass,{accepted:true}).book.orders).length,1);
});
test('editing a paid unprinted order replaces QR without charging again; stale codes cannot print',()=>{
 let r=commitPrintOrder(freshOrders(),pass(),{accepted:true});const old=r.order.pass.code,id=r.order.id;
 r=commitPrintOrder(r.book,pass(),{accepted:true,editId:id});assert.equal(r.order.id,id);assert.equal(Object.keys(r.book.orders).length,1);assert.equal(r.order.priceCents,1000);
 assert.throws(()=>currentOrder(r.book,old),/replaced/);assert.throws(()=>beginOrderPrint(r.book,old,'DEMO-01'),/replaced/);
});
test('printing locks edits and repeat printing, and unavailable machines cannot lock an order',()=>{
 const r=commitPrintOrder(freshOrders(),pass(),{accepted:true});assert.throws(()=>beginOrderPrint(r.book,r.order.pass.code,'DEMO-03'),/offline/);assert.equal(r.order.status,'paid');
 const started=beginOrderPrint(r.book,r.order.pass.code,'DEMO-01');assert.equal(started.job.pass.code,r.order.pass.code);
 assert.throws(()=>commitPrintOrder(started.book,pass(),{accepted:true,editId:r.order.id}),/started/);
 assert.throws(()=>beginOrderPrint(started.book,r.order.pass.code,'DEMO-01'),/already/);
});
