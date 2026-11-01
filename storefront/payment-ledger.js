import {mergeMarketingLedger} from './marketing-core.js';
// A shared IndexedDB record avoids per-tab localStorage cache races.
// Called under the existing Web Lock; still a browser-local simulation.
let database;
function open(){return database??=new Promise((resolve,reject)=>{const request=indexedDB.open('popomo-demo-payments',1);request.onupgradeneeded=()=>request.result.createObjectStore('ledgers');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function read(id){const db=await open();return new Promise((resolve,reject)=>{const request=db.transaction('ledgers').objectStore('ledgers').get(id);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
async function write(id,data){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('ledgers','readwrite');tx.objectStore('ledgers').put(data,id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Payment ledger aborted'));});}
export async function hydratePaymentLedger(state){if(state.ledgerId)mergeMarketingLedger(state,await read(state.ledgerId));}
export async function commitWithPaymentLedger(state,commit){await hydratePaymentLedger(state);const before=structuredClone(state);try{commit();await write(state.ledgerId,{orders:structuredClone(state.orders),marketing:structuredClone(state.marketing)});}catch(error){Object.assign(state,before);throw error;}}
