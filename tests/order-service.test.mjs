import test from 'node:test';
import assert from 'node:assert/strict';
import {orderAccessKey,orderRequest,savedOrder,checkoutBody,checkoutEmailField,getPaymentConfig,stripeCheckoutUrl} from '../storefront/order-service.js';
import {createPersonalPass} from '../storefront/simple-core.js';
import {phone} from '../storefront/art.js';
import {makePersonalDesign} from '../storefront/simple-personalize.js';
const pass=()=>createPersonalPass({source:'collection',designId:'bloom',model:'iPhone 16 Pro',effect:'original',intensity:65,zoom:100,x:50,y:50});
test('a browser keeps one unguessable order key and surfaces storage failure',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const key=orderAccessKey(storage);assert.match(key,/^[a-f0-9]{64}$/);assert.equal(orderAccessKey(storage),key);
 assert.throws(()=>orderAccessKey({getItem:()=>null,setItem:()=>{throw Error('storage blocked')}}),/storage blocked/);
});
test('checkout retries reuse the draft key and contain no trusted status or amount override',()=>{
 const draft={requestKey:crypto.randomUUID(),pass:pass()};
 const body=checkoutBody(draft,{accepted:true,amount:'9.90'});
 assert.deepEqual(body,checkoutBody(draft,{accepted:true,amount:'9.90'}));
 assert.equal(body.expected_amount,'9.90');assert.equal(body.status,undefined);assert.equal(body.amount,undefined);
});
test('server response keeps charged price and retires the previous design code',()=>{
 const original=pass(),next=pass(),data={reference:crypto.randomUUID(),snapshot:original,status:'paid',amount:'9.90',currency:'USD',mode:'demo',revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 const first=savedOrder(data);const revision=savedOrder({...data,snapshot:next,status:'completed',revision:4},first);
 assert.equal(revision.priceCents,990);assert.equal(revision.status,'collected');assert.equal(revision.pass.code,next.code);assert.deepEqual(revision.oldCodes,[original.code]);
});
test('order network failures never fabricate a paid result',async()=>{
 await assert.rejects(orderRequest('',{key:'a'.repeat(64),fetcher:async()=>{throw Error('offline')}}),/offline/);
 await assert.rejects(orderRequest('',{key:'a'.repeat(64),fetcher:async()=>({ok:false,status:409,json:async()=>({detail:'Price changed'})})}),/Price changed/);
 await assert.rejects(orderRequest('',{key:'a'.repeat(64),fetcher:async()=>({json:async()=>{throw Error()}})}),/temporarily unavailable/);
});
test('order writes carry customer session and CSRF while retaining browser ownership',async()=>{
 const calls=[];await orderRequest('example/',{key:'b'.repeat(64),method:'PATCH',body:{revision:1},fetcher:async(url,options)=>{calls.push({url,...options});return {ok:true,json:async()=>({csrfToken:'test-csrf'})}}});
 const [csrf,sent]=calls;assert.equal(csrf.url,'/api/v1/auth/csrf/');assert.equal(csrf.credentials,'same-origin');
 assert.equal(sent.credentials,'same-origin');assert.equal(sent.cache,'no-store');assert.equal(sent.headers['X-Order-Key'],'b'.repeat(64));assert.equal(sent.headers['X-CSRFToken'],'test-csrf');assert.equal(JSON.parse(sent.body).revision,1);
});
test('signed-in checkout displays email without input and sends expected identity only',()=>{
 const account={authenticated:true,customer:{id:crypto.randomUUID(),email:'member@example.com'}};
 const body=checkoutBody({requestKey:crypto.randomUUID(),pass:pass()},{account,accepted:true,email:'other@example.com',amount:'10.00'});
 assert.equal(body.customer_id,account.customer.id);assert.equal(Object.hasOwn(body,'customer_email'),false);
 const html=checkoutEmailField(account);assert.match(html,/member@example.com/);assert.doesNotMatch(html,/<input/);
 assert.doesNotMatch(checkoutEmailField({...account,customer:{...account.customer,email:'<script>test</script>'}}),/<script>/);
});
test('guest checkout retains optional manual email without claiming an account',()=>{
 for(const account of [undefined,{authenticated:false,customer:{id:'stale',email:'stale@example.com'}}]){
  const body=checkoutBody({requestKey:crypto.randomUUID(),pass:pass()},{account,accepted:true,email:'guest@example.com',amount:'10.00'});
  assert.equal(body.customer_id,null);assert.equal(body.customer_email,'guest@example.com');
  const html=checkoutEmailField(account);assert.match(html,/<input name="email"/);assert.doesNotMatch(html,/required|stale@example.com/);
 }
});
test('unavailable sign-in check stops checkout before sending the order',async()=>{
 const calls=[];
 await assert.rejects(orderRequest('',{method:'POST',body:{},key:'a'.repeat(64),fetcher:async url=>{calls.push(url);return {ok:false}}}),/sign-in could not be checked/);
 assert.deepEqual(calls,['/api/v1/auth/csrf/']);
});
test('the shared admin/order renderer escapes customer text',()=>{
 const snapshot=pass();snapshot.addedArtwork=[{id:'extra-text',type:'text',text:'<script>alert(1)</script>',font:'serif',color:'#123456',x:50,y:50,scale:100,rotation:0}];
 const html=phone(makePersonalDesign(snapshot),snapshot.model);
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));
});

test('Stripe state stays unpaid until the server confirms payment',()=>{
 const data={reference:crypto.randomUUID(),snapshot:pass(),status:'pending',amount:'10.00',currency:'USD',mode:'stripe_live',revision:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
 assert.equal(savedOrder(data).status,'pending');assert.equal(savedOrder(data).mode,'stripe_live');
 assert.equal(savedOrder({...data,status:'paid'}).status,'paid');
 const body=checkoutBody({requestKey:crypto.randomUUID(),pass:pass()},{accepted:true,amount:'10.00',provider:'stripe',mode:'test'});
 assert.equal(body.payment_provider,'stripe');assert.equal(body.payment_mode,'test');
});
test('payment config failure cannot silently select demo payment',async()=>{
 await assert.rejects(getPaymentConfig(async()=>({ok:false})),/could not be loaded/);
 await assert.rejects(getPaymentConfig(async()=>({ok:true,json:async()=>({})})),/Invalid payment settings/);
 assert.deepEqual(await getPaymentConfig(async()=>({ok:true,json:async()=>({provider:'stripe',mode:'test',available:true})})),{provider:'stripe',mode:'test',available:true});
});
test('redirect only accepts Stripe hosted checkout',()=>{
 assert.equal(stripeCheckoutUrl('https://checkout.stripe.com/c/pay/test'),'https://checkout.stripe.com/c/pay/test');
 for(const url of ['javascript:alert(1)','https://evil.test','http://checkout.stripe.com/pay','https://checkout.stripe.com.evil.test','https://user@checkout.stripe.com/pay'])assert.throws(()=>stripeCheckoutUrl(url));
});
