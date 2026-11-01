import {readPass} from './simple-core.js';

export class DeviceError extends Error{
 constructor(code){super(code);this.code=code;}
}
export function normalizeScan(value){
 let code=String(value??'').trim();
 if(code.length>2048)throw new DeviceError('INVALID_CODE');
 if(/^https?:\/\//i.test(code)){
  try{const url=new URL(code);code=url.searchParams.get('code')||new URLSearchParams(url.hash.split('?')[1]||'').get('code')||'';}catch{throw new DeviceError('INVALID_CODE');}
 }
 code=code.toUpperCase().replace(/\s/g,'');
 if(/^[A-F0-9]{16}$/.test(code))code='POP-C-'+code;
 if(!/^POP-C-[A-F0-9]{16}$/.test(code))throw new DeviceError('INVALID_CODE');
 return code;
}
const id=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function validateStation(value,stationId){
 if(!value||value.id!==stationId||!['ready','offline','busy','maintenance'].includes(value.status)||!Array.isArray(value.availableModels)||!value.availableModels.every(v=>typeof v==='string'&&v.length<=120))throw new DeviceError('INVALID_RESPONSE');
 return {id:stationId,name:typeof value.name==='string'?value.name.slice(0,100):stationId,status:value.status,availableModels:[...value.availableModels],...(id(value.activeJobId)?{activeJobId:value.activeJobId}:{})};
}
export function validateOrder(value,code){
 if(!value||!id(value.id)||!Number.isSafeInteger(value.revision)||value.revision<1||!['paid','unpaid','printing','ready','completed','cancelled'].includes(value.status))throw new DeviceError('INVALID_RESPONSE');
 let snapshot;try{snapshot=readPass(value.snapshot?.code,value.snapshot);}catch{throw new DeviceError('INVALID_RESPONSE');}
 if(snapshot.version!==2)throw new DeviceError('INVALID_RESPONSE');
 if(code&&snapshot.code!==code)throw new DeviceError('REPLACED');
 if(!Number.isSafeInteger(value.amountCents)||value.amountCents<0||!/^[A-Z]{3}$/.test(value.currency||''))throw new DeviceError('INVALID_RESPONSE');
 return {id:value.id,revision:value.revision,status:value.status,snapshot,amountCents:value.amountCents,currency:value.currency,...(id(value.jobId)?{jobId:value.jobId}:{})};
}
export function validateJob(value){
 if(!value||!id(value.id)||!['printing','ready','completed','error'].includes(value.status))throw new DeviceError('INVALID_RESPONSE');
 const order=validateOrder(value.order);
 if(!['printing','ready','completed','cancelled'].includes(order.status)||order.jobId!==value.id||(value.status!=='error'&&order.status!==value.status))throw new DeviceError('INVALID_RESPONSE');
 return {id:value.id,status:value.status,phase:['preparing','printing','finishing'].includes(value.phase)?value.phase:'printing',progress:Number.isFinite(value.progress)&&value.progress>=0&&value.progress<=100?value.progress:null,order};
}
export function assertPrintable(order,station){
 if(order.status==='unpaid')throw new DeviceError('UNPAID');
 if(order.status==='completed')throw new DeviceError('ALREADY_COLLECTED');
 if(order.status==='cancelled')throw new DeviceError('CANCELLED');
 if(order.status!=='paid')throw new DeviceError('ALREADY_STARTED');
 if(station.status!=='ready')throw new DeviceError(station.status==='busy'?'BUSY':'OFFLINE');
 if(!station.availableModels.includes(order.snapshot.model))throw new DeviceError('OUT_OF_STOCK');
 return true;
}
// Only the opaque active-job reference or a confirmed, idempotent start intent
// survives a reload. Customer photos and previews never enter kiosk storage.
export function readDeviceSession(storage,key){
 try{
  const value=JSON.parse(storage.getItem(key));
  if(value?.kind==='job'&&id(value.jobId))return {kind:'job',jobId:value.jobId};
  if(value?.kind==='start'&&id(value.orderId)&&id(value.idempotencyKey)&&Number.isSafeInteger(value.revision)&&value.revision>0)return {kind:'start',orderId:value.orderId,revision:value.revision,idempotencyKey:value.idempotencyKey,code:normalizeScan(value.code)};
 }catch{}
 return null;
}
export function phoneDesignUrl(configured,origin,stationId){
 try{
  const url=new URL(configured||'/',origin);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
  url.searchParams.set('station',stationId);return url.href;
 }catch{return null;}
}

// Queue summaries contain ticket references, not customer photos or contact data.
export function validateQueue(value,stationId){
 if(!value||value.stationId!==stationId||!Array.isArray(value.items)||value.items.length>100)throw new DeviceError('INVALID_RESPONSE');
 const seen=new Set(),tickets=new Set();
 const items=value.items.map((item,index)=>{
  if(!item||!id(item.orderId)||!/^A\d{3,6}$/.test(item.ticket)||typeof item.model!=='string'||item.model.length>120||!['waiting','awaiting_confirmation','printing','ready'].includes(item.status)||seen.has(item.orderId)||tickets.has(item.ticket)||(index===0&&item.status==='waiting')||(index>0&&item.status!=='waiting'))throw new DeviceError('INVALID_RESPONSE');
  seen.add(item.orderId);tickets.add(item.ticket);
  return {orderId:item.orderId,ticket:item.ticket,model:item.model,status:item.status,code:normalizeScan(item.code)};
 });
 const confirmBy=Number.isFinite(value.confirmBy)&&value.confirmBy>0?value.confirmBy:null;
 return {stationId,items,confirmBy};
}
