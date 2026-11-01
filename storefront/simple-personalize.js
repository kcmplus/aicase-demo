import {phoneTemplate} from './phone-templates.js';
import {aiStyles} from './ai-core.js';
import {designFor,stickers,templates} from './catalog.js';
import {createBeautyPreview} from './beautify-core.js';
export const effects = [
  {id:'original',name:'Original',note:'Just as you like it',color:'#e9e8e1'},
  {id:'fresh',name:'Soft glow',note:'Light & dreamy',color:'#e0e9ef'},
  {id:'warm',name:'Warm film',note:'A golden-hour feeling',color:'#f0ddc6'},
  {id:'bold',name:'Color pop',note:'A little more vivid',color:'#eac8dc'},
];
export const isPhoto = value => typeof value==='string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) && value.length<3_000_000;
const clamp=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
export function validatePlacement(value){
 if(!value||![value.x,value.y,value.scale,value.rotation].every(Number.isFinite)||value.x<0||value.x>100||value.y<0||value.y>100||value.scale<25||value.scale>200||value.rotation< -180||value.rotation>180)throw Error('This artwork placement is invalid.');
 return {x:value.x,y:value.y,scale:value.scale,rotation:value.rotation};
}
export function validateText(value){
 if(typeof value.text!=='string'||value.text.length>80||!['sans','serif','mono','hand'].includes(value.font)||!/^#[0-9a-f]{6}$/i.test(value.color))throw Error('This text style is invalid.');
 return {text:value.text,font:value.font,color:value.color};
}
export function validateAddedArtwork(value=[]){
 if(!Array.isArray(value)||value.length>20)throw Error('Add up to 20 graphics per design.');
 const ids=new Set();
 return value.map(item=>{
  if(!item||!/^extra-[a-zA-Z0-9-]{1,60}$/.test(item.id)||ids.has(item.id)||(item.type!=='text'&&!stickers.some(s=>s.id===item.asset)))throw Error('This graphic is unavailable.');
  ids.add(item.id);return {id:item.id,...(item.type==='text'?{type:'text',...validateText(item)}:{type:'sticker',asset:item.asset}),...validatePlacement(item)};
 });
}
export function validateCollectionLayout(designId,layout){
 if(!templates.some(t=>t.id===designId)||!layout||![layout.zoom,layout.x,layout.y].every(Number.isFinite)||layout.zoom<50||layout.zoom>180||layout.x<0||layout.x>100||layout.y<0||layout.y>100)throw Error('This artwork layout is invalid.');
 const artworkEdits={};
 if(layout.artworkEdits!==undefined){
  if(!layout.artworkEdits||typeof layout.artworkEdits!=='object'||Array.isArray(layout.artworkEdits))throw Error('This artwork layout is invalid.');
  const ids=designFor(designId).layers.map(l=>l.id);
  for(const [id,e] of Object.entries(layout.artworkEdits)){
   if(!ids.includes(id)||!e||(e.deleted!==undefined&&typeof e.deleted!=='boolean'))throw Error('This artwork layout is invalid.');
   artworkEdits[id]={...validatePlacement(e),...(e.deleted===true?{deleted:true}:{}),...(e.text!==undefined?validateText(e):{})};
  }
 }
 return {zoom:layout.zoom,x:layout.x,y:layout.y,artworkEdits};
}
// Keep template layers declarative: flattening them would lose their scale and image assets.
export function collectionForPhoto(selection,photoArtwork=[]){
 const collectionLayout=validateCollectionLayout(selection.designId,selection);
 const existing=validateAddedArtwork(photoArtwork),ids=new Set(existing.map(a=>a.id));
 const addedArtwork=validateAddedArtwork([...existing,...validateAddedArtwork(selection.addedArtwork).filter(a=>!ids.has(a.id))]);
 return {collectionLayout,addedArtwork};
}
export function makePersonalDesign({source='collection',designId='bloom',photo='',effect='original',intensity=65,zoom=100,x=50,y=50,artworkEdits={},addedArtwork=[],photoPlacement,collectionLayout,phoneTemplateId},original=false) {
  if(!effects.some(e=>e.id===effect))throw Error('Choose an available effect.');
  if(source==='photo'&&!isPhoto(photo))throw Error('Upload a JPG, PNG or WebP photo first.');
  let design=source==='photo'?{art:'solid',image:photo,background:'#fef4e8',style:'original',zoom:clamp(zoom,100,180,100),photoX:clamp(x,0,100,50),photoY:clamp(y,0,100,50),layers:[],caption:'',enhance:false}:designFor(designId);
  if(source==='collection'){
    const scale=clamp(zoom,50,180,100)/100;
    design.layers=design.layers.filter(layer=>artworkEdits[layer.id]?.deleted!==true).map(layer=>{
      const edit=artworkEdits[layer.id]||{},size=layer.size*clamp(edit.scale,25,200,100)/100;
      return {...layer,...(layer.type==='text'&&edit.text!==undefined?validateText(edit):{}),x:50+(clamp(edit.x,0,100,layer.x)-50)*scale+clamp(x,0,100,50)-50,y:50+(clamp(edit.y,0,100,layer.y)-50)*scale+clamp(y,0,100,50)-50,size:size*scale,rotation:clamp(edit.rotation,-180,180,layer.rotation)};
    });
  }
  if(source==='photo'&&collectionLayout){design.layers=makePersonalDesign({source:'collection',designId,...validateCollectionLayout(designId,collectionLayout)}).layers;}
  design.layers.push(...validateAddedArtwork(addedArtwork).map(a=>({...a,size:(a.type==='text'?75:45)*a.scale/100})));
  if(source==='photo'&&photoPlacement){design.photoPlacement=validatePlacement(photoPlacement);design.zoom=100;}
  if(effect!=='original'&&!original)design=createBeautyPreview(design,{preset:effect,intensity:clamp(intensity,0,100,65)});
  if(phoneTemplateId)design.phoneTemplateId=phoneTemplateId;
  return design;
}
export function validatePersonalPass(pass) {
  if(!pass || !/^POP-C-[A-F0-9]{16}$/.test(pass.code) || pass.version!==2 || !['photo','collection'].includes(pass.source))throw Error('This custom design pass is invalid. Create a new one.');
  if(!effects.some(e=>e.id===pass.effect) || !Number.isFinite(pass.intensity) || pass.intensity<0 || pass.intensity>100)throw Error('This design effect is invalid.');
  if(pass.source==='photo'&&!isPhoto(pass.photo))throw Error('The photo for this pass is missing. Create a new pass.');
  if(![pass.zoom,pass.x,pass.y].every(Number.isFinite)||pass.zoom<(pass.source==='collection'?50:100)||pass.zoom>180||pass.x<0||pass.x>100||pass.y<0||pass.y>100)throw Error('This photo crop is invalid.');
  const artworkEdits=pass.source==='collection'?validateCollectionLayout(pass.designId,pass).artworkEdits:{};
  const collectionLayout=pass.source==='photo'&&pass.collectionLayout!==undefined?validateCollectionLayout(pass.designId,pass.collectionLayout):undefined;
  const addedArtwork=validateAddedArtwork(pass.addedArtwork),photoPlacement=pass.source==='photo'&&pass.photoPlacement?validatePlacement(pass.photoPlacement):undefined;
  if(pass.phoneTemplateId!==undefined)phoneTemplate(pass.model,pass.phoneTemplateId);
  // Store declarative selections, then reconstruct with trusted local renderers.
  return structuredClone({version:2,...(pass.phoneTemplateId?{phoneTemplateId:pass.phoneTemplateId}:{}),code:pass.code,source:pass.source,designId:pass.designId,model:pass.model,photo:pass.source==='photo'?pass.photo:'',effect:pass.effect,intensity:pass.intensity,zoom:pass.zoom,x:pass.x,y:pass.y,...(addedArtwork.length?{addedArtwork}:{}),...(photoPlacement?{photoPlacement}:{}),...(collectionLayout?{collectionLayout}:{}),...(Object.keys(artworkEdits).length?{artworkEdits}:{}),...(pass.source==='photo'&&['demo','live'].includes(pass.ai?.mode)&&/^[a-zA-Z0-9_-]{1,80}$/.test(pass.ai.styleId||'')?{ai:{styleId:pass.ai.styleId,jobId:String(pass.ai.jobId||'').slice(0,50),mode:pass.ai.mode}}:{})});
}
export function personalPassName(pass,designs) {return pass.source==='photo'?'Your photo':designs.find(d=>d.id===pass.designId)?.name||'Your design';}
