import {stickers} from './catalog.js';
export const MAX_LAYERS=20;
export const fonts={sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'monospace',hand:'cursive'};
export const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
export function addLayer(design,type,value){design.layers??=[];if(design.layers.length>=MAX_LAYERS)return null;
 const layer={id:crypto.randomUUID(),type,x:55,y:60,size:35,rotation:0};
 if(type==='sticker'){if(!stickers.some(s=>s.id===value))return null;layer.asset=value;layer.source={contentId:'sticker-'+value,creatorId:stickers.find(s=>s.id===value).creatorId,version:1,type:'sticker'};}
 else if(type==='text'){layer.text=String(value||'Your moment').slice(0,40);layer.color='#283637';layer.font='sans';layer.size=55;}
 else if(type==='image'){layer.src=value;layer.size=60;}else return null;
 design.layers.push(layer);return layer.id;
}
export function updateLayer(design,id,patch){const layer=(design.layers||[]).find(l=>l.id===id);if(!layer)return false;
 for(const [key,value]of Object.entries(patch)){if(key==='x'||key==='y')layer[key]=clamp(value,5,95);else if(key==='size')layer.size=clamp(value,12,90);else if(key==='rotation')layer.rotation=clamp(value,-180,180);else if(key==='text'&&layer.type==='text')layer.text=String(value).slice(0,40);else if(key==='font'&&fonts[value])layer.font=value;else if(key==='color'&&/^#[a-f\d]{6}$/i.test(value))layer.color=value;}
 return true;
}
export function layerAction(design,id,action){const list=design.layers||[],index=list.findIndex(l=>l.id===id);if(index<0)return null;
 if(action==='delete'){list.splice(index,1);return null;}
 if(action==='duplicate'){if(list.length>=MAX_LAYERS)return id;const copy={...list[index],id:crypto.randomUUID(),x:clamp(list[index].x+5,5,95),y:clamp(list[index].y+5,5,95)};list.push(copy);return copy.id;}
 const next=action==='front'?Math.min(index+1,list.length-1):Math.max(index-1,0);[list[index],list[next]]=[list[next],list[index]];return id;
}
export function createHistory(limit=30){let undo=[],redo=[];return {push(design){undo.push(structuredClone(design));if(undo.length>limit)undo.shift();redo=[];},undo(design){if(!undo.length)return null;redo.push(structuredClone(design));return undo.pop();},redo(design){if(!redo.length)return null;undo.push(structuredClone(design));return redo.pop();},get canUndo(){return !!undo.length;},get canRedo(){return !!redo.length;}};}
