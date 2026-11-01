import {validateDesignSources} from './creator-core.js';
import {models} from './core.js';
import {productById} from './shop-catalog.js';
export const DEMO_SHIPPING=8;
export const shippingSteps=[['已支付','Paid'],['备货与定制','Preparing your order'],['中国已发出','Shipped from China'],['抵达目的地','Arrived at destination'],['本地配送中','Local delivery'],['已送达','Delivered']];
const invalid=()=>{throw Error('商品或规格不可用，请移除后重新选择');};
function itemDetails(line){
 if(!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>9)throw Error('商品数量须为 1–9 件');
 if(line.kind==='case'){if(!models.includes(line.model)||!line.design)invalid();return {...line,price:69,zh:'定制手机壳',en:'Custom phone case',stock:9};}
 if(line.kind!=='accessory')invalid();const p=productById(line.productId),v=p?.variants.find(v=>v.id===line.variantId);if(!v)invalid();if(line.quantity>v.stock)throw Error('所选规格库存不足，请调整数量');return {...line,price:p.price,zh:p.zh,en:p.en,image:p.image,variantZh:v.zh,variantEn:v.en,stock:v.stock};
}
export const cartLines=s=>(s.cart||[]).map(itemDetails);
export function cartTotals(s){const lines=cartLines(s),subtotal=lines.reduce((n,l)=>n+l.price*l.quantity,0),count=lines.reduce((n,l)=>n+l.quantity,0),shipping=count?DEMO_SHIPPING:0;return {subtotal,shipping,total:subtotal+shipping,count};}
export function addAccessory(s,productId,variantId){s.cart??=[];const id=`${productId}:${variantId}`,existing=s.cart.find(l=>l.id===id),line={id,kind:'accessory',productId,variantId,quantity:(existing?.quantity||0)+1};itemDetails(line);if(existing)existing.quantity=line.quantity;else s.cart.push(line);}
export function addCase(s){if(!models.includes(s.model))throw Error('请先选择手机型号');s.cart??=[];const existing=s.cart.find(l=>l.kind==='case'&&l.model===s.model&&JSON.stringify(l.design)===JSON.stringify(s.design));if(existing){changeQuantity(s,existing.id,existing.quantity+1);return;}s.cart.push({id:'case-'+crypto.randomUUID(),kind:'case',quantity:1,model:s.model,design:structuredClone(s.design)});}
export function changeQuantity(s,id,quantity){const index=(s.cart||[]).findIndex(l=>l.id===id);if(index<0)return;if(quantity===0){s.cart.splice(index,1);return;}itemDetails({...s.cart[index],quantity});s.cart[index].quantity=quantity;}
export function createCartOrder(s){
 if(s.delivery!=='mail')throw Error('配件及合并订单仅支持邮寄');
 const items=cartLines(s);for(const item of items)if(item.kind==='case')validateDesignSources(s,item.design);if(!items.length)throw Error('购物车为空，请先添加商品');
 const a=s.address,phone=String(a.phone||'').replace(/[\s()+-]/g,'');if(!a.name?.trim()||!a.country?.trim()||!a.city?.trim()||!/^\d{7,15}$/.test(phone)||a.detail?.trim().length<6)throw Error('请填写姓名、国家或地区、城市、完整地址与有效联系电话');
 const total=cartTotals(s);const o={id:'DEMO-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,5).toUpperCase(),items:structuredClone(items),delivery:'mail',fulfillment:'china-local',address:structuredClone(a),total:total.total,subtotal:total.subtotal,shipping:total.shipping,model:items.some(l=>l.kind==='case')?(items.some(l=>l.kind==='accessory')?'手机壳与配件':'定制手机壳'):'配件订单',step:0,createdAt:new Date().toISOString()};
 s.orders.unshift(o);s.activeOrder=o.id;return o;
}
