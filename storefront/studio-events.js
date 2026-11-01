import {ui,tx,catalogCards,layerControls} from './studio-view.js';
import {designFor} from './catalog.js';
import {addLayer,updateLayer,layerAction} from './editor-model.js';
import {localize} from './i18n.js';
export function installStudio({app,getState,setDesign,render,refresh,persist,toast,go,upload}){
 const checkpoint=()=>ui.history.push(getState().design);
 const selected=()=>getState().design.layers?.find(l=>l.id===ui.selected);
 const commit=()=>{persist();render();};
 const controls=()=>{const el=document.getElementById('layer-panel');if(el){el.innerHTML=layerControls(getState());localize(el);}decorateCanvas();};
 function decorateCanvas(){app.querySelectorAll('[data-editor=undo]').forEach(b=>b.disabled=!ui.history.canUndo);app.querySelectorAll('[data-editor=redo]').forEach(b=>b.disabled=!ui.history.canRedo);const canvas=document.querySelector('#live-phone .phone-case');if(!canvas)return;canvas.setAttribute('role','group');canvas.querySelectorAll('[data-layer-id]').forEach(el=>{el.classList.toggle('selected',el.dataset.layerId===ui.selected);el.tabIndex=0;el.setAttribute('role','button');const l=getState().design.layers?.find(x=>x.id===el.dataset.layerId);el.setAttribute('aria-label',tx('选择图层：','Select layer: ')+(l?.text||l?.asset||tx('照片','Photo')));el.setAttribute('aria-pressed',String(el.dataset.layerId===ui.selected));});}
 app.addEventListener('click',e=>{const legacy=e.target.closest('[data-action]');if(legacy&&['style','enhance','reset-design','art','template'].includes(legacy.dataset.action))checkpoint();},true);
 app.addEventListener('click',e=>{const el=e.target.closest('[data-editor]');if(!el||el.disabled)return;const s=getState(),a=el.dataset.editor;
  if(a==='tab'){ui.tab=el.dataset.id;render();document.getElementById('tab-'+ui.tab)?.focus();return;}
  if(a==='filter'){const home=el.dataset.scope==='home';ui[home?'homeFilter':'filter']=el.dataset.id;render();return;}
  if(a==='expand'){ui.expanded=!ui.expanded;render();return;}
  if(a==='favorite'){s.favorites??=[];s.favorites=s.favorites.includes(el.dataset.id)?s.favorites.filter(x=>x!==el.dataset.id):[...s.favorites,el.dataset.id];return commit();}
  if(a==='preset'){checkpoint();setDesign(designFor(el.dataset.id));ui.selected=null;persist();go('studio');toast(tx('已套用图案，可继续编辑或撤销','Design applied. Keep editing or undo.'));return;}
  if(a==='undo'||a==='redo'){const d=ui.history[a](s.design);if(d){setDesign(d);ui.selected=null;commit();}return;}
  if(a==='select'){ui.selected=el.dataset.id;controls();return;}
  if(a==='sticker'||a==='text'){const value=a==='text'?document.getElementById('new-text').value.trim():el.dataset.id;if(a==='text'&&!value){document.getElementById('new-text').focus();return toast(tx('先写一段文字','Enter some text first'));}if((s.design.layers||[]).length>=20)return toast(tx('最多添加 20 个图层','You can add up to 20 layers'));checkpoint();ui.selected=addLayer(s.design,a==='text'?'text':'sticker',value);commit();return;}
  if(a==='background'){checkpoint();s.design.art='solid';s.design.image='';s.design.background=el.dataset.color;s.design.zoom=100;return commit();}
  if(['delete','duplicate','front','back'].includes(a)&&selected()){checkpoint();ui.selected=layerAction(s.design,ui.selected,a);commit();}
 });
 app.addEventListener('input',e=>{const el=e.target,s=getState();if(el.id==='new-text')ui.newText=el.value;if(el.id==='design-search'||el.id==='home-search'){const home=el.id==='home-search';ui[home?'homeQuery':'query']=el.value;document.getElementById(home?'home-catalog':'studio-catalog').innerHTML=catalogCards(s,home);return;}
  const key=el.dataset.layerField||({'layer-text':'text','layer-color':'color','layer-font':'font'})[el.id];if(key&&selected()){updateLayer(s.design,ui.selected,{[key]:el.value});const out=document.getElementById('value-'+key);if(out)out.textContent=el.value+(key==='rotation'?'°':'%');refresh();decorateCanvas();persist();}
 });
 let editingTarget=null,editRecorded=false;
 app.addEventListener('focusin',e=>{editingTarget=e.target;editRecorded=false;});
 app.addEventListener('input',e=>{if(!e.target.matches('[data-layer-field],#layer-text,#layer-color,#layer-font,#zoom,#caption'))return;if(editingTarget!==e.target){editingTarget=e.target;editRecorded=false;}if(!editRecorded){checkpoint();editRecorded=true;}},true);
 app.addEventListener('change',e=>{if(e.target.id==='layer-photo')upload(e.target.files[0],true);if(e.target.id==='layer-font'){updateLayer(getState().design,ui.selected,{font:e.target.value});refresh();decorateCanvas();persist();}});
 app.addEventListener('keydown',e=>{const tab=e.target.closest('[role="tab"]');if(tab&&['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const tabs=[...app.querySelectorAll('[role="tab"]')],i=tabs.indexOf(tab),next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;ui.tab=tabs[next].dataset.id;render();document.getElementById('tab-'+ui.tab).focus();return;}
  const layer=e.target.closest('[data-layer-id]');if(!layer)return;ui.selected=layer.dataset.layerId;if(e.key==='Enter'||e.key===' '){e.preventDefault();controls();return;}const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(delta&&selected()){e.preventDefault();checkpoint();const l=selected(),n=e.shiftKey?5:1;updateLayer(getState().design,l.id,{x:l.x+delta[0]*n,y:l.y+delta[1]*n});persist();refresh();controls();document.querySelector(`[data-layer-id="${l.id}"]`)?.focus();}
 });
 let drag=null;
 app.addEventListener('pointerdown',e=>{const el=e.target.closest('#live-phone [data-layer-id]');if(!el)return;e.preventDefault();ui.selected=el.dataset.layerId;const l=selected();if(!l)return;const bounds=el.closest('.phone-case').getBoundingClientRect();drag={id:l.id,x:l.x,y:l.y,startX:e.clientX,startY:e.clientY,width:bounds.width,height:bounds.height,el,before:structuredClone(getState().design),recorded:false};el.setPointerCapture(e.pointerId);controls();});
 app.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(!drag.recorded){if(Math.hypot(dx,dy)<2)return;ui.history.push(drag.before);drag.recorded=true;}updateLayer(getState().design,drag.id,{x:drag.x+dx/drag.width*100,y:drag.y+dy/drag.height*100});const l=selected();drag.el.style.left=l.x+'%';drag.el.style.top=l.y+'%';});
 const endDrag=()=>{if(!drag)return;drag=null;persist();refresh();controls();};app.addEventListener('pointerup',endDrag);app.addEventListener('pointercancel',endDrag);
 return {decorateCanvas,checkpoint};
}
