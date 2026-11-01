import {phoneTemplate} from './phone-templates.js';
import {photoEffect} from './beautify-core.js';
import {fonts} from './editor-model.js';
import {stickers} from './catalog.js';

// Same cover/object-position geometry as the editor. All coordinates are in
// the full template canvas, including its non-printing camera/frame margins.
export function coverRect(iw,ih,w,h,x=50,y=50){
 const scale=Math.max(w/iw,h/ih),width=iw*scale,height=ih*scale;
 return {x:(w-width)*x/100,y:(h-height)*y/100,width,height,scale};
}
export function textLines(text,maxWidth,measure){
 const lines=[];
 for(const paragraph of String(text).replace(/\r\n?/g,'\n').split('\n')){
  let line='';
  for(const token of paragraph.match(/\s+|[^\s]+/gu)||[]){
   if(line&&measure(line+token)>maxWidth){lines.push(line);line='';}
   for(const char of token){
    if(line&&measure(line+char)>maxWidth){lines.push(line);line='';}
    line+=char;
   }
  }
  lines.push(line);
 }
 return lines;
}

export function exportImageUrl(src,baseUrl){
 // The same renderer runs at / and /admin/orders. Saved original asset paths
 // must always resolve at the site root, not inside the admin bundle directory.
 const url=new URL(src.replace(/^\.\/assets\//,'/assets/'),baseUrl);
 if(url.origin!==new URL(baseUrl).origin&&!/^data:image\/(png|jpeg|webp);base64,/.test(src))throw Error('An image could not be loaded. Try again.');
 return url.href;
}
function loadImage(src){
 const url=exportImageUrl(src,location.href);
 return new Promise((resolve,reject)=>{
  const image=new Image(),timer=setTimeout(()=>reject(Error('An image could not be loaded. Try again.')),15000);
  image.onload=()=>{clearTimeout(timer);resolve(image);};
  image.onerror=()=>{clearTimeout(timer);reject(Error('An image could not be loaded. Try again.'));};
  // Only original same-origin assets and validated uploads; never thumbnails.
  image.src=url;
 });
}
function canvas(width,height){const el=document.createElement('canvas');el.width=width;el.height=height;return el;}
function filter(ctx,value){
 if(value!=='none'&&!('filter' in ctx))throw Error('This browser cannot export photo effects. Try Chrome.');
 ctx.filter=value;
}
function drawCover(ctx,img,w,h,x,y){
 const box=coverRect(img.naturalWidth,img.naturalHeight,w,h,x,y);
 ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.drawImage(img,box.x,box.y,box.width,box.height);ctx.restore();
 return box.scale;
}
async function drawArtwork(design,w,h){
 const output=canvas(w,h),ctx=output.getContext('2d'),base=canvas(w,h),bg=base.getContext('2d');
 if(!ctx||!bg)throw Error('Image export is unavailable in this browser.');
 let effectiveDpi=Infinity;
 bg.fillStyle=design.background||'#fef4e8';bg.fillRect(0,0,w,h);
 if(design.image){
  const img=await loadImage(design.image),p=design.photoPlacement;
  bg.save();
  if(p){bg.translate(w*p.x/100,h*p.y/100);bg.rotate(p.rotation*Math.PI/180);bg.scale(p.scale/100,p.scale/100);bg.translate(-w/2,-h/2);}
  const factor=drawCover(bg,img,w,h,design.photoX??50,design.photoY??50);
  effectiveDpi=300/(factor*(p?p.scale/100:1)*(design.zoom||100)/100);
  bg.restore();
 }else if(design.art&&design.art!=='solid'){
  // Current editable collections use declarative layers. Do not silently omit
  // a legacy SVG design if another caller tries exporting it.
  throw Error('Choose an editable design before exporting.');
 }
 ctx.save();filter(ctx,design.image||design.art!=='solid'?photoEffect(design):'none');
 const zoom=(design.zoom||100)/100;
 ctx.translate(w/2,h/2);ctx.scale(zoom,zoom);ctx.drawImage(base,-w/2,-h/2);ctx.restore();
 await document.fonts.ready;
 for(const layer of design.layers||[]){
  const width=w*layer.size/100;
  ctx.save();ctx.translate(w*layer.x/100,h*layer.y/100);ctx.rotate(layer.rotation*Math.PI/180);
  if(layer.type==='text'){
   const size=w*layer.size*.0018,lineHeight=size*1.15;
   ctx.font=`700 ${size}px ${fonts[layer.font]||fonts.sans}`;
   const lines=textLines(layer.text,width,t=>ctx.measureText(t).width),m=ctx.measureText('Mg');
   const ascent=m.fontBoundingBoxAscent??size*.8,descent=m.fontBoundingBoxDescent??size*.2;
   const baseline=-lines.length*lineHeight/2+(lineHeight-ascent-descent)/2+ascent;
   ctx.fillStyle=layer.color;ctx.textAlign='center';ctx.textBaseline='alphabetic';
   lines.forEach((line,i)=>ctx.fillText(line,0,baseline+i*lineHeight));
  }else{
   const src=layer.type==='image'?layer.src:stickers.find(s=>s.id===layer.asset)?.src;
   if(!src)throw Error('An image could not be loaded. Try again.');
   const img=await loadImage(src),height=width*img.naturalHeight/img.naturalWidth;
   filter(ctx,layer.type==='image'&&layer.source?.type!=='sticker'&&!layer.locked?photoEffect(design):'none');
   ctx.drawImage(img,-width/2,-height/2,width,height);
   if(!/\.svg(?:\?|$)/i.test(src))effectiveDpi=Math.min(effectiveDpi,300*img.naturalWidth/width);
  }
  ctx.restore();
 }
 return {output,effectiveDpi};
}

export function crc32(bytes){
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
// Canvas normally writes 96 DPI. Replace pHYs, including its CRC, rather than
// merely renaming the file or relying on CSS/display dimensions.
export function pngWithDpi(bytes,dpi=300){
 const signature=[137,80,78,71,13,10,26,10];
 if(!signature.every((v,i)=>bytes[i]===v)||!Number.isFinite(dpi)||dpi<=0)throw Error('Invalid PNG export.');
 const physical=new Uint8Array(21),v=new DataView(physical.buffer),ppm=Math.round(dpi/.0254);
 v.setUint32(0,9);physical.set([112,72,89,115],4);v.setUint32(8,ppm);v.setUint32(12,ppm);physical[16]=1;v.setUint32(17,crc32(physical.subarray(4,17)));
 const chunks=[bytes.subarray(0,8)],view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let ended=false;
 for(let offset=8;offset+12<=bytes.length;){
  const length=view.getUint32(offset),end=offset+length+12;
  if(end>bytes.length)throw Error('Invalid PNG export.');
  const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
  if(type!=='pHYs')chunks.push(bytes.subarray(offset,end));
  if(type==='IHDR')chunks.push(physical);
  offset=end;if(type==='IEND'){ended=true;break;}
 }
 if(!ended)throw Error('Invalid PNG export.');
 const result=new Uint8Array(chunks.reduce((n,c)=>n+c.length,0));let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}
 return result;
}
export async function exportCase(design,model,kind='print'){
 const template=phoneTemplate(model,design.phoneTemplateId);
 if(!template)throw Error('A print template is not available for this model yet.');
 if(!['print','preview'].includes(kind))throw Error('Invalid export type.');
 const {printWidth:w,printHeight:h}=template;
 const [{output,effectiveDpi},mask]=await Promise.all([drawArtwork(design,w,h),loadImage(template.mask)]);
 const ctx=output.getContext('2d');ctx.globalCompositeOperation='destination-in';ctx.drawImage(mask,0,0,w,h);ctx.globalCompositeOperation='source-over';
 if(kind==='preview'){
  ctx.drawImage(await loadImage(template.previewOverlay),0,0,w,h);
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='white';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='source-over';
 }
 const raw=await new Promise((resolve,reject)=>output.toBlob(b=>b?resolve(b):reject(Error('Image export failed. Try again.')),'image/png'));
 const blob=new Blob([pngWithDpi(new Uint8Array(await raw.arrayBuffer()),template.dpi)],{type:'image/png'});
 return {blob,filename:`${template.id}-${kind}-${template.dpi}dpi.png`,template,effectiveDpi};
}
