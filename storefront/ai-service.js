import {demoFetch} from './demo/api.js';
import {AI_PROVIDER} from './runtime-catalog.js';
import {createAIOrder} from './ai-core.js';
import {importPhoto} from './simple-upload.js';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function aiRequest(path,{method='GET',body,fetcher=demoFetch,image=false}={}){
 const headers={'Content-Type':'application/json'};
 if(!['GET','HEAD'].includes(method)){
  const csrf=await fetcher('/api/v1/auth/csrf/',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(25000)});
  if(!csrf.ok)throw Error('Sign-in could not be reached. Please try again.');
  headers['X-CSRFToken']=(await csrf.json()).csrfToken;
 }
 const response=await fetcher('/api/v1/store/'+path,{method,credentials:'same-origin',cache:'no-store',
  headers,signal:AbortSignal.timeout(25000),
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 if(response.ok&&image)return response.blob();
 let data;try{data=await response.json();}catch{throw Error('The AI service could not be reached. Please try again.');}
 if(!response.ok){const error=Error(typeof data.detail==='string'?data.detail:Object.values(data).flat().join(' '));error.status=response.status;throw error;}
 return data;
}
export function createLiveRender(input){
 if(!input.model)throw Error('Choose your phone model first.');
 return {...createAIOrder(input),mode:'live',version:3,model:input.model,priceCents:0,
  status:'awaiting_confirmation',payment:'unpaid',allocation:null,remoteId:null,resultPhoto:null};
}
export function mergeLiveRender(job,data){
 if(!uuid.test(data.id)||data.requestKey!==job.id.replace(/^AI-/,''))throw Error('The AI service returned an invalid render.');
 if(!['queued','generating','ready','failed','cancelled'].includes(data.status)||data.mode!=='live')throw Error('The AI service returned an invalid render.');
 const result=data.status==='ready'?`/api/v1/store/ai-renders/${data.id}/image/`:null;
 if(data.result!==result)throw Error('The AI service returned an invalid image.');
 return {...job,remoteId:data.id,mode:'live',status:data.status,payment:data.payment,
  allocation:data.allocation,paidAt:data.createdAt,startedAt:data.startedAt,completedAt:data.completedAt,
  errorCode:data.errorCode,errorMessage:data.errorMessage,result,imageExpired:Boolean(data.imageExpired),imageExpiresAt:data.imageExpiresAt||null};
}
export const getAIAccount=()=>aiRequest('ai-account/');
export const changeAIAccount=(action,accepted)=>aiRequest('ai-account/',{method:'POST',body:{action,accepted}});
export async function hydrateLiveImage(job,fetcher=demoFetch){
 if(job.status==='ready'&&!job.resultPhoto&&!job.imageExpired){
  let blob;
  try{blob=await aiRequest(`ai-renders/${job.remoteId}/image/`,{image:true,fetcher});}
  catch(e){if(e.status===410)return {...job,imageExpired:true};throw e;}
  const photo=await importPhoto(new File([blob],'ai-result.png',{type:blob.type}),{maxEdge:2000,quality:.92});
  if(photo.length>=3_000_000)throw Error('The generated image is too large to apply. Please try again.');
  return {...job,resultPhoto:photo};
 }
 return job;
}
export async function submitLiveRender(job,accepted,fetcher=demoFetch){
 const data=await aiRequest('ai-renders/',{method:'POST',fetcher,body:{request_key:job.id.replace(/^AI-/,''),
  accepted,photo:job.photo,style_id:job.styleId,example_id:job.exampleId,model:job.model,provider:AI_PROVIDER}});
 return hydrateLiveImage(mergeLiveRender(job,data),fetcher);
}
export async function refreshLiveRender(job){
 if(!job.remoteId)return job;
 return hydrateLiveImage(mergeLiveRender(job,await aiRequest(`ai-renders/${job.remoteId}/`)));
}
export async function cancelLiveRender(job){
 if(!job.remoteId)return {...job,status:'cancelled',payment:'unpaid'};
 return mergeLiveRender(job,await aiRequest(`ai-renders/${job.remoteId}/`,{method:'POST',body:{action:'cancel'}}));
}
