export const generationEstimate='Usually takes around 10–20 seconds. Busy times may take longer.';

// This is an explicitly estimated display, never a job state or a countdown.
// Queue/generation occupy separate ranges; only a usable result reaches 100%.
export function generationProgressState(job,now=Date.now()){
 if(!job||job.mode!=='live')return null;
 if(job.status==='ready'){
  if(job.resultPhoto)return {value:100,phase:'ready',title:'Your AI image is ready',message:'Preview it before you print.',estimated:false};
  if(job.imageExpired)return null;
  return {value:96,phase:'load',title:'Loading your image…',message:'Your result is saved.',estimated:true};
 }
 if(!['queued','generating'].includes(job.status))return null;
 const since=job.status==='generating'?(job.startedAt??job.paidAt):job.paidAt;
 const elapsed=Number.isFinite(since)&&Number.isFinite(now)?Math.max(0,now-since):0;
 const queued=job.status==='queued';
 const value=queued?Math.min(18,Math.round(8+10*(1-Math.exp(-elapsed/7000)))):Math.min(92,Math.round(22+70*(1-Math.exp(-elapsed/9000))));
 return {value,phase:queued?'queue':'generate',title:queued?'Waiting for your turn':'Creating your look',message:generationWaitMessage(job,now),estimated:true};
}

// Elapsed time never marks a task complete or promises a remaining duration.
export function generationWaitMessage(job,now=Date.now()){
 if(!job||job.mode!=='live'||!['queued','generating'].includes(job.status))return '';
 const since=job.status==='generating'?(job.startedAt??job.paidAt):job.paidAt;
 const elapsed=Number.isFinite(since)?Math.max(0,now-since):0;
 if(job.status==='queued')return elapsed>=30000
  ?'The queue is a little busy. Your place is saved; no need to submit again.'
  :'Your photo is in line. We’ll start as soon as a slot opens.';
 if(elapsed>=30000)return 'This one is taking a little longer. We’re still waiting for your image; no need to submit again.';
 if(elapsed>=10000)return 'Thanks for waiting. A little more patience for a look that’s all yours.';
 return 'Your photo, a little imagination… something uniquely yours is on its way.';
}
