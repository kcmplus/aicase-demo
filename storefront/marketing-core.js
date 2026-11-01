import {availability} from './core.js';
import {cartLines,cartTotals} from './shop-core.js';

// Local demonstration only. Amounts and rules are examples, not approved live offers.
export const coupons=Object.freeze([
 {id:'welcome',amount:5,zh:'新客创作礼',en:'Your first creation',type:'case',icon:'spark'},
 {id:'station',amount:6,zh:'即刻打印礼',en:'A little instant joy',type:'station',icon:'scan',deviceId:'SH-001'},
 {id:'shipping',amount:3,zh:'灵感邮寄礼',en:'Good things, delivered',type:'shipping',icon:'box'}
]);
export const couponById=id=>coupons.find(c=>c.id===id);
export const ownerEmail=s=>s.account?.email?.trim().toLowerCase()||'';
export function ensureMarketing(s){
 if(!s.marketing||s.marketing.version!==1)s.marketing={version:1,wallets:{},selected:{},attribution:null};
 return s.marketing;
}
export function wallet(s){const m=ensureMarketing(s),owner=ownerEmail(s);return owner&&Array.isArray(m.wallets[owner])?m.wallets[owner]:[];}
export const hasPaidOrder=s=>(s.orders||[]).some(o=>!o.ownerEmail||o.ownerEmail===ownerEmail(s));
export function claimCoupon(s,id,now=Date.now()){
 if(!ownerEmail(s))throw Error('coupon:account');
 if(!couponById(id))throw Error('coupon:unknown');
 const m=ensureMarketing(s),owner=ownerEmail(s);
 const existing=wallet(s).find(c=>c.id===id);if(existing)return existing;
 if(id==='welcome'&&hasPaidOrder(s))throw Error('coupon:first-order');
 const claim={id,claimedAt:now,expiresAt:now+7*86400000};
 if(!Array.isArray(m.wallets[owner]))m.wallets[owner]=[];
 m.wallets[owner].push(claim);return claim;
}
export function selectCoupon(s,id){if(id&&!wallet(s).some(c=>c.id===id))throw Error('coupon:unclaimed');ensureMarketing(s).selected[ownerEmail(s)]=id;}
export const selectedCoupon=s=>ensureMarketing(s).selected[ownerEmail(s)]||'';
export function claimState(s,claim,now=Date.now()){
 if(claim.usedOrderId)return 'used';
 if(now>=claim.expiresAt)return 'expired';
 if(claim.id==='welcome'&&hasPaidOrder(s))return 'first-order';
 return 'ready';
}
function baseQuote(s,isCart){
 if(isCart){const totals=cartTotals(s),lines=cartLines(s);return {...totals,hasCase:lines.some(l=>l.kind==='case'),delivery:'mail'};}
 return {subtotal:69,shipping:s.delivery==='mail'?8:0,total:s.delivery==='mail'?77:69,count:1,hasCase:true,delivery:s.delivery};
}
export function couponStatus(s,id,isCart=false,now=Date.now()){
 const no=reason=>({ok:false,reason});
 if(!ownerEmail(s))return no('account');
 const def=couponById(id),claim=wallet(s).find(c=>c.id===id);
 if(!def||!claim)return no('unclaimed');
 const state=claimState(s,claim,now);if(state!=='ready')return no(state);
 const base=baseQuote(s,isCart);
 if(!base.count)return no('empty');
 if(def.type==='case'&&!base.hasCase)return no('case-only');
 if(def.type==='station'){
  if(base.delivery!=='pickup')return no('pickup-only');
  if(s.deviceId!==def.deviceId)return no('station-only');
  if(!availability(s.deviceId,s.model).ok)return no('station-unavailable');
 }
 if(def.type==='shipping'&&(base.delivery!=='mail'||!base.shipping))return no('mail-only');
 return {ok:true,reason:'ready'};
}
export function checkoutQuote(s,isCart=false,now=Date.now(),id=selectedCoupon(s)){
 const base=baseQuote(s,isCart),status=id?couponStatus(s,id,isCart,now):{ok:true,reason:''};
 const def=couponById(id),limit=def?.type==='shipping'?base.shipping:base.subtotal;
 const discountCents=id&&status.ok?Math.min(Math.round(def.amount*100),Math.round(limit*100)):0;
 return {...base,originalTotal:base.total,discount:discountCents/100,total:(Math.round(base.total*100)-discountCents)/100,
  ...status,couponId:id,ownerEmail:ownerEmail(s),isCart,attribution:structuredClone(ensureMarketing(s).attribution)};
}
export function commitMarketingOrder(s,order,q,now=Date.now()){
 // Validate again before consuming a coupon or publishing an order to the app state.
 if(q.ownerEmail!==ownerEmail(s))throw Error('coupon:account-changed');
 const current=checkoutQuote(s,q.isCart,now,q.couponId);
 if(!current.ok)throw Error('coupon:'+current.reason);
 if(['subtotal','shipping','total','discount'].some(k=>current[k]!==q[k]))throw Error('coupon:changed');
 const def=couponById(q.couponId);
 Object.assign(order,{ownerEmail:q.ownerEmail,subtotal:q.subtotal,shipping:q.shipping,originalTotal:q.originalTotal,discount:q.discount,total:q.total,
  marketing:{demo:true,coupon:q.couponId?{id:def.id,zh:def.zh,en:def.en,discount:q.discount}:null,attribution:structuredClone(q.attribution)}});
 if(q.couponId){wallet(s).find(c=>c.id===q.couponId).usedOrderId=order.id;ensureMarketing(s).selected[q.ownerEmail]='';}
 return order;
}
export function captureCampaign(s,params,now=Date.now()){
 const campaign=params.get('campaign'),source=params.get('source');
 if(!campaign||!/^[a-z0-9-]{1,48}$/i.test(campaign))return;
 if(!['home','station','menu','partner','direct'].includes(source))return;
 const device=params.get('device');
 ensureMarketing(s).attribution={campaign,source,deviceId:device&&/^SH-\d{3}$/.test(device)?device:null,capturedAt:now};
}
export function mergeMarketingLedger(s,stored){
 if(!stored||!Array.isArray(stored.orders))return;
 // Merge shared records, not the in-progress design, address, account or selection.
 const orders=new Map(stored.orders.map(o=>[o.id,structuredClone(o)]));
 for(const o of s.orders||[]){const saved=orders.get(o.id);orders.set(o.id,saved?{...saved,step:Math.max(saved.step||0,o.step||0)}:o);}
 s.orders=[...orders.values()].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
 const current=ensureMarketing(s);
 if(stored.marketing?.version!==1)return;
 for(const [owner,claims] of Object.entries(stored.marketing.wallets||{})){
  if(!Array.isArray(claims))continue;
  const merged=new Map((current.wallets[owner]||[]).map(c=>[c.id,c]));
  for(const claim of claims){if(!couponById(claim.id))continue;const local=merged.get(claim.id);
   merged.set(claim.id,local?{...local,claimedAt:Math.min(local.claimedAt,claim.claimedAt),expiresAt:Math.min(local.expiresAt,claim.expiresAt),usedOrderId:claim.usedOrderId||local.usedOrderId}:structuredClone(claim));
  }
  current.wallets[owner]=[...merged.values()];
 }
}
