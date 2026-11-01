import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeScan,validateStation,validateOrder,validateJob,assertPrintable,readDeviceSession,phoneDesignUrl} from '../storefront/device-core.js';
import {createDeviceClient,createDemoAdapter,demoCodes} from '../storefront/device-service.js';
const code=demoCodes.iphone17;
const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k),data};};
const request=(order,key='start-1')=>({code:order.snapshot.code,orderId:order.id,revision:order.revision,idempotencyKey:key});
const throwsCode=(fn,code)=>assert.throws(fn,e=>e.code===code);
const rejectsCode=(fn,code)=>assert.rejects(fn,e=>e.code===code);

test('device accepts only current code format and extracts codes without navigating scanned URLs',()=>{
 assert.equal(normalizeScan('  pop-c-1717171717171717\r\n'),code);
 assert.equal(normalizeScan('1717171717171717'),code);
 assert.equal(normalizeScan(`https://shop.example/?code=${code}`),code);
 assert.equal(normalizeScan(`https://shop.example/#pass?code=${code}`),code);
 for(const raw of ['', '<script>', 'javascript:alert(1)', 'https://bad.example/', 'POP-C-1234', 'A'.repeat(2049)])throwsCode(()=>normalizeScan(raw),'INVALID_CODE');
});

test('station and order responses are checked before rendering or printing',()=>{
 const adapter=createDemoAdapter(),station=adapter.connect(),order=adapter.lookup({code});
 assert.equal(validateStation(station,'DEMO-01').id,'DEMO-01');
 throwsCode(()=>validateStation(station,'ANOTHER'),'INVALID_RESPONSE');
 throwsCode(()=>validateOrder(order,demoCodes.iphone16e),'REPLACED');
 throwsCode(()=>validateOrder({...order,amountCents:-1},code),'INVALID_RESPONSE');
 throwsCode(()=>validateOrder({...order,snapshot:null},code),'INVALID_RESPONSE');
 for(const [status,error] of [['unpaid','UNPAID'],['cancelled','CANCELLED'],['completed','ALREADY_COLLECTED'],['printing','ALREADY_STARTED']])throwsCode(()=>assertPrintable({...order,status},station),error);
 throwsCode(()=>assertPrintable(order,{...station,status:'offline'}),'OFFLINE');
 throwsCode(()=>assertPrintable(order,{...station,status:'busy'}),'BUSY');
 throwsCode(()=>assertPrintable(order,{...station,availableModels:[]}),'OUT_OF_STOCK');
});

test('a demo print retries idempotently and cannot be started a second time',()=>{
 let time=100000;const saved=storage(),adapter=createDemoAdapter({storage:saved,now:()=>time});
 const order=adapter.lookup({code}),intent=request(order),first=adapter.start(intent);
 assert.equal(first.status,'printing');assert.equal(first.progress,0);
 assert.equal(adapter.start(intent).id,first.id);
 throwsCode(()=>adapter.start(request(order,'different-key')),'ALREADY_STARTED');
 throwsCode(()=>adapter.collect({jobId:first.id}),'DEVICE_ERROR');
 throwsCode(()=>adapter.start({...intent,code:demoCodes.iphone16e}),'REPLACED');
 time+=5000;assert.equal(adapter.getJob({jobId:first.id}).phase,'printing');
 const recovered=createDemoAdapter({storage:saved,now:()=>time});
 assert.equal(recovered.connect().activeJobId,first.id);
 assert.equal(recovered.start(intent).id,first.id);
 time+=11000;assert.equal(recovered.getJob({jobId:first.id}).status,'ready');
 assert.equal(recovered.collect({jobId:first.id}).status,'completed');
 assert.equal(recovered.collect({jobId:first.id}).status,'completed');
 throwsCode(()=>recovered.start(request(order,'third-key')),'ALREADY_COLLECTED');
 assert.equal(recovered.connect().status,'ready');
 assert.ok(![...saved.data.values()].join('').includes('snapshot'));
});

test('corrupt demo storage does not prevent opening the station',()=>{
 const saved=storage();saved.setItem('popomo-device-demo-v1:DEMO-01',JSON.stringify({bad:{code:'bad'},alsoBad:null}));
 assert.equal(createDemoAdapter({storage:saved}).connect().status,'ready');
});

test('connected mode fails closed without a complete device adapter',async()=>{
 for(const mode of ['connected','typo'])await rejectsCode(()=>createDeviceClient({mode,stationId:'STATION'}).connect(),'NOT_CONNECTED');
 await rejectsCode(()=>createDeviceClient({mode:'connected',stationId:'STATION',adapter:{version:1,connect:()=>({})}}).connect(),'NOT_CONNECTED');
});

test('lost start response can retry the same intent and retrieve the same job',async()=>{
 const demo=createDemoAdapter();let first=true,jobId;
 const adapter={...demo,async start(input){const job=demo.start(input);jobId=job.id;if(first){first=false;return new Promise(()=>{});}return job;}};
 const client=createDeviceClient({mode:'connected',stationId:'DEMO-01',adapter,timeout:10});
 const intent=request(await client.lookup(code));
 await rejectsCode(()=>client.start(intent),'CONNECTION');
 assert.equal((await client.start(intent)).id,jobId);
});

test('device client rejects mismatched jobs and unknown progress is indeterminate',async()=>{
 const demo=createDemoAdapter(),order=demo.lookup({code}),job=demo.start(request(order));
 assert.equal(validateJob({...job,progress:undefined}).progress,null);
 throwsCode(()=>validateJob({...job,status:'ready'}),'INVALID_RESPONSE');
 const adapter={...demo,getJob:()=>({...job,id:'OTHER'})};
 await rejectsCode(()=>createDeviceClient({mode:'connected',stationId:'DEMO-01',adapter}).getJob(job.id),'INVALID_RESPONSE');
 const wrongStart={...demo,start:()=>job};
 const client=createDeviceClient({mode:'connected',stationId:'DEMO-01',adapter:wrongStart});
 await rejectsCode(()=>client.start({...request(order),orderId:'OTHER'}),'INVALID_RESPONSE');
});

test('reload session keeps only opaque references or an already-confirmed start intent',()=>{
 const saved=storage();saved.setItem('session',JSON.stringify({kind:'job',jobId:'JOB-1',photo:'private image',snapshot:{}}));
 assert.deepEqual(readDeviceSession(saved,'session'),{kind:'job',jobId:'JOB-1'});
 const intent={kind:'start',orderId:'ORDER-1',revision:1,idempotencyKey:'intent-1',code};
 saved.setItem('session',JSON.stringify({...intent,photo:'private'}));assert.deepEqual(readDeviceSession(saved,'session'),intent);
 saved.setItem('session','broken');assert.equal(readDeviceSession(saved,'session'),null);
 saved.setItem('session',JSON.stringify({...intent,code:'invalid'}));assert.equal(readDeviceSession(saved,'session'),null);
 assert.equal(readDeviceSession({getItem(){throw Error();}},'session'),null);
});

test('phone design QR accepts only web destinations and preserves language',()=>{
 assert.equal(phoneDesignUrl('https://shop.example/?lang=zh-CN','http://localhost:4175','A-1'),'https://shop.example/?lang=zh-CN&station=A-1');
 for(const value of ['javascript:alert(1)','file:///private','https://user:secret@example.com/'])assert.equal(phoneDesignUrl(value,'http://localhost','A-1'),null);
});

test('queue is FIFO, duplicate pushes keep a single ticket, and only its head can print',async()=>{
 const {createDemoQueueAdapter}=await import('../storefront/device-service.js');
 const q=createDemoQueueAdapter();
 assert.equal(q.enqueue({code}).items[0].ticket,'A001');
 assert.equal(q.enqueue({code}).items.length,1);
 const two=q.enqueue({code:demoCodes.iphone16e});
 assert.deepEqual(two.items.map(i=>i.ticket),['A001','A002']);
 throwsCode(()=>q.start(request(q.lookup({code:demoCodes.iphone16e}))),'QUEUE_TURN');
 const job=q.start(request(q.lookup({code})));assert.equal(q.getQueue().items[0].status,'printing');
 const more=q.enqueueSample();assert.equal(more.items.length,3);assert.equal(more.items[0].orderId,job.order.id);
});

test('queue keeps the printer occupied until collection then calls the next ticket',async()=>{
 const {createDemoQueueAdapter}=await import('../storefront/device-service.js');
 let time=100000;const q=createDemoQueueAdapter({now:()=>time});q.enqueue({code});q.enqueue({code:demoCodes.iphone16e});
 const intent=request(q.lookup({code})),job=q.start(intent);time+=180000;
 assert.equal(q.getQueue().items[0].status,'ready');assert.equal(q.getQueue().items[0].ticket,'A001');
 throwsCode(()=>q.start(request(q.lookup({code:demoCodes.iphone16e}),'second')),'BUSY');
 q.collect({jobId:job.id});assert.equal(q.getQueue().items[0].ticket,'A002');assert.equal(q.getQueue().items[0].status,'awaiting_confirmation');
 assert.equal(q.start(intent).id,job.id);assert.equal(q.start(intent).status,'completed');
});

test('unconfirmed tickets rotate after 90 seconds without losing orders or renumbering',async()=>{
 const {createDemoQueueAdapter}=await import('../storefront/device-service.js');
 let time=100000;const q=createDemoQueueAdapter({now:()=>time});q.enqueue({code});q.enqueue({code:demoCodes.iphone16e});
 time+=90001;assert.deepEqual(q.getQueue().items.map(i=>i.ticket),['A002','A001']);
 assert.equal(q.lookup({code}).status,'paid');
 throwsCode(()=>q.start(request(q.lookup({code}))),'QUEUE_TURN');
 const restored=q.defer({code:demoCodes.iphone16e});assert.deepEqual(restored.items.map(i=>i.ticket),['A001','A002']);
});

test('queue recovery preserves ordering, call deadline, numbering and excludes photos',async()=>{
 const {createDemoQueueAdapter}=await import('../storefront/device-service.js');
 const saved=storage();let time=100000;const first=createDemoQueueAdapter({storage:saved,now:()=>time});
 first.enqueue({code});first.enqueue({code:demoCodes.iphone16e});const before=first.defer({code});
 time+=5000;const restored=createDemoQueueAdapter({storage:saved,now:()=>time});assert.deepEqual(restored.getQueue(),before);
 const after=restored.enqueueSample();assert.equal(after.items.at(-1).ticket,'A003');
 for(const value of saved.data.values()){assert.ok(!value.includes('snapshot'));assert.ok(!value.includes('photo'));}
});

test('public queue payload validates its station, unique tickets and single active head',async()=>{
 const {validateQueue}=await import('../storefront/device-core.js');
 const {createDemoQueueAdapter}=await import('../storefront/device-service.js');
 const q=createDemoQueueAdapter();q.enqueue({code});const data=q.enqueue({code:demoCodes.iphone16e});
 assert.equal(validateQueue(data,'DEMO-01').items.length,2);
 throwsCode(()=>validateQueue(data,'ANOTHER'),'INVALID_RESPONSE');
 throwsCode(()=>validateQueue({...data,items:data.items.map(i=>({...i,status:'printing'}))},'DEMO-01'),'INVALID_RESPONSE');
 throwsCode(()=>validateQueue({...data,items:data.items.map(i=>({...i,ticket:'A001'}))},'DEMO-01'),'INVALID_RESPONSE');
 const clean=validateQueue({...data,items:data.items.map(i=>({...i,email:'private',snapshot:{}}))},'DEMO-01');
 assert.equal(clean.items[0].email,undefined);assert.equal(clean.items[0].snapshot,undefined);
});
