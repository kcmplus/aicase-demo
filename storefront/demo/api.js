import catalog from './catalog.js';
import {updateDesign} from '../simple-storage.js';

const initial=()=>({email:null,challenge:null,users:{},orders:[],renders:[]});
const error=(detail,status=400)=>{throw Object.assign(Error(detail),{status});};
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const price=kind=>catalog.plans.find(p=>p.kind===kind);
// One IndexedDB transaction per request keeps changes atomic across browser tabs.
export function createDemoFetch({mutate,now=Date.now,assetFetch=(...args)=>globalThis.fetch(...args)}={}){
 return async function request(input,options={}){
  const url=new URL(input,'http://demo.local'),path=url.pathname,method=options.method||'GET';
  let body;try{body=options.body?JSON.parse(options.body):{};}catch{return json({detail:'Invalid JSON'},400);}
  if(path==='/api/v1/catalog/')return json(catalog);
  if(path==='/api/v1/auth/csrf/')return json({csrfToken:'local-demo'});
  if(path==='/api/v1/store/payment-config/')return json({provider:'demo',mode:'demo',available:true});
  let result;
  try{
   await mutate(db=>{
    const time=now(),iso=new Date(time).toISOString();
    const user=db.email?db.users[db.email]:null;
    const account=()=>({server:true,authenticated:!!user,customer:user?.customer||null,trialRemaining:user?.credits||0,trialGranted:catalog.signupCredits,signupCredits:catalog.signupCredits,subscription:user?.subscription||null,demoSubscriptionsAvailable:true});
    const signedIn=()=>{if(!user)error('Sign in to the demo first.',401);};
    const ledger=(amount,kind,pool='gift',renderId=null)=>user.ledger.unshift({id:crypto.randomUUID(),kind,pool,amount,balanceAfter:pool==='gift'?user.credits:user.subscription.monthlyLimit-user.subscription.used,createdAt:iso,renderId});
    if(path.endsWith('/customer/send-code/')){
     if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email||''))error('Enter a valid email address.');
     db.challenge=body.email.toLowerCase();result={sent:true};return db;
    }
    if(path.endsWith('/customer/verify/')){
     const email=String(body.email||'').toLowerCase();
     if(body.code!=='123456'||db.challenge!==email)error('Use demo code 123456 after requesting a code.');
     db.email=email;db.challenge=null;
     db.users[email]??={customer:{id:crypto.randomUUID(),email,displayName:'Demo user',joinedAt:iso},credits:catalog.signupCredits,subscription:null,ledger:[{id:crypto.randomUUID(),kind:'signup',pool:'gift',amount:catalog.signupCredits,balanceAfter:catalog.signupCredits,createdAt:iso}]};
     result={authenticated:true,customer:db.users[email].customer};return db;
    }
    if(path.endsWith('/customer/credits/')){signedIn();result={results:user.ledger,nextCursor:null};return db;}
    if(path.endsWith('/customer/')){
     if(method==='DELETE'){db.email=null;result={authenticated:false};}
     else {signedIn();if(method==='PATCH')user.customer.displayName=String(body.displayName||'').slice(0,60);result=account();}return db;
    }
    if(path.endsWith('/ai-account/')){
     if(method==='POST'){
      signedIn();
      if(!body.accepted)error('Confirm this demo subscription first.');
      if(body.action==='subscribe'){
       if(!user.subscription||user.subscription.endsAt<=time){user.subscription={anchor:time,cycle:0,startsAt:time,endsAt:time+30*86400000,used:0,renew:true,monthlyLimit:price('ai_monthly').monthly_credits,priceCents:Math.round(Number(price('ai_monthly').price)*100)};ledger(user.subscription.monthlyLimit,'subscription','monthly');}
       else user.subscription.renew=true;
      }else if(['stop-renewal','resume-renewal'].includes(body.action)&&user.subscription)user.subscription.renew=body.action==='resume-renewal';
      else error('Unknown subscription action.');
     }result=account();return db;
    }
    if(path.startsWith('/api/v1/store/ai-renders/')){
     signedIn();const id=path.split('/')[5];let job=db.renders.find(r=>r.id===id&&r.customerId===user.customer.id);
     if(!id&&method==='POST'){
      job=db.renders.find(r=>r.requestKey===body.request_key&&r.customerId===user.customer.id);
      if(!job){
       if(!body.accepted)error('Confirm using one demo generation.');
       const example=catalog.ai_examples.find(e=>e.code===body.example_id&&e.results.some(r=>r.style_code===body.style_id))||catalog.ai_examples.find(e=>e.results.some(r=>r.style_code===body.style_id));
       if(!example)error('Choose an available style.');
       let allocation;
       if(user.credits>0){user.credits--;allocation={type:'trial'};}
       else if(user.subscription?.endsAt>time&&user.subscription.used<user.subscription.monthlyLimit){user.subscription.used++;allocation={type:'monthly'};}
       else error('No demo credits remaining. Try the demo subscription.');
       job={id:crypto.randomUUID(),customerId:user.customer.id,requestKey:body.request_key,mode:'live',status:'queued',payment:'credit_reserved',allocation,createdAt:time,startedAt:time+1500,completedAt:null,result:null,sample:example.results.find(r=>r.style_code===body.style_id).image_path};
       db.renders.push(job);ledger(-1,'generation',allocation.type==='trial'?'gift':'monthly',job.id);
      }
     }
     if(!job)error('Render not found.',404);
     if(['queued','generating'].includes(job.status)){
      if(time>=job.createdAt+4500){job.status='ready';job.completedAt=time;job.result=`/api/v1/store/ai-renders/${job.id}/image/`;}
      else if(time>=job.startedAt)job.status='generating';
     }
     if(id&&method==='POST'&&body.action==='cancel'){
      if(job.status==='generating'||job.status==='ready')error('This render can no longer be cancelled.');
      if(job.status==='queued'){job.status='cancelled';job.payment='credit_restored';if(job.allocation.type==='trial')user.credits++;else user.subscription.used--;ledger(1,'cancel_refund',job.allocation.type==='trial'?'gift':'monthly',job.id);}
     }
     if(path.endsWith('/image/')){if(job.status!=='ready')error('Image is not ready.');result={asset:job.sample};}
     else result=job;return db;
    }
    if(path.startsWith('/api/v1/store/orders/')){
     const id=path.split('/')[5];let order=db.orders.find(o=>o.reference===id);
     if(!id&&method==='GET'){const page=Math.max(1,Number(url.searchParams.get('page'))||1);result={results:db.orders.slice().reverse().slice((page-1)*10,page*10),has_more:db.orders.length>page*10};return db;}
     if(!id&&method==='POST'){
      if(!body.accepted||!body.snapshot?.code)error('Confirm your design and demo payment.');
      if(body.expected_amount!==price('print').price)error('The price changed. Reload checkout.');
      order=db.orders.find(o=>o.request_key===body.request_key);
      if(!order){order={reference:'DEMO-'+crypto.randomUUID().slice(0,8).toUpperCase(),request_key:body.request_key,mode:'demo',status:'paid',amount:price('print').price,currency:'USD',revision:1,snapshot:body.snapshot,station_id:null,customer_email:user?.customer.email||body.customer_email||'',created_at:iso,updated_at:iso};db.orders.push(order);}
     }
     if(!order)error('Order not found.',404);
     if(method==='PATCH'||path.endsWith('/actions/')){
      if(body.revision!==order.revision)error('Order changed. Refresh and try again.',409);
      if(method==='PATCH'){if(order.status!=='paid'||!body.accepted||!body.snapshot?.code)error('Only confirmed, unprinted orders can be edited.');order.snapshot=body.snapshot;}
      else {
       if(body.code!==order.snapshot.code)error('This design code was replaced.',409);
       const transitions={start:['paid','printing'],ready:['printing','ready'],collect:['ready','completed'],cancel:['paid','cancelled']};
       const transition=transitions[body.action];if(!transition||order.status!==transition[0])error('This action is unavailable for the current order.',409);
       order.status=transition[1];if(body.station_id)order.station_id=body.station_id;
      }order.revision++;order.updated_at=iso;
     }
     result=order;return db;
    }
    error('This endpoint is not part of the standalone demo.',404);
   });
   if(result?.asset)return assetFetch(result.asset);
   return json(result);
  }catch(e){return json({detail:e.message||'Demo data could not be saved.'},e.status||500);}
 };
}
export const demoFetch=createDemoFetch({mutate:transform=>updateDesign('demo-api',transform,initial())});
export {initial as freshDemoData};
