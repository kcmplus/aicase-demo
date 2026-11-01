import test from 'node:test';
import assert from 'node:assert/strict';
import {customerRequest,customerPage} from '../storefront/customer-account.js';
import {credits} from '../storefront/ai-membership.js';
import {aiRequest} from '../storefront/ai-service.js';

test('guest cannot claim local trial credits and registered allowance is server-owned',()=>{
 assert.equal(credits({server:true,authenticated:false,trialRemaining:20}).trial,0);
 assert.equal(credits({server:true,authenticated:true,trialRemaining:2,trialCount:0}).trial,2);
 const page=customerPage({authenticated:false,signupCredits:3},{email:'"><script>alert(1)</script>',codeSent:false});
 assert.match(page,/One-time welcome gift/);assert.match(page,/3 <span>AI generations/);assert.doesNotMatch(page,/<script>/);
});
test('email sign-in and AI mutations include CSRF and session cookies',async()=>{
 for(const send of [fetcher=>customerRequest('verify/',{method:'POST',body:{code:'123456'},fetcher}),fetcher=>aiRequest('ai-renders/',{method:'POST',body:{accepted:true},key:'a'.repeat(64),fetcher})]){
  const calls=[];await send(async(url,options)=>{calls.push(url);assert.equal(options.credentials,'same-origin');if(url.endsWith('csrf/'))return {ok:true,json:async()=>({csrfToken:'csrf-token'})};assert.equal(options.headers['X-CSRFToken'],'csrf-token');return {ok:true,json:async()=>({})};});
  assert.equal(calls.length,2);assert.equal(calls[0],'/api/v1/auth/csrf/');
 }
});
test('expired codes show server feedback and email values remain escaped',async()=>{
 await assert.rejects(customerRequest('',{fetcher:async()=>({ok:false,status:400,json:async()=>({detail:'Code expired'})})}),/Code expired/);
 const page=customerPage({authenticated:true,customer:{email:'<b>@example.com'},trialRemaining:2},{next:'choose'});
 assert.match(page,/&lt;b&gt;@example.com/);assert.match(page,/Sign out/);assert.doesNotMatch(page,/customer-email-form/);
});

test('signed-in profile shows server balances and escapes names without exposing staff fields',()=>{
 const page=customerPage({server:true,authenticated:true,customer:{email:'hello@example.com',displayName:'<script>bad()</script>',joinedAt:'2026-10-29T01:00:00Z'},trialRemaining:7,subscription:{endsAt:Date.now()+3600000,used:2,monthlyLimit:10}},{});
 assert.match(page,/customer-profile-form/);assert.match(page,/Gift generations remaining/);assert.match(page,/>7<\/strong>/);assert.match(page,/>8<\/strong>/);
 assert.match(page,/Member since/);assert.doesNotMatch(page,/<script>/);assert.doesNotMatch(page,/name="(?:email|active|notes)"/);
});

test('credit activity shows pool, signed changes and balance without rendering private reasons',()=>{
 const page=customerPage({authenticated:true,customer:{email:'test@example.com'},trialRemaining:2},{ledgerOpen:true,ledger:[{id:1,kind:'grant',pool:'gift',amount:3,balanceAfter:4,createdAt:'2026-10-29T08:00:00Z',reason:'PRIVATE STAFF NOTE',actorName:'private-admin',renderId:'<script>bad()</script>'}],ledgerNext:1});
 assert.match(page,/Credit activity/);assert.match(page,/Extra credits/);assert.match(page,/>\+3</);assert.match(page,/>Balance<\/span> 4/);assert.match(page,/Load earlier activity/);assert.doesNotMatch(page,/PRIVATE STAFF NOTE|private-admin|<script>/);
});
