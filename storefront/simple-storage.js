let connection;
function database(){
 return connection??=new Promise((resolve,reject)=>{
  const request=indexedDB.open('popomo-demo-personal-designs',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('designs');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>{connection=undefined;reject(request.error);};
 });
}
export async function readDesign(key){
 const db=await database();
 return new Promise((resolve,reject)=>{const r=db.transaction('designs').objectStore('designs').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
}
export async function writeDesign(key,value){
 const db=await database();
 return new Promise((resolve,reject)=>{const tx=db.transaction('designs','readwrite');tx.objectStore('designs').put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Design could not be saved.'));});
}
// Serialize lifecycle changes across tabs, and publish only after commit.
export async function updateDesign(key,transform,initialValue){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('designs','readwrite'),store=tx.objectStore('designs');let value,error;
  const r=store.get(key);
  r.onsuccess=()=>{try{if(!r.result&&!initialValue)throw Error('This render is missing. Please start again.');value=transform(r.result||structuredClone(initialValue));store.put(value,key);}catch(e){error=e;tx.abort();}};
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(error||tx.error);tx.onabort=()=>reject(error||tx.error||Error('Render could not be saved.'));
 });
}

export async function clearDemoStorage(){
 const db=await database();
 return new Promise((resolve,reject)=>{const tx=db.transaction('designs','readwrite');tx.objectStore('designs').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
}
