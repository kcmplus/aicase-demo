import {createAIOrder,refreshAIOrder,cancelAIOrder,failAIOrder} from './ai-core.js';
import {AI_MONTHLY_CENTS,AI_MONTHLY_LIMIT,AI_MONTHLY_PRICE,AI_TRIAL_LIMIT,AI_AVAILABLE} from './runtime-catalog.js';
export {AI_MONTHLY_CENTS,AI_MONTHLY_LIMIT,AI_MONTHLY_PRICE,AI_TRIAL_LIMIT,AI_AVAILABLE};
export const subscriptionLimit=subscription=>subscription?.monthlyLimit??20;
const trialSpent=account=>account.trialCount??(account.trialUsed?1:0);
export const freshMembership=()=>({trialUsed:false,subscription:null,jobs:{}});
// Anchor each billing period to the original UTC day, including short months.
function boundary(start,months){const d=new Date(start),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+months);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return +d;}
export function refreshMembership(value,now=Date.now()){
 const a=structuredClone(value||freshMembership()),s=a.subscription;
 if(a.server)return a; // Quotas and renewal periods are authoritative on the server.
 if(s&&now>=s.endsAt&&s.renew&&AI_AVAILABLE){let cycle=s.cycle+1;while(now>=boundary(s.anchor,cycle+1))cycle++;s.cycle=cycle;s.startsAt=boundary(s.anchor,cycle);s.endsAt=boundary(s.anchor,cycle+1);s.used=0;s.monthlyLimit=AI_MONTHLY_LIMIT;s.priceCents=AI_MONTHLY_CENTS;}
 for(const j of Object.values(a.jobs))if(['queued','generating'].includes(j.status))a.jobs[j.id]=refreshAIOrder(j,now);
 return a;
}
export function credits(value,now=Date.now()){
 const a=refreshMembership(value,now),s=a.subscription;
 if(a.server)return {trial:AI_AVAILABLE&&a.authenticated===true?Math.max(0,Number(a.trialRemaining)||0):0,monthly:a.authenticated===true&&s&&now<s.endsAt?Math.max(0,subscriptionLimit(s)-s.used):0,active:a.authenticated===true&&!!s&&now<s.endsAt};
 return {trial:AI_AVAILABLE?Math.max(0,AI_TRIAL_LIMIT-trialSpent(a)):0,monthly:s&&now<s.endsAt?Math.max(0,subscriptionLimit(s)-s.used):0,active:!!s&&now<s.endsAt};
}
export function subscribe(value,{accepted=false,now=Date.now()}={}){
 if(!AI_AVAILABLE)throw Error('The AI plan is unavailable. Please reload and try again.');
 if(!accepted)throw Error(`Confirm the ${AI_MONTHLY_PRICE} monthly demo subscription first.`);
 const a=refreshMembership(value,now);
 if(a.subscription&&now<a.subscription.endsAt){a.subscription.renew=true;return a;}
 a.subscription={anchor:now,cycle:0,startsAt:now,endsAt:boundary(now,1),used:0,renew:true,monthlyLimit:AI_MONTHLY_LIMIT,priceCents:AI_MONTHLY_CENTS};return a;
}
export function stopRenewal(value,now=Date.now()){const a=refreshMembership(value,now);if(a.subscription)a.subscription.renew=false;return a;}
export function addRender(value,input,now=Date.now()){
 const a=refreshMembership(value,now);
 if(Object.values(a.jobs).some(j=>['awaiting_confirmation','queued','generating'].includes(j.status)))throw Error('Finish or cancel your current render first.');
 const j={...createAIOrder(input,now),version:2,priceCents:0,status:'awaiting_confirmation',allocation:null};a.jobs[j.id]=j;return {account:a,job:j};
}
export function startRender(value,id,{accepted=false,now=Date.now()}={}){
 const a=refreshMembership(value,now),j=a.jobs[id];if(!j)throw Error('This render is missing.');
 if(j.status!=='awaiting_confirmation')return a;
 if(!AI_AVAILABLE)throw Error('AI previews are unavailable. Please reload and try again.');
 if(!accepted)throw Error('Confirm using one AI generation first.');
 if(credits(a,now).trial>0){a.trialCount=trialSpent(a)+1;a.trialUsed=true;j.allocation={type:'trial'};}
 else if(credits(a,now).monthly>0){a.subscription.used++;j.allocation={type:'monthly',period:a.subscription.startsAt};}
 else throw Error('No AI generations remaining. Subscribe or wait for your next monthly reset.');
 Object.assign(j,{status:'queued',payment:'credit_reserved',paidAt:now,startedAt:now+10000});return a;
}
export function updateRender(value,id,action='refresh',now=Date.now()){
 const a=refreshMembership(value,now),j=a.jobs[id];if(!j)throw Error('This render is missing.');
 if(['cancelled','failed'].includes(j.status))return a;
 const changed=action==='cancel'?cancelAIOrder(j,now):action==='fail'?failAIOrder(j,now):refreshAIOrder(j,now);
 if(['cancelled','failed'].includes(changed.status)&&j.payment==='credit_reserved'){
  if(j.allocation?.type==='trial'){a.trialCount=Math.max(0,trialSpent(a)-1);a.trialUsed=a.trialCount>0;}
  if(j.allocation?.type==='monthly'&&a.subscription?.startsAt===j.allocation.period)a.subscription.used=Math.max(0,a.subscription.used-1);
  changed.payment='credit_restored';changed.refundedCents=0;
 }
 a.jobs[id]=changed;return a;
}
export function migrateRender(value,job){const a=structuredClone(value);if(job&&!a.jobs[job.id])a.jobs[job.id]=['awaiting_payment','payment_failed'].includes(job.status)?{...job,version:2,priceCents:0,status:'awaiting_confirmation',payment:'unpaid',allocation:null}:job;return a;}
