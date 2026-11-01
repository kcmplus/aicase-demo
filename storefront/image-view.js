import bundledImages from './image-manifest.js';

const managedImages=new Map();
const localPath=value=>typeof value==='string'&&/^\/?(?:assets|media)\/[a-zA-Z0-9_/-]+\.(?:png|jpe?g|webp|svg)$/.test(value);
const canonical=src=>typeof src==='string'?src.replace(/^\.\//,'/'):'';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function registerImageVariants(records={}){
 for(const [path,record] of Object.entries(records||{})){
  const key=canonical(path),variants=record?.variants;
  if(!localPath(key)||!Array.isArray(variants)||!variants.length||variants.length>4)continue;
  if(![record.width,record.height].every(n=>Number.isInteger(n)&&n>0&&n<=20000000))continue;
  if(!variants.every(v=>localPath(v.src)&&/^\/(assets\/optimized|media\/previews)\//.test(v.src)&&[v.width,v.height].every(n=>Number.isInteger(n)&&n>0&&n<=20000000)))continue;
  managedImages.set(key,{...record,variants:[...variants].sort((a,b)=>a.width-b.width)});
 }
}

// Original paths stay in saved designs/orders. Only display URLs are substituted.
export function imageAttributes(src,{sizes='320px',loading='lazy',fetchpriority='auto',...attributes}={}){
 const record=managedImages.get(canonical(src))||bundledImages[canonical(src)]||bundledImages[canonical(src).replace(/^\//,'./')];
 const result={...attributes,src,loading,decoding:'async',fetchpriority};
 if(record){
  result.src=(record.variants.find(v=>v.width>=640)||record.variants.at(-1)).src;
  result.srcset=record.variants.map(v=>`${v.src} ${v.width}w`).join(', ');
  result.sizes=sizes;result.width=record.width;result.height=record.height;
 }
 return result;
}

export function imageTag(src,options={}){
 return '<img '+Object.entries(imageAttributes(src,options)).map(([key,value])=>`${key}="${escape(value)}"`).join(' ')+'>';
}
