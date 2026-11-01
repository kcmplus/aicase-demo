import {createPersonalPass} from './simple-core.js';
import {DeviceError,normalizeScan,validateStation,validateOrder,validateJob,assertPrintable,validateQueue} from './device-core.js';

export const demoCodes={iphone17:'POP-C-1717171717171717',iphone16e:'POP-C-1616161616161616'};
const isDemoCode=code=>Object.values(demoCodes).includes(code)||/^POP-C-D[A-F0-9]{15}$/.test(code);
const methods=['connect','lookup','start','getJob','collect'];
export function createDeviceClient({mode='demo',stationId,adapter,storage,now=Date.now,timeout=15000}={}){
 const isDemo=mode==='demo';
 const transport=isDemo?createDemoQueueAdapter({stationId,storage,now}):adapter;
 const configured=transport&&[1,2].includes(transport.version)&&methods.every(name=>typeof transport[name]==='function');
 async function call(name,input={}){
  if(!configured||typeof transport[name]!=='function')throw new DeviceError('NOT_CONNECTED');
  let timer;
  try{
   return await Promise.race([Promise.resolve().then(()=>transport[name]({...input,stationId})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new DeviceError('CONNECTION')),timeout);})]);
  }catch(error){throw new DeviceError(['INVALID_CODE','NOT_FOUND','UNPAID','REPLACED','CANCELLED','ALREADY_COLLECTED','ALREADY_STARTED','OUT_OF_STOCK','OFFLINE','BUSY','DEVICE_ERROR','NOT_CONNECTED','CONNECTION','QUEUE_TURN','QUEUE_FULL'].includes(error?.code)?error.code:'CONNECTION');}
  finally{clearTimeout(timer);}
 }
 return {
  isDemo,
  supportsQueue:transport?.version===2&&['getQueue','enqueue','defer'].every(name=>typeof transport[name]==='function'),
  getQueue:async()=>validateQueue(await call('getQueue'),stationId),
  enqueue:async raw=>validateQueue(await call('enqueue',{code:normalizeScan(raw)}),stationId),
  defer:async code=>validateQueue(await call('defer',{code}),stationId),
  enqueueSample:async()=>{if(!isDemo)throw new DeviceError('NOT_CONNECTED');return validateQueue(await call('enqueueSample'),stationId);},
  connect:async()=>validateStation(await call('connect'),stationId),
  lookup:async raw=>{const code=normalizeScan(raw);return validateOrder(await call('lookup',{code}),code);},
  start:async request=>{const job=validateJob(await call('start',request));if(job.order.id!==request.orderId||job.order.snapshot.code!==request.code)throw new DeviceError('INVALID_RESPONSE');return job;},
  getJob:async jobId=>{const job=validateJob(await call('getJob',{jobId}));if(job.id!==jobId)throw new DeviceError('INVALID_RESPONSE');return job;},
  collect:async jobId=>{const job=validateJob(await call('collect',{jobId}));if(job.id!==jobId||job.status!=='completed')throw new DeviceError('INVALID_RESPONSE');return job;},
 };
}

export function createDemoAdapter({stationId='DEMO-01',storage,now=Date.now}={}){
 const key='popomo-demo-device-demo-v1:'+stationId;
 let jobs=Object.create(null);
 try{
  const saved=JSON.parse(storage?.getItem(key));
  if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const [token,record] of Object.entries(saved)){
   if(/^[a-zA-Z0-9_-]{1,100}$/.test(token)&&record&&/^JOB-[a-zA-Z0-9_-]+$/.test(record.id)&&isDemoCode(record.code)&&Number.isFinite(record.startedAt)&&typeof record.collected==='boolean')jobs[token]={id:record.id,code:record.code,startedAt:record.startedAt,collected:record.collected};
  }
 }catch{}
 const persist=()=>{try{storage?.setItem(key,JSON.stringify(jobs));}catch{}};
 const fixture=code=>{
  if(!isDemoCode(code))throw new DeviceError('NOT_FOUND');const first=code===demoCodes.iphone17||(code.startsWith('POP-C-D')&&parseInt(code.at(-1),16)%2===0);
  const pass=createPersonalPass({source:'collection',designId:first?'bloom':'abstract',model:first?'iPhone 17':'iPhone 16e',effect:'original',intensity:0,zoom:100,x:50,y:50});pass.code=code;
  return {id:code.startsWith('POP-C-D')?'SAMPLE-'+code.slice(6):first?'SAMPLE-17':'SAMPLE-16E',revision:1,status:'paid',amountCents:990,currency:'USD',snapshot:pass};
 };
 const result=record=>{
  if(!record||!isDemoCode(record.code)||!Number.isFinite(record.startedAt))throw new DeviceError('NOT_FOUND');
  const elapsed=Math.max(0,now()-record.startedAt),status=record.collected?'completed':elapsed>=16000?'ready':'printing';
  return {id:record.id,status,phase:elapsed<4000?'preparing':elapsed<12000?'printing':'finishing',progress:status==='printing'?Math.min(99,Math.floor(elapsed/160)):100,order:{...fixture(record.code),status,revision:2,jobId:record.id}};
 };
 const station=()=>({id:stationId,name:'POPOMO Station',status:Object.values(jobs).some(j=>['printing','ready'].includes(result(j).status))?'busy':'ready',availableModels:['iPhone 17','iPhone 16e']});
 return {
  version:1,
  connect(){const active=Object.values(jobs).find(j=>['printing','ready'].includes(result(j).status));return {...station(),...(active?{activeJobId:active.id}:{})};},
  lookup({code}){const order=fixture(code),existing=Object.values(jobs).find(j=>j.code===code);return existing?result(existing).order:order;},
  start({code,orderId,revision,idempotencyKey}){
   if(!/^[a-zA-Z0-9_-]{1,100}$/.test(idempotencyKey||''))throw new DeviceError('REPLACED');
   const existing=jobs[idempotencyKey];if(existing){if(existing.code!==code||fixture(code).id!==orderId)throw new DeviceError('REPLACED');return result(existing);}
   const order=this.lookup({code});assertPrintable(order,station());if(order.id!==orderId||order.revision!==revision)throw new DeviceError('REPLACED');
   const record={id:'JOB-'+crypto.randomUUID(),code,startedAt:now(),collected:false};jobs[idempotencyKey]=record;persist();return result(record);
  },
  getJob({jobId}){return result(Object.values(jobs).find(j=>j.id===jobId));},
  collect({jobId}){
   const record=Object.values(jobs).find(j=>j.id===jobId),job=result(record);
   if(!['ready','completed'].includes(job.status))throw new DeviceError('DEVICE_ERROR');
   record.collected=true;persist();return result(record);
  },
 };
}

// A local queue demonstrator. Production queue ownership belongs to the server.
export function createDemoQueueAdapter({stationId='DEMO-01',storage,now=Date.now}={}){
 const base=createDemoAdapter({stationId,storage,now}),key='popomo-demo-device-queue-v1:'+stationId;
 let items=[],counter=0,calledCode='',calledAt=0;
 try{
  const saved=JSON.parse(storage?.getItem(key));
  if(Array.isArray(saved?.items)&&Number.isSafeInteger(saved.counter)&&saved.counter>=0){
   const seen=new Set();
   items=saved.items.filter(item=>item&&isDemoCode(item.code)&&/^A\d{3,6}$/.test(item.ticket)&&!seen.has(item.code)&&seen.add(item.code)).slice(0,100).map(({code,ticket})=>({code,ticket}));
   counter=Math.max(saved.counter,...items.map(item=>Number(item.ticket.slice(1))));
   if(typeof saved.calledCode==='string'&&Number.isFinite(saved.calledAt)){calledCode=saved.calledCode;calledAt=saved.calledAt;}
  }
 }catch{}
 const persist=()=>{try{storage?.setItem(key,JSON.stringify({items,counter,calledCode,calledAt}));}catch{}};
 function getQueue(){
  items=items.filter(item=>!['completed','cancelled'].includes(base.lookup({code:item.code}).status));
  const station=base.connect(),active=station.activeJobId?base.getJob({jobId:station.activeJobId}):null;
  if(active){calledCode='';calledAt=0;}
  else if(items.length){
   if(calledCode!==items[0].code){calledCode=items[0].code;calledAt=now();}
   if(items.length>1&&now()-calledAt>=90000){items.push(items.shift());calledCode=items[0].code;calledAt=now();}
  }else{calledCode='';calledAt=0;}
  const rows=items.map(item=>{const order=base.lookup({code:item.code});return {...item,orderId:order.id,model:order.snapshot.model,status:order.status==='paid'?'waiting':order.status};});
  if(active){
   const at=rows.findIndex(row=>row.orderId===active.order.id),row=at>=0?rows.splice(at,1)[0]:{orderId:active.order.id,code:active.order.snapshot.code,ticket:'A000',model:active.order.snapshot.model};
   rows.unshift({...row,status:active.status});
  }else if(rows.length)rows[0].status='awaiting_confirmation';
  persist();return {stationId,items:rows,confirmBy:!active&&items.length>1?calledAt+90000:null};
 }
 function enqueue({code}){
  const order=base.lookup({code});
  if(['completed','cancelled'].includes(order.status))throw new DeviceError(order.status==='completed'?'ALREADY_COLLECTED':'CANCELLED');
  if(!items.some(item=>item.code===code)){
   assertPrintable({...order,status:order.status==='paid'?'paid':order.status}, {...base.connect(),status:'ready'});
   if(getQueue().items.length>=100||counter>=999999)throw new DeviceError('QUEUE_FULL');
   if(items.length===1&&!base.connect().activeJobId)calledCode='';
   items.push({code,ticket:'A'+String(++counter).padStart(3,'0')});persist();
  }
  return getQueue();
 }
 return {...base,version:2,getQueue,enqueue,
  enqueueSample(){return enqueue({code:'POP-C-D'+crypto.randomUUID().replaceAll('-','').slice(0,15).toUpperCase()});},
  defer({code}){const queue=getQueue();if(queue.items[0]?.code!==code||queue.items[0]?.status!=='awaiting_confirmation')throw new DeviceError('QUEUE_TURN');if(items.length>1)items.push(items.shift());calledCode='';persist();return getQueue();},
  start(request){const queue=getQueue(),order=base.lookup({code:request.code});if(order.status==='paid'&&queue.items[0]?.status==='awaiting_confirmation'&&queue.items[0].code!==request.code)throw new DeviceError('QUEUE_TURN');return base.start(request);},
 };
}
