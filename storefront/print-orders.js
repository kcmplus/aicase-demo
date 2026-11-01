import {readPass,startPrint} from './simple-core.js';
import {PRINT_PRICE_CENTS,PRINT_PRICE,PRINT_AVAILABLE} from './simple-pricing.js';
export const freshOrders=()=>({orders:{}});
export function orderForCode(book,code){return Object.values(book.orders).find(o=>o.pass.code===code||o.oldCodes.includes(code));}
export function commitPrintOrder(value,pass,{accepted=false,editId=null,now=Date.now()}={}){
 const book=structuredClone(value),snapshot=readPass(pass.code,pass);
 if(!accepted)throw Error('Confirm your print order first.');
 if(editId){const order=book.orders[editId];if(!order||order.status!=='paid')throw Error('Printing has started. Create a new order to use a different design.');if(snapshot.code===order.pass.code)throw Error('Save the revision with a new design code.');order.oldCodes.push(order.pass.code);order.pass=snapshot;order.updatedAt=now;return {book,order};}
 const duplicate=Object.values(book.orders).find(o=>o.pass.code===snapshot.code);if(duplicate)return {book,order:duplicate};
 if(!PRINT_AVAILABLE)throw Error('Printing is unavailable. Please reload and try again.');
 const order={id:'PRINT-'+crypto.randomUUID(),mode:'demo',priceCents:PRINT_PRICE_CENTS,status:'paid',pass:snapshot,oldCodes:[],createdAt:now,updatedAt:now};book.orders[order.id]=order;return {book,order};
}
export function currentOrder(book,code){const order=orderForCode(book,code);if(!order)throw Error(`Review and confirm a ${PRINT_PRICE} print order first.`);if(order.pass.code!==code)throw Error('This design code was replaced. Use the latest QR code from My design.');return order;}
export function beginOrderPrint(value,code,stationId){const book=structuredClone(value),order=currentOrder(book,code);if(order.status!=='paid')throw Error('This order has already started printing. Create a new order for another print.');const job=startPrint(order.pass,stationId);order.status='printing';return {book,job:{...job,orderId:order.id}};}
