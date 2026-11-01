import {aiExamples,exampleResult} from './ai-examples.js';
import {aiStyles,bundledExamples,bundledStyles,safeAssetPath,AI_AVAILABLE} from './runtime-catalog.js';
export {aiStyles};
export const AI_PRICE_CENTS=299;
export const AI_SAMPLE_ID='popomo-portrait-v1';
export const AI_SAMPLE_URL='./assets/ai-styles/original.png';
export const DEMO_QUEUE_MS=10000;
export const DEMO_RENDER_MS=20000;
const active=['queued','generating'];
const copy=value=>structuredClone(value);
export function createAIOrder({photo,sourceKind='upload',styleId,exampleId='portrait'},now=Date.now()){
 if(!AI_AVAILABLE)throw Error('AI previews are unavailable. Please reload and try again.');
 if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(photo||'')||photo.length>3_000_000)throw Error('Add a photo before starting an AI render.');
 if(!aiExamples.some(e=>e.id===exampleId))throw Error('Choose an available sample.');
 if(!exampleResult(exampleId,styleId))throw Error('This style is not available for this example.');
 if(!aiStyles.some(s=>s.id===styleId))throw Error('Choose an available AI style.');
 if(!['sample','upload'].includes(sourceKind))throw Error('Unknown photo source.');
 const example=aiExamples.find(e=>e.id===exampleId),style=aiStyles.find(s=>s.id===styleId);
 const sample={name:example.name,name_zh:example.name_zh||'',styleName_zh:style.name_zh||'',original:example.original,result:example.results[styleId],styleName:style.name,styleTag:style.tag};
 return {id:'AI-'+crypto.randomUUID(),version:1,mode:'demo',photo,sourceKind,styleId,exampleId,sample,priceCents:AI_PRICE_CENTS,currency:'USD',status:'awaiting_payment',payment:'unpaid',createdAt:now,paidAt:null,startedAt:null,completedAt:null,result:null,refundedCents:0};
}
export function jobSample(job){
 if(job.sample&&safeAssetPath(job.sample.original)&&safeAssetPath(job.sample.result))return job.sample;
 const example=bundledExamples.find(e=>e.id===(job.exampleId||'portrait')),style=bundledStyles.find(s=>s.id===job.styleId);
 return {name:example?.name||'Saved',original:example?.original||'',result:example?.results[job.styleId]||'',styleName:style?.name||'Saved AI style',styleTag:style?.tag||'AI style'};
}
export function payAIOrder(job,{accepted=false,fail=false,now=Date.now()}={}){
 if(job.payment==='paid'||job.payment==='refunded')return copy(job);
 if(!['awaiting_payment','payment_failed'].includes(job.status))throw Error('This render cannot be paid for.');
 if(!accepted)throw Error('Confirm the additional AI generation fee first.');
 if(fail)return {...copy(job),status:'payment_failed',payment:'unpaid'};
 return {...copy(job),status:'queued',payment:'paid',paidAt:now,startedAt:now+DEMO_QUEUE_MS,completedAt:null};
}
export function refreshAIOrder(job,now=Date.now()){
 if(job.mode==='live')return copy(job); // Live jobs advance only from the server.
 if(!active.includes(job.status))return copy(job);
 if(!['paid','credit_reserved'].includes(job.payment))throw Error('A render cannot start before payment.');
 const finish=job.paidAt+DEMO_QUEUE_MS+DEMO_RENDER_MS;
 if(now>=finish)return {...copy(job),status:'ready',completedAt:finish,result:jobSample(job).result};
 if(now>=job.paidAt+DEMO_QUEUE_MS)return {...copy(job),status:'generating'};
 return copy(job);
}
export function cancelAIOrder(job,now=Date.now()){
 const current=refreshAIOrder(job,now);
 if(!['awaiting_confirmation','awaiting_payment','payment_failed','queued'].includes(current.status))throw Error('Rendering has started. You can leave this page and return when it is ready.');
 return {...current,status:'cancelled',payment:current.payment==='paid'?'refunded':'unpaid',refundedCents:current.payment==='paid'?current.priceCents:0};
}
export function failAIOrder(job,now=Date.now()){
 const current=refreshAIOrder(job,now);
 if(!active.includes(current.status))throw Error('Only an active render can fail.');
 return {...current,status:'failed',payment:'refunded',refundedCents:current.priceCents,result:null};
}
export function canApplyAIOrder(job){
 if(job.mode==='live')return job.status==='ready'&&job.payment==='credit_reserved'&&
  job.result===`/api/v1/store/ai-renders/${job.remoteId}/image/`&&/^data:image\/(jpeg|png|webp);base64,/.test(job.resultPhoto||'');
 return job.status==='ready'&&['paid','credit_reserved'].includes(job.payment)&&safeAssetPath(jobSample(job).result)&&jobSample(job).result===job.result;
}
