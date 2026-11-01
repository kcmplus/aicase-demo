import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {createDemoFetch,freshDemoData} from '../storefront/demo/api.js';
import catalog from '../storefront/demo/catalog.js';
import {applyCatalog} from '../storefront/runtime-catalog.js';
import {createPersonalPass} from '../storefront/simple-core.js';
function fixture(){
 let db=freshDemoData(),time=10000;
 const fetch=createDemoFetch({now:()=>time,mutate:async transform=>{const next=transform(structuredClone(db));db=next;},assetFetch:async path=>new Response(path)});
 const call=async(path,body,method=body?'POST':'GET')=>{const response=await fetch('/api/v1/'+path,{method,...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json()};};
 const login=async(email='demo@example.com')=>{await call('store/customer/send-code/',{email});return call('store/customer/verify/',{email,code:'123456'});};
 return {call,login,fetch,advance:ms=>time+=ms};
}
test('bundled catalog is accepted and every sample exists independently',async()=>{
 applyCatalog(catalog);
 for(const asset of [...catalog.ai_styles.map(s=>s.image_path),...catalog.ai_examples.flatMap(e=>[e.original_path,...e.results.map(r=>r.image_path)])])await access(new URL('../storefront/'+asset.replace(/^\.?\//,''),import.meta.url));
});
test('demo login, profile, sign out and account balances persist',async()=>{
 const f=fixture();await f.call('store/customer/send-code/',{email:'demo@example.com'});
 assert.equal((await f.call('store/customer/verify/',{email:'demo@example.com',code:'000000'})).status,400);
 await f.login();assert.equal((await f.call('store/ai-account/')).data.trialRemaining,3);
 await f.call('store/customer/',{displayName:'Tester'},'PATCH');
 assert.equal((await f.call('store/ai-account/')).data.customer.displayName,'Tester');
 await f.call('store/customer/',null,'DELETE');assert.equal((await f.call('store/ai-account/')).data.authenticated,false);
 await f.login();assert.equal((await f.call('store/ai-account/')).data.customer.displayName,'Tester');
});
test('orders deduplicate, revise, reject stale actions and complete printing',async()=>{
 const f=fixture(),snapshot=createPersonalPass({source:'collection',designId:'bloom',model:'iPhone 17',effect:'original',intensity:0,zoom:100,x:50,y:50});
 const body={request_key:'test-order',accepted:true,snapshot,expected_amount:'9.90'};
 let {data:order}=await f.call('store/orders/',body);
 assert.equal((await f.call('store/orders/',body)).data.reference,order.reference);
 assert.equal((await f.call('store/orders/')).data.results.length,1);
 const path='store/orders/'+order.reference+'/';
 order=(await f.call(path,{accepted:true,revision:1,snapshot:{...snapshot,code:'POP-C-AAAAAAAAAAAAAAAA'}},'PATCH')).data;
 assert.equal((await f.call(path+'actions/',{revision:1,code:snapshot.code,action:'start'})).status,409);
 for(const action of ['start','ready','collect'])order=(await f.call(path+'actions/',{revision:order.revision,code:order.snapshot.code,action,station_id:'DEMO-01'})).data;
 assert.equal(order.status,'completed');
 assert.equal((await f.call(path,{accepted:true,revision:order.revision,snapshot},'PATCH')).status,400);
});
test('AI jobs reserve once, cancel with refund and return bundled samples',async()=>{
 const f=fixture();await f.login();
 const body={request_key:'render-1',accepted:true,style_id:'anime',example_id:'pets'};
 let job=(await f.call('store/ai-renders/',body)).data;
 await f.call('store/ai-renders/',body);assert.equal((await f.call('store/ai-account/')).data.trialRemaining,2);
 await f.call('store/ai-renders/'+job.id+'/',{action:'cancel'});assert.equal((await f.call('store/ai-account/')).data.trialRemaining,3);
 job=(await f.call('store/ai-renders/',{...body,request_key:'render-2'})).data;
 f.advance(2000);assert.equal((await f.call('store/ai-renders/'+job.id+'/')).data.status,'generating');
 f.advance(3000);job=(await f.call('store/ai-renders/'+job.id+'/')).data;
 assert.equal(job.status,'ready');assert.match(await (await f.fetch(job.result)).text(),/pets-anime/);
});
test('subscription and renew toggles stay local; unknown routes fail closed',async()=>{
 const f=fixture();await f.login();
 assert.equal((await f.call('store/ai-account/',{action:'subscribe',accepted:true})).data.subscription.monthlyLimit,15);
 assert.equal((await f.call('store/ai-account/',{action:'stop-renewal',accepted:true})).data.subscription.renew,false);
 assert.equal((await f.call('store/ai-account/',{action:'resume-renewal',accepted:true})).data.subscription.renew,true);
 assert.equal((await f.call('unknown/')).status,404);
});
