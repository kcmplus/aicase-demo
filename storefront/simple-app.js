import {t,locale,setLocale,localized,languageControl,localize} from './simple-i18n.js';
import {imageTag} from './image-view.js';
import {orderRequest,savedOrder,checkoutBody,checkoutEmailField,getPaymentConfig,stripeCheckoutUrl} from './order-service.js';
import {phoneBrand,phoneBrands,findPhoneModels} from './phone-catalog.js';
import {fonts} from './editor-model.js';
import {dragPlacement,scaleFromPointer,rotationFromPointer,rotateGroup} from './artwork-drag.js';
import {freshOrders,orderForCode,currentOrder,commitPrintOrder,beginOrderPrint} from './print-orders.js';
import {freshMembership,refreshMembership,migrateRender} from './ai-membership.js';
import {PRINT_PRICE,PRINT_PRICE_CENTS,PRINT_AVAILABLE,money} from './simple-pricing.js';
import {loadCatalog,catalogStatus,AI_GENERATION_CONNECTED} from './runtime-catalog.js';
import {aiExamples,exampleFor} from './ai-examples.js';
import {designFor,stickers} from './catalog.js';
import {phone, icon, brandLogo, esc} from './art.js';
import {designs, selectablePhoneModels as phoneModels, stations, readPass, stationAvailability, advancePrint, createPersonalPass} from './simple-core.js';

import {effects, validateAddedArtwork, validatePlacement, isPhoto, makePersonalDesign, personalPassName} from './simple-personalize.js';
import {readDesign, writeDesign, updateDesign} from './simple-storage.js';
import {stylePanel, aiPage, membershipPage} from './ai-view.js';
import {setAIView,setAIComparison,mountAIStudio} from './ai-interactions.js';
import {activeLook,lookBrowserContent,setLookMode,setLookComparison,updateLookImageState} from './ai-look-browser.js';
import {aiStyles,refreshAIOrder,canApplyAIOrder} from './ai-core.js';
import {createLiveRender,getAIAccount,changeAIAccount,submitLiveRender,refreshLiveRender,cancelLiveRender} from './ai-service.js';
import {importPhoto} from './simple-upload.js';
import {customerPage,sendEmailCode,verifyEmailCode,signOutCustomer,updateCustomerName,getCustomerCredits} from './customer-account.js';
import {create as createQR} from './vendor/qr.js';

const KEY = 'popomo-demo-simple-v1';
const app = document.querySelector('#app');
app.textContent=t('Loading POPOMO…');
await loadCatalog();
let state = {designId:'bloom',model:'',pass:null,stationId:'DEMO-01',job:null,source:'collection',photo:'',effect:'original',intensity:65,zoom:100,x:50,y:50,aiStyle:'anime',aiExample:'portrait',artworkLayouts:{},photoArtwork:[],keepCollection:false,photoPlacement:null,photoOrigin:'upload',ai:null,aiJobId:null};
let storageWarning = false;
let aiJob=null,aiBusy=false;
const aiUi={mode:'pair',compare:50,lookMode:'effect',lookCompare:50,accepted:false,error:'',reconnecting:false};
let cleanupAIStudio=()=>{};
const customerUI={email:'',codeSent:false,busy:false,error:'',success:'',ledger:[],ledgerNext:null,ledgerOpen:false,ledgerBusy:false,ledgerError:'',resendAt:0,next:'choose'};
let resendTimer;
let membership=await updateDesign('ai-membership-v1',a=>({...refreshMembership(a),server:true,authenticated:false,customer:null,trialRemaining:0,subscription:null}),freshMembership());
let orderBook=await updateDesign('print-orders-v1',v=>v,freshOrders());
let checkoutDraft=await readDesign('checkout-draft');
let orderRows=[],orderPage=1,orderHasMore=false,orderError='';
let paymentConfig=null,paymentError='',paymentOrder=null,paymentPollTimer,paymentPollCount=0;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved) {
    if (designs.some(d=>d.id===saved.designId)) state.designId=saved.designId;
    if (phoneModels.includes(saved.model)) state.model=saved.model;
    if (stations.some(s=>s.id===saved.stationId)) state.stationId=saved.stationId;
    if(aiStyles.some(s=>s.id===saved.aiStyle))state.aiStyle=saved.aiStyle;
    state.aiExample=exampleFor(saved.aiExample).id;
    if(!exampleFor(state.aiExample).results[state.aiStyle])state.aiStyle=Object.keys(exampleFor(state.aiExample).results)[0];
    state.photoOrigin=aiExamples.some(e=>e.origin===saved.photoOrigin)?saved.photoOrigin:'upload';
    if(typeof saved.editOrderId==='string')state.editOrderId=saved.editOrderId;
    if(saved.ai&&/^[a-zA-Z0-9_-]{1,80}$/.test(saved.ai.styleId||''))state.ai=saved.ai;
    if(typeof saved.aiJobId==='string'){try{aiJob=await updateDesign('ai-job:'+saved.aiJobId,refreshAIOrder);state.aiJobId=aiJob.id;}catch{}
      if(membership.jobs[saved.aiJobId]){aiJob=membership.jobs[saved.aiJobId];state.aiJobId=aiJob.id;}}
    if(saved.artworkLayouts&&typeof saved.artworkLayouts==='object')for(const [id,layout] of Object.entries(saved.artworkLayouts)){
      try{const p=createPersonalPass({source:'collection',designId:id,model:phoneModels[0],effect:'original',intensity:0,zoom:layout.zoom,x:layout.x,y:layout.y,artworkEdits:layout.artworkEdits,addedArtwork:layout.addedArtwork});state.artworkLayouts[id]={zoom:p.zoom,x:p.x,y:p.y,artworkEdits:p.artworkEdits||{},addedArtwork:p.addedArtwork||[]};}catch{}
    }
    try{state.photoArtwork=validateAddedArtwork(saved.photoArtwork);if(saved.photoPlacement)state.photoPlacement=validatePlacement(saved.photoPlacement);}catch{}
    if (saved.source==='photo')state.source='photo';
    state.keepCollection=saved.keepCollection===true;
    if(effects.some(e=>e.id===saved.effect))state.effect=saved.effect;
    for(const [key,min,max] of [['intensity',0,100],['zoom',100,180],['x',0,100],['y',0,100]])if(Number.isFinite(saved[key]))state[key]=Math.max(min,Math.min(max,saved[key]));
    try{const photo=await readDesign('draft-photo');if(isPhoto(photo))state.photo=photo;}catch{}
    if (saved.pass) {try{state.pass=await resolvePass(saved.pass.code);}catch{}}
    if (saved.job && ['printing','ready','collected'].includes(saved.job.status) && stations.some(s=>s.id===saved.job.stationId)) {
      try{state.job={...saved.job,pass:await resolvePass(saved.job.pass.code)};}catch{}
    }
  }
} catch { /* Missing or invalid local data starts a fresh session. */ }
state.aiExample=exampleFor(state.aiExample).id;
if(!exampleFor(state.aiExample).results[state.aiStyle])state.aiStyle=Object.keys(exampleFor(state.aiExample).results)[0]||'';
membership=await updateDesign('ai-membership-v1',a=>migrateRender(a,aiJob),freshMembership());
if(aiJob)aiJob=membership.jobs[aiJob.id];
if(aiJob?.status==='awaiting_confirmation')customerUI.next='ai';
try{await syncAIAccount();if(aiJob?.mode==='live')await rememberLiveJob(await refreshLiveRender(aiJob));}catch{/* A saved job can be resumed when the service returns. */}
let scannedPass = null;
let noticeTimer;
let comparing=false,photoBusy=false,passBusy=false;
let effectPanelOpen=false,cropPanelOpen=false,selectedArtwork=null,libraryExpanded=false;
const editorPanels={collection:false,graphics:false};
let canvasExpanded=false,canvasObserver=null,canvasHome=null;
let modelBrand=phoneBrand(state.model||phoneModels[0]),modelQuery='';
let textDraft={font:'sans',color:'#242822'},inlineTextId=null;
function layoutSelection(value){
 if(value.source==='collection'&&value.artworkLayouts)return {...value,zoom:100,x:50,y:50,artworkEdits:{},addedArtwork:[],...value.artworkLayouts[value.designId]};
 if(value.source==='photo'&&value.artworkLayouts){
  const layout=value.artworkLayouts[value.designId]||{zoom:100,x:50,y:50,artworkEdits:{}};
  if(value.keepCollection&&!value.photo)return {...value,...layout,source:'collection',addedArtwork:value.photoArtwork||[]};
  return {...value,addedArtwork:value.photoArtwork||[],...(value.keepCollection?{collectionLayout:{zoom:layout.zoom,x:layout.x,y:layout.y,artworkEdits:layout.artworkEdits}}:{}),photoPlacement:value.photoPlacement||{x:50,y:50,scale:value.zoom,rotation:0}};
 }
 return value;
}
function artworkLayout(){return state.artworkLayouts[state.designId]??={zoom:100,x:50,y:50,artworkEdits:{},addedArtwork:[]};}
function extraArtwork(){return state.source==='photo'?state.photoArtwork:(artworkLayout().addedArtwork??=[]);}
function photoTarget(){return state.photoPlacement??={x:50,y:50,scale:state.zoom,rotation:0};}
// A newly chosen photo starts clean.
// Call only after the replacement image has been decoded and saved successfully.
function clearPreviousPhotoArtwork(){
 state.photoArtwork=[];state.keepCollection=false;state.photoPlacement=null;
 artworkDrag=null;selectedArtwork='photo';comparing=false;
}
// Starting another photo must clear both the visible draft and its persisted image.
// Saved orders and render snapshots have their own copies and remain resumable.
async function clearPhotoDraft(){
 finishInlineText();
 await writeDesign('draft-photo','');
 Object.assign(state,{photo:'',photoOrigin:'upload',ai:null,effect:'original',intensity:65,zoom:100,x:50,y:50});
 clearPreviousPhotoArtwork();selectedArtwork=null;
 effectPanelOpen=false;cropPanelOpen=false;
 editorPanels.collection=false;editorPanels.graphics=false;
 Object.assign(aiUi,{accepted:false,error:''});
}
// The editor keeps a draft per template. Choosing from the home gallery begins
// a fresh editing session so drafts from the previous visit cannot reappear.
async function selectCollectionDesign(id,{startFresh=false}={}){
 if(!designs.some(design=>design.id===id))return;
 finishInlineText();
 if(startFresh){await clearPhotoDraft();state.artworkLayouts={};state.editOrderId=null;}
 state.designId=id;state.source='collection';
 artworkDrag=null;lastArtworkTap=null;selectedArtwork=startFresh?null:'all';comparing=false;
 save();
}
function artworkTarget(){
 if(selectedArtwork==='photo')return photoTarget();
 const extra=extraArtwork().find(a=>a.id===selectedArtwork);if(extra)return extra;
 const layout=artworkLayout();if(selectedArtwork==='all')return layout;
 const layer=designFor(state.designId).layers.find(l=>l.id===selectedArtwork);
 if(!layer)return null;
 return layout.artworkEdits[layer.id]??={x:layer.x,y:layer.y,scale:100,rotation:layer.rotation};
}
function selectedText(){if(!selectedArtwork||selectedArtwork==='photo'||state.source==='photo'&&!state.photo&&!state.keepCollection)return null;return makePersonalDesign(layoutSelection(state)).layers.find(l=>l.id===selectedArtwork&&l.type==='text');}
function syncTextTools(canvas){
 const selected=selectedText();let tools=document.querySelector('.text-quick-tools');
 if(!selected){tools?.remove();return;}
 if(!tools||tools.dataset.forText!==selected.id){
  tools?.remove();tools=document.createElement('div');tools.className='text-quick-tools';tools.dataset.forText=selected.id;tools.setAttribute('role','group');tools.setAttribute('aria-label',t('Text style shortcuts'));
  tools.innerHTML=`<span class="quick-label">Font</span><div class="quick-fonts">${[['sans','Modern'],['serif','Classic'],['hand','Handwritten'],['mono','Typewriter']].map(([font,name])=>`<button type="button" data-quick-font="${font}" aria-label="${name} font" title="${name}" style="font-family:${fonts[font]}">Aa</button>`).join('')}</div><span class="quick-label">Color</span><div class="quick-colors">${['#242822','#ffffff','#e44592','#146561','#f3c44d','#7964ac'].map((color,i)=>`<button type="button" data-quick-color="${color}" style="--color:${color}" aria-label="${['Charcoal','White','Pink','Teal','Gold','Purple'][i]} text" title="${['Charcoal','White','Pink','Teal','Gold','Purple'][i]}"></button>`).join('')}</div><label class="quick-custom">Custom<input type="color" data-text-field="color" aria-label="Custom text color"></label>`;
  localize(tools);(canvasExpanded?document.querySelector('.canvas-text-style'):canvas).append(tools);
 }
 for(const button of tools.querySelectorAll('[data-quick-font]'))button.setAttribute('aria-pressed',String(button.dataset.quickFont===selected.font));
 for(const button of tools.querySelectorAll('[data-quick-color]'))button.setAttribute('aria-pressed',String(button.dataset.quickColor===selected.color.toLowerCase()));
 const colorInput=tools.querySelector('input');if(document.activeElement!==colorInput)colorInput.value=selected.color;
 const host=canvasExpanded?document.querySelector('.canvas-text-style'):canvas;if(tools.parentElement!==host)host.append(tools);
 if(!canvasExpanded){const phone=canvas.querySelector('.phone-case');tools.style.top=Math.max(0,Math.min(phone.clientHeight-tools.offsetHeight,phone.clientHeight*selected.y/100-tools.offsetHeight/2))+'px';}
}
function writeInlineText(element){
 const selected=selectedText();if(!selected||selected.id!==inlineTextId)return;
 const text=element.innerText.replace(/\r/g,'').replace(/\u00a0/g,' ').slice(0,80);
 if(element.innerText.length>80){element.textContent=text;const range=document.createRange();range.selectNodeContents(element);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);}
 Object.assign(artworkTarget(),{text,font:selected.font,color:selected.color});save();
}
function finishInlineText(){
 if(!inlineTextId)return;
 const element=document.querySelector('[data-inline-text]');if(element)writeInlineText(element);
 inlineTextId=null;
 if(element){element.removeAttribute('contenteditable');element.removeAttribute('data-inline-text');element.removeAttribute('role');element.removeAttribute('aria-label');element.removeAttribute('aria-multiline');element.removeAttribute('tabindex');element.blur();}
 highlightArtwork();
}
function beginInlineText(selectAll=true){
 const selected=selectedText();if(!selected)return;
 if(inlineTextId&&inlineTextId!==selected.id)finishInlineText();
 inlineTextId=selected.id;
 const element=document.querySelector(`.artwork-canvas [data-layer-id="${selected.id}"] .layer-text`);
 element.setAttribute('contenteditable','plaintext-only');element.dataset.inlineText='true';element.setAttribute('role','textbox');element.setAttribute('aria-label',t('Edit text on case'));element.setAttribute('aria-multiline','true');element.tabIndex=0;element.spellcheck=false;
 element.closest('.large-preview').scrollIntoView({block:'nearest'});element.focus({preventScroll:true});
 const range=document.createRange();range.selectNodeContents(element);if(!selectAll)range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);highlightArtwork();
}
function applyTextStyle(field,value){
 const selected=selectedText();if(!selected)return;
 Object.assign(artworkTarget(),{text:selected.text,font:selected.font,color:selected.color,[field]:value});
 const element=document.querySelector(`.artwork-canvas [data-layer-id="${selected.id}"] .layer-text`);element.style[field==='font'?'fontFamily':'color']=field==='font'?fonts[value]:value;save();highlightArtwork();
}
function deleteSelectedArtwork(){
 if(!selectedArtwork||selectedArtwork==='photo'||selectedArtwork==='all'||artworkDrag||photoBusy||passBusy||aiBusy)return false;
 const id=selectedArtwork;
 if(!makePersonalDesign(layoutSelection(state)).layers.some(layer=>layer.id===id))return false;
 finishInlineText();
 if(id.startsWith('extra-')){
  // An overlay copied between the two sources is still the same user-created object.
  state.photoArtwork=state.photoArtwork.filter(item=>item.id!==id);
  const layout=artworkLayout();layout.addedArtwork=(layout.addedArtwork||[]).filter(item=>item.id!==id);
 }else artworkTarget().deleted=true;
 selectedArtwork=null;lastArtworkTap=null;save();updatePreview();notify('Artwork deleted.');return true;
}
function resetPresetLayer(id){const edits=artworkLayout().artworkEdits,edit=edits[id],base=designFor(state.designId).layers.find(l=>l.id===id);if(edit?.deleted)return;if(edit?.text!==undefined&&base)edits[id]={x:base.x,y:base.y,scale:100,rotation:base.rotation,text:edit.text,font:edit.font,color:edit.color};else delete edits[id];}
function revealArtwork(){openCanvasEditor();}
function setArtwork(key,value){artworkTarget()[key]=value;save();updatePreview();}
function creativeLibrary(){
 const disabled=state.source==='photo'&&!state.photo&&!state.keepCollection,items=[...stickers.slice(12),...stickers.slice(0,12)];
 return `<details class="editor-panel" data-editor-panel="graphics" ${editorPanels.graphics?'open':''}><summary><span class="editor-tool-icon" aria-hidden="true">${icon('image',18)}</span><span>Graphics & text</span><span class="editor-chevron" aria-hidden="true">⌄</span></summary><div class="editor-panel-body"><section class="graphic-library"><div class="library-title"><h2>Graphic library</h2><span>24 graphics</span></div><p>Little details. A little more you.</p><div class="graphic-grid">${items.slice(0,libraryExpanded?24:12).map(a=>`<button type="button" data-add-graphic="${a.id}" aria-label="Add ${esc(locale()==='zh-CN'?a.zh:a.en)}" title="${esc(locale()==='zh-CN'?a.zh:a.en)}" ${disabled?'disabled':''}>${imageTag(a.src,{alt:"",sizes:"64px"})}<span>${esc(locale()==='zh-CN'?a.zh:a.en)}</span></button>`).join('')}</div><button class="text-button library-more" data-action="toggle-library">${libraryExpanded?'Show less':'View all 24 graphics'} ${libraryExpanded?'−':'+'}</button><p class="library-credit">Original POPOMO artwork + OpenMoji · CC BY-SA 4.0</p></section>
 <section class="text-editor"><h2>Your words</h2><p>Double-click text on your case to edit.<br>Choose fonts and colors right beside it.</p><button class="button text-add" data-action="text-submit" ${disabled?'disabled':''}>Add text ${icon('spark',16)}</button>${disabled?'<p class="field-note">Upload a photo to start adding graphics and text.</p>':''}</section></div></details>`;
}

async function rememberOrder(data){
 const previous=orderBook.orders[data.reference],order=savedOrder(data,previous);
 orderBook=await updateDesign('print-orders-v1',book=>{book.orders[order.id]=order;return book;},freshOrders());return order;
}
async function refreshOrder(id){return rememberOrder(await orderRequest(id+'/'));}
async function resolvePass(code){
 const key=String(code).trim().toUpperCase();orderBook=await readDesign('print-orders-v1')||freshOrders();let order=orderForCode(orderBook,key);
 if(order?.server)order=await refreshOrder(order.id);
 if(order)return currentOrder(orderBook,key).pass;
 return readPass(key,key.startsWith('POP-C-')?await readDesign(key):undefined);
}
async function orderAction(order,action,stationId){
 const data=await orderRequest(order.id+'/actions/',{method:'POST',body:{revision:order.revision,action,code:order.pass.code,...(stationId?{station_id:stationId}:{})}});
 return rememberOrder(data);
}
function qrSource(pass){
 if(pass.version!==2)return `./assets/passes/${pass.code}.svg`;
 const matrix=createQR(pass.code,{errorCorrectionLevel:'M'}).modules;let path='';
 for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x))path+=`M${x+4} ${y+4}h1v1h-1z`;
 const size=matrix.size+8;return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}"><path fill="white" d="M0 0h${size}v${size}H0z"/><path fill="#242822" d="${path}"/></svg>`);
}
function personalizedPreview(selection,model,label,original=false){
 return phone(makePersonalDesign(layoutSelection(selection),original),model).replace(/aria-label="[^"]*"/,`aria-label="${esc(label+' on '+model)}"`).replace('alt="你上传的设计照片"',`alt="Your uploaded photo"`);
}
const passName=p=>p.version===2?personalPassName(p,designs):currentDesign(p.designId).name;
const passPreview=p=>p.version===2?personalizedPreview(p,p.model,passName(p)):casePreview(p.designId,p.model);
const effectCaption=p=>p.source==='photo'&&p.ai?`<span class="effect-caption">✦ ${esc(localized(aiStyles.find(s=>s.id===p.ai.styleId))||t('AI style'))} · ${p.ai.mode==='live'?'AI image':'Demo sample'}</span>`:p.version===2&&p.effect!=='original'&&p.intensity>0?`<span class="effect-caption">${icon('spark',13)} ${effects.find(e=>e.id===p.effect).name} · AI effect preview</span>`:'';
function updatePreview(){finishInlineText();const el=document.querySelector('.large-case');if(el&&!(state.source==='photo'&&!state.photo&&!state.keepCollection))el.innerHTML=personalizedPreview(state,state.model||phoneModels[0],state.source==='photo'?'Your photo':currentDesign(state.designId).name,comparing);highlightArtwork();}
function highlightArtwork(){
 document.querySelector('.artwork-selection-actions')?.remove();
 const canvas=document.querySelector('.artwork-canvas');if(!canvas)return;
 const phone=canvas.querySelector('.phone-case');phone?.setAttribute('role','group');canvas.querySelector('.artwork-gizmo')?.remove();
 for(const layer of canvas.querySelectorAll('.design-layer')){layer.classList.remove('artwork-selected');layer.removeAttribute('aria-hidden');layer.setAttribute('role',layer.dataset.layerId===inlineTextId?'group':'button');layer.tabIndex=layer.dataset.layerId===inlineTextId?-1:0;layer.setAttribute('aria-label',t('Move')+' '+(layer.textContent.trim()||t('graphic')));layer.setAttribute('aria-pressed',String(layer.dataset.layerId===selectedArtwork));}
 canvas.classList.remove('whole-design-selected');
 const photo=canvas.querySelector('[data-photo-layer]');if(photo){photo.setAttribute('role','button');photo.tabIndex=0;photo.setAttribute('aria-label',t('Move your photo'));photo.setAttribute('aria-pressed',String(selectedArtwork==='photo'));}
 syncTextTools(canvas);
 syncCanvasControls();
 if(!canvasExpanded){for(const layer of canvas.querySelectorAll('[data-layer-id],[data-photo-layer]'))layer.tabIndex=-1;return;}
 canvas.setAttribute('aria-description',t(inlineTextId?'Type right here · Up to 80 characters · Tap outside to finish':selectedArtwork?'Drag to move · Corners to resize · ↻ to rotate · Tap outside to finish':'Tap artwork to adjust · Double-click text to edit'));
 if(!selectedArtwork)return;
 const all=selectedArtwork==='all',isPhotoLayer=selectedArtwork==='photo',model=makePersonalDesign(layoutSelection(state)),layer=model.layers.find(l=>l.id===selectedArtwork),element=isPhotoLayer?photo:all?null:canvas.querySelector(`[data-layer-id="${selectedArtwork}"]`),layout=artworkLayout(),placement=isPhotoLayer?photoTarget():null;
 if(!all&&!element)return;
 if(layer){
  const actions=document.createElement('div');actions.className='artwork-selection-actions';
  actions.innerHTML=`<button type="button" data-action="delete-artwork" aria-label="Delete selected artwork" title="Delete selected artwork (Delete / Backspace)">${icon('trash',17)} Delete</button>`;
  localize(actions);canvas.closest('.large-preview').append(actions);
 }
 const visualScale=isPhotoLayer?Math.min(placement.scale,100)/100:1;
 const cx=phone.offsetLeft+phone.clientLeft+(isPhotoLayer?phone.clientWidth*placement.x/100:all?phone.clientWidth*layout.x/100:element.offsetLeft),cy=phone.offsetTop+phone.clientTop+(isPhotoLayer?phone.clientHeight*placement.y/100:all?phone.clientHeight*layout.y/100:element.offsetTop),width=isPhotoLayer?phone.clientWidth*visualScale:all?phone.clientWidth*layout.zoom/100:element.offsetWidth,height=isPhotoLayer?phone.clientHeight*visualScale:all?phone.clientHeight*layout.zoom/100:element.offsetHeight;
 const box=document.createElement('div');box.className='artwork-gizmo';box.style.cssText=`left:${cx}px;top:${cy}px;width:${width}px;height:${height}px;transform:translate(-50%,-50%) rotate(${isPhotoLayer?placement.rotation:all?0:layer.rotation}deg)`;
 box.innerHTML=`${['nw','ne','sw','se'].map(c=>`<button type="button" class="artwork-handle resize-${c}" data-transform="scale" aria-label="Resize artwork ${c}" title="Drag to resize"></button>`).join('')}<span class="rotation-stem" aria-hidden="true"></span><button type="button" class="artwork-handle rotate-handle" data-transform="rotate" aria-label="Rotate artwork" title="Drag to rotate">↻</button><button type="button" class="artwork-reset" data-action="reset-artwork" aria-label="Reset selected artwork" title="Reset selected artwork">↺</button>${layer?.type==='text'?`<button type="button" class="artwork-edit-text" data-action="edit-text" aria-label="${inlineTextId?'Finish editing text':'Edit text on case'}" title="${inlineTextId?'Done':'Edit text'}">${inlineTextId?'✓':'✎'}</button>`:''}`;
 localize(box);canvas.append(box);
}
function refreshArtworkControls(){highlightArtwork();}
function canvasEditor(){
 return `<dialog class="canvas-editor" aria-labelledby="canvas-editor-title"><header class="canvas-editor-header"><div><h2 id="canvas-editor-title">Edit your design</h2><span>${esc(state.model||phoneModels[0])}</span></div><button type="button" class="canvas-done" data-action="close-canvas" autofocus>Done ${icon('check',16)}</button></header><div class="canvas-stage"></div><footer class="canvas-toolbar"><div class="canvas-toolbar-heading"><p class="canvas-selection-label">Tap a photo, graphic or text to adjust.</p><details class="canvas-text-options" hidden><summary>Text style <span>⌄</span></summary><div class="canvas-text-style"></div></details><button type="button" data-action="text-submit"><span aria-hidden="true">＋</span> Add text</button></div><div class="canvas-adjustments" hidden><div class="canvas-size"><label for="canvas-size">Size</label><input id="canvas-size" type="range" min="25" max="200" step="1" value="100"><output for="canvas-size">100%</output></div><div class="canvas-actions"><button type="button" data-action="rotate-canvas-artwork">↻ <span>Rotate</span></button><button type="button" data-action="reset-artwork">↺ <span>Reset</span></button><button type="button" data-action="edit-text" class="canvas-edit-text"><span aria-hidden="true">✎</span> <span>Edit text</span></button><button type="button" data-action="delete-artwork" class="canvas-delete">${icon('trash',16)} <span>Delete</span></button></div></div><p class="canvas-gesture-note">Drag to move · Use the corners to resize</p></footer></dialog>`;
}
function syncCanvasControls(){
 const dialog=document.querySelector('.canvas-editor');if(!dialog||!canvasExpanded)return;
 const target=selectedArtwork?artworkTarget():null,selected=selectedText();
 dialog.querySelector('.canvas-adjustments').hidden=false;
 dialog.querySelectorAll('.canvas-adjustments button,.canvas-adjustments input').forEach(control=>control.disabled=!target);
 dialog.querySelector('.canvas-selection-label').textContent=t(!target?'Tap a photo, graphic or text to adjust.':selected?'Text':selectedArtwork==='photo'?'Your photo':selectedArtwork==='all'?'Your design':'Graphic');
 dialog.querySelector('.canvas-edit-text').hidden=!selected;
 dialog.querySelector('.canvas-delete').hidden=!target||['all','photo'].includes(selectedArtwork);
 const textOptions=dialog.querySelector('.canvas-text-options');textOptions.hidden=!selected;if(!selected)textOptions.open=false;
 const value=target?target[selectedArtwork==='all'?'zoom':'scale']:100,slider=dialog.querySelector('#canvas-size');slider.min=selectedArtwork==='all'?50:25;slider.max=selectedArtwork==='all'?180:200;slider.value=value;dialog.querySelector('output').textContent=target?Math.round(value)+'%':'—';
}
function fitCanvasEditor(){
 const stage=document.querySelector('.canvas-stage'),canvas=stage?.querySelector('.artwork-canvas'),phone=canvas?.querySelector('.phone-case');if(!canvasExpanded||!phone)return;
 const ratio=phone.offsetWidth/phone.offsetHeight;
 const width=Math.max(45,Math.min(stage.clientWidth-88,(stage.clientHeight-80)*ratio,430));
 canvas.style.width=width+'px';highlightArtwork();
}
function openCanvasEditor(){
 const dialog=document.querySelector('.canvas-editor'),preview=document.querySelector('.large-preview');if(!dialog||!preview?.querySelector('.artwork-canvas')||dialog.open)return;
 finishInlineText();canvasExpanded=true;
 canvasHome=document.createComment('editor-preview');preview.before(canvasHome);dialog.querySelector('.canvas-stage').append(preview);
 if(state.source==='photo'&&!selectedArtwork)selectedArtwork='photo';
 document.body.classList.add('canvas-editor-open');dialog.showModal();
 canvasObserver?.disconnect();canvasObserver=new ResizeObserver(fitCanvasEditor);canvasObserver.observe(dialog.querySelector('.canvas-stage'));
 fitCanvasEditor();
}
function closeCanvasEditor({restoreFocus=true}={}){
 const dialog=document.querySelector('.canvas-editor');if(!dialog)return;
 finishInlineText();canvasExpanded=false;canvasObserver?.disconnect();canvasObserver=null;
 const preview=dialog.querySelector('.large-preview');if(preview){canvasHome?.replaceWith(preview);preview.querySelector('.artwork-canvas').style.removeProperty('width');}
 canvasHome=null;dialog.close();document.body.classList.remove('canvas-editor-open');selectedArtwork=null;lastArtworkTap=null;
 document.querySelector('.text-quick-tools')?.remove();updatePreview();save();
 if(restoreFocus)document.querySelector('[data-action="open-canvas"]')?.focus({preventScroll:true});
}
const arrow = () => icon('arrow',18);
const currentDesign = id => designs.find(d=>d.id===id) || designs[0];
const casePreview = (id,model=phoneModels[0]) => phone(designFor(id),model,'',{loading:'lazy',sizes:'(max-width: 700px) 100px, 180px'}).replace(/aria-label="[^"]*"/,`aria-label="${esc(currentDesign(id).name+' on '+model)}"`);
function save() {
  try {const ref=p=>p?.version===2?{code:p.code}:p;localStorage.setItem(KEY,JSON.stringify({...state,photo:undefined,pass:ref(state.pass),job:state.job?{...state.job,pass:ref(state.job.pass)}:null}));storageWarning=false;}
  catch {storageWarning=true;notify('Your browser could not save this pass. Download the QR code or write down the code.');}
}
function notify(message) {
  const el=document.querySelector('#notice');el.textContent=t(message);el.classList.add('visible');
  clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('visible'),5000);
}
function go(route) {if(location.hash==='#'+route)render();else location.hash=route;}
function header() {
  return `<header class="header wrap"><a class="wordmark" href="#home" aria-label="POPOMO home">${brandLogo()}</a><nav aria-label="Main navigation"><a href="#designs">The designs</a><a href="#orders">My orders</a></nav><a class="account-link" href="#account" aria-label="${membership.authenticated?'My account':'Sign in'}">${icon('user',18)}<span>${membership.authenticated?'My account':'Sign in'}</span></a><a class="saved-link" href="#pass">${icon('scan',18)}<span>My design</span>${state.pass?'<i aria-label="Design saved"></i>':''}</a>${languageControl()}</header>${aiJob&&['queued','generating','ready'].includes(aiJob.status)&&state.ai?.jobId!==aiJob.id?`<div class="ai-resume wrap"><a href="#ai">✦ AI studio · ${aiJob.status==='ready'?'Your AI image is ready':aiJob.status==='queued'?'Waiting in queue':'Rendering'} <span>View render →</span></a></div>`:''}`;
}
function footer() {
  return `<footer class="footer wrap"><a href="#home" class="footer-wordmark">POPOMO<span> A little more you.</span></a><p>Prototype · Scanning & printing are simulated.</p><a href="#kiosk">Station demo ${arrow()}</a></footer>`;
}
function steps(active) {
  return `<ol class="steps" aria-label="Your design journey">${['Pick your design','Confirm & save','Scan & print'].map((label,i)=>`<li ${i===active?'aria-current="step"':''} class="${i===active?'active':i<active?'complete':''}"><span>${i<active?'✓':i+1}</span>${label}</li>`).join('')}</ol>`;
}
function home() {
  const samplePhoto='./assets/ai-styles/pets-original.png';
  return `<section class="hero photo-home wrap">
   <div class="hero-scene photo-home-scene"><span class="scene-top">FROM YOUR ALBUM, WITH LOVE.</span><div class="photo-home-art"><figure class="album-snapshot">${imageTag(samplePhoto,{alt:'A pet photo used as a customization example',loading:'eager',sizes:'(max-width: 700px) 55vw, 300px'})}<figcaption>Your favorite photo</figcaption></figure><span class="photo-scene-arrow" aria-hidden="true">${arrow()}</span><div class="hero-case photo-result">${phone({image:samplePhoto},phoneModels[0])}</div><span class="scene-star" aria-hidden="true">✳</span></div><span class="scene-bottom">YOUR PHOTO. YOUR CASE.</span><span class="scene-number">Photo example</span><button type="button" class="photo-upload-target" data-action="home-photo" aria-label="Choose from your album" aria-busy="${photoBusy}" ${photoBusy?'disabled':''}><span class="photo-tap-hint">${icon('upload',15)} ${photoBusy?'Reading your photo…':'Tap the image to choose a photo'}</span></button></div>
   <div class="photo-home-action"><button type="button" class="photo-up-button" data-action="home-photo" aria-label="Choose from your album" aria-busy="${photoBusy}" ${photoBusy?'disabled':''}>${icon('upload',96)}</button><h1>${photoBusy?'Reading your photo…':'Choose from your album'}</h1><p>Your photo. Your own case.</p><a class="collection-home-link" href="#designs">Browse the gallery ${arrow()}</a></div>
   <input id="photo-file" data-home-upload type="file" accept="image/jpeg,image/png,image/webp" hidden>
  </section>
  <section class="how-section home-how" id="how-it-works"><div class="wrap how-layout"><div><p class="eyebrow">FROM YOUR SCREEN TO YOUR HAND.</p><h2>Your photo.<br>Your case.<br>Your everyday.</h2></div><ol class="how-list"><li><span>01</span><div><h3>Choose a photo you love.</h3><p>Pick a photo from your album, then choose your phone model and adjust the crop. AI effects are optional.</p></div></li><li><span>02</span><div><h3>Keep your code.</h3><p>Preview your design, confirm your ${PRINT_PRICE} print order, then save the QR code.</p></div></li><li><span>03</span><div><h3>Make it real.</h3><p>Show your code to the station scanner. Confirm your prepaid design, then print and collect.</p></div></li></ol></div></section>
  <section class="collection wrap home-gallery" id="designs"><div class="section-heading"><div><p class="eyebrow">A LITTLE INSPIRATION</p><h2>No photo in mind? Try the gallery.</h2></div><p>Ready-made designs, if you need a starting point.</p></div><div class="design-grid">${designs.map((d,i)=>`<a class="design-card" data-start-design="${d.id}" href="#choose?design=${d.id}" aria-label="Choose ${d.name}"><div class="design-image" style="--card:${d.color}"><span class="card-index">0${i+1}</span><div class="card-case">${casePreview(d.id)}</div><span class="card-arrow">${arrow()}</span></div><div class="card-caption"><div><h3>${d.name}</h3><p>${d.category}</p></div></div></a>`).join('')}</div></section>`;
}
function modelResults(){
 const models=findPhoneModels(phoneModels,modelBrand,modelQuery);
 return `<p class="model-result-count" role="status">${models.length} ${models.length===1?'model':'models'} available</p><div class="model-options model-template-options" role="group" aria-label="${esc(modelBrand)} models">${models.map(model=>`<button type="button" data-phone-model="${esc(model)}" aria-label="${esc(model)}" aria-pressed="${model===state.model}"><span class="model-template-preview" aria-hidden="true">${casePreview(state.designId,model)}</span><span class="model-template-name">${esc(model)}</span><span aria-hidden="true">${model===state.model?'✓':'→'}</span></button>`).join('')}</div>${models.length?'':'<p class="model-empty">No matching model. Try another search or brand.</p>'}`;
}
function modelPickerBody(){
 return `<div class="model-brand-section"><h2>1. Brand</h2><div class="model-brands" role="group" aria-label="Phone brand">${phoneBrands(phoneModels).map(brand=>`<button type="button" data-phone-brand="${esc(brand)}" aria-pressed="${brand===modelBrand}">${esc(brand)}</button>`).join('')}</div></div><div class="model-device-section"><label for="model-search">2. Model</label><input id="model-search" type="search" placeholder="Search ${esc(modelBrand)} models" aria-label="Search phone models" aria-describedby="model-first-note" autocomplete="off" value="${esc(modelQuery)}"><div class="model-results">${modelResults()}</div><p id="model-first-note">Choose the exact model in your phone’s settings. Pro and standard cases fit differently.</p></div>`;
}
function phonePicker(){
 modelBrand=phoneBrand(state.model||phoneModels[0]);modelQuery='';
 return `<details class="model-first" ${state.model?'':'open'}><summary><span class="model-summary-label">${state.model?'Your phone':'First, choose your phone'}</span><strong class="model-summary-value">${esc(state.model||'')}</strong><span class="model-summary-action">${state.model?'Change':'Choose'}</span><span class="model-summary-chevron" aria-hidden="true">⌄</span></summary><div class="model-first-body">${modelPickerBody()}</div></details>`;
}
function selectPhoneModel(model){
 if(!phoneModels.includes(model))return;
 state.model=model;modelBrand=phoneBrand(model);modelQuery='';save();updatePreview();
 for(const button of document.querySelectorAll('[data-design]')){
  const thumbnail=button.querySelector('.design-thumbnail-case');
  if(thumbnail)thumbnail.innerHTML=casePreview(button.dataset.design,model);
 }
 const panel=document.querySelector('.model-first');
 panel.querySelector('.model-summary-label').textContent='Your phone';
 panel.querySelector('.model-summary-value').textContent=model;
 panel.querySelector('.model-summary-action').textContent='Change';
 panel.querySelector('.model-first-body').innerHTML=modelPickerBody();
 localize(panel);panel.open=false;panel.querySelector('summary').focus({preventScroll:true});
}
function openPhotoPicker(){
 // Run inside the click gesture, before any await, so mobile browsers allow it.
 const input=document.querySelector('#photo-file');
 if(!input||photoBusy||aiBusy||passBusy)return;
 input.value=''; // Picking the same file again should still replace the draft.
 input.click();
}
function bindEditorPanel(panel){
 panel.addEventListener('toggle',()=>{
  if(!panel.isConnected)return;
  const remember=element=>{const key=element.dataset.editorPanel;if(key==='ai')effectPanelOpen=element.open;else editorPanels[key]=element.open;};
  remember(panel);
  if(panel.open)document.querySelectorAll('[data-editor-panel]').forEach(other=>{if(other!==panel&&other.open){other.open=false;remember(other);}});
 });
}
function refreshAIStudio({resetScroll=false}={}){
 const dialog=document.querySelector('.look-browser');if(!dialog)return;
 const scroll=resetScroll?0:dialog.querySelector('.look-filmstrip')?.scrollLeft||0,tabsScroll=dialog.querySelector('.look-subjects')?.scrollLeft||0;
 dialog.innerHTML=lookBrowserContent(state,aiJob,aiUi);localize(dialog);
 updateLookImageState(dialog);
 dialog.querySelector('.look-filmstrip').scrollLeft=scroll;dialog.querySelector('.look-subjects').scrollLeft=tabsScroll;
 const selected=dialog.querySelector('.look-thumb[aria-pressed=true]');selected?.focus({preventScroll:true});selected?.scrollIntoView({block:'nearest',inline:'nearest'});
 const label=document.querySelector('.ai-picker-launch small');if(label)label.textContent=localized(activeLook(state).look.style);
}
function openAIStudio(){
 const dialog=document.querySelector('.look-browser');if(!dialog)return;
 effectPanelOpen=true;
 document.querySelectorAll('[data-editor-panel]').forEach(panel=>panel.open=false);
 if(!dialog.open)dialog.showModal();
 updateLookImageState(dialog);
 dialog.querySelector('.look-thumb[aria-pressed=true]')?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function closeAIStudio(){
 effectPanelOpen=false;const dialog=document.querySelector('.look-browser');dialog?.close();dialog?.classList.remove('is-zoomed');
 document.querySelector('.ai-picker-launch')?.focus({preventScroll:true});
}
function zoomAIStudio(){
 const dialog=document.querySelector('.look-browser');if(!dialog)return;
 const expanded=dialog.classList.toggle('is-zoomed');const button=dialog.querySelector('[data-look-action=zoom]');button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',t(expanded?'Back to styles':'Enlarge style example'));
}
async function receivePhoto(file,{startFresh=false}={}){
 if(!file||photoBusy||aiBusy)return;
 let imported=false;
 photoBusy=true;render(true);
 try{
  const photo=await importPhoto(file);
  await writeDesign('draft-photo',photo);
  Object.assign(state,{photo,photoOrigin:'upload',ai:null,effect:'original',source:'photo',zoom:100,x:50,y:50,intensity:65});
  clearPreviousPhotoArtwork();
  // A homepage upload starts a new design only after the image is safely saved.
  if(startFresh){
   state.artworkLayouts={};state.editOrderId=null;
   effectPanelOpen=false;cropPanelOpen=false;
   editorPanels.collection=false;editorPanels.graphics=false;
   Object.assign(aiUi,{accepted:false,error:''});
   history.replaceState(null,'','#choose');
  }
  imported=true;save();notify('New photo added. Previous graphics and text cleared.');
 }catch(error){notify(error.message||'Your photo could not be saved. Try a smaller image.');}
 finally{photoBusy=false;render(!(startFresh&&imported));}
}
app.addEventListener('dragover',event=>{
 const zone=event.target.closest('[data-photo-drop]');if(!zone||!event.dataTransfer?.types.includes('Files'))return;
 event.preventDefault();event.dataTransfer.dropEffect=photoBusy||aiBusy?'none':'copy';zone.classList.add('is-drag-over');
});
app.addEventListener('dragleave',event=>{const zone=event.target.closest('[data-photo-drop]');if(zone&&!zone.contains(event.relatedTarget))zone.classList.remove('is-drag-over');});
app.addEventListener('drop',async event=>{
 const zone=event.target.closest('[data-photo-drop]');if(!zone)return;
 event.preventDefault();zone.classList.remove('is-drag-over');await receivePhoto(event.dataTransfer?.files[0]);
});
function choose() {
 const d=currentDesign(state.designId),own=state.source==='photo',hasPhoto=Boolean(state.photo);
 return `<section class="flow wrap editor-flow">${steps(0)}${phonePicker()}
 <div class="choose-layout">
  <div class="source-switch editor-sources" role="group" aria-label="Design source"><button type="button" data-source="collection" aria-pressed="${!own}" ${photoBusy?'disabled':''}>The collection</button><button type="button" data-source="photo" aria-pressed="${own}" aria-busy="${photoBusy}" ${photoBusy?'disabled':''}>${photoBusy?'<i class="studio-spinner"></i> Reading your photo…':icon('upload',15)+' Your photo'}</button></div>
  <div class="large-preview" ${own?'data-photo-drop':''} aria-busy="${photoBusy}" style="--card:${own?'#eeece7':d.color}">
   ${own&&!hasPhoto&&!state.keepCollection?`<div class="photo-placeholder">${icon('image',32)}<h2>Your photo goes here.</h2><label class="button primary" for="photo-file">Upload a photo ${icon('upload',17)}</label></div>`:`<div class="large-case artwork-canvas">${personalizedPreview(state,state.model||phoneModels[0],own?'Your photo':d.name,comparing)}</div>`}
   ${!own||hasPhoto||state.keepCollection?`<button type="button" class="canvas-open-hit" data-action="open-canvas" aria-label="Expand to edit"><span>${icon('scan',16)} Expand to edit</span></button>`:''}
  </div>
  <div class="choose-details"><h1 class="sr-only">${own?'Make it personal.':d.name+'.'}</h1>
   <input class="file-input" type="file" id="photo-file" accept="image/jpeg,image/png,image/webp" aria-label="Upload your photo" ${photoBusy?'disabled':''}>
   ${own?'':`<details class="editor-panel" data-editor-panel="collection" ${editorPanels.collection?'open':''}><summary><span class="editor-tool-icon" aria-hidden="true">${icon('image',18)}</span><span>Collection</span><small>${esc(d.name)}</small><span class="editor-chevron" aria-hidden="true">⌄</span></summary><div class="editor-panel-body"><fieldset class="design-choices visual-design-choices"><legend class="sr-only">Pick a design</legend>${designs.map(item=>`<button type="button" data-design="${item.id}" class="design-thumbnail ${d.id===item.id?'selected':''}" aria-label="${item.name}" aria-pressed="${d.id===item.id}" style="--swatch:${designFor(item.id).background}"><span class="design-thumbnail-case">${casePreview(item.id,state.model||phoneModels[0])}</span><span class="design-thumbnail-check" aria-hidden="true">${d.id===item.id?'✓':''}</span></button>`).join('')}</fieldset></div></details>`}
   ${stylePanel(state,aiJob,effectPanelOpen,membership,aiUi)}${creativeLibrary()}
   ${own&&state.ai?'<p class="effect-selection">✓ AI image applied · You can adjust the crop or replace the photo above.</p>':''}
   <div class="editor-next"><form id="design-form"><button class="button primary full" type="submit" ${photoBusy||passBusy||own&&!hasPhoto||!PRINT_AVAILABLE&&!state.editOrderId?'disabled':''}>${passBusy?'Saving your design…':'Next'} ${arrow()}</button></form></div>
  </div>
 </div>${canvasEditor()}</section>`;
}
function passPage() {
  const pass=state.pass;
  if(!pass)return `<section class="empty wrap"><span class="empty-icon">${icon('scan',36)}</span><p class="eyebrow">YOUR NEXT FAVORITE IS WAITING.</p><h1>Make it yours.</h1><p>Pick a design and phone model to get your code.</p><a class="button primary" href="#designs">Explore the designs ${arrow()}</a></section>`;
  const d=currentDesign(pass.designId),qr=qrSource(pass),order=orderForCode(orderBook,pass.code);
  if(order?.mode?.startsWith('stripe_'))return stripeOrderPage(order);
  const editable=!order||order.status==='paid';
 const price=order?money(order.priceCents):PRINT_PRICE;
  return `<section class="flow wrap">${steps(1)}<div class="pass-heading"><p class="eyebrow">A LITTLE SOMETHING TO LOOK FORWARD TO.</p><h1>You picked a good one.</h1><p>${order?`Your ${price} test order is ${orderStatus(order.status).toLowerCase()}.`:'Your design is saved. Confirm a print order before printing.'} Bring this code to a POPOMO station.</p></div><div class="pass-card"><div class="pass-product" style="--card:${d.color}"><div class="pass-case">${passPreview(pass)}</div><h2>${passName(pass)}</h2><p>${esc(pass.model)}</p>${effectCaption(pass)}</div><div class="pass-code"><span class="eyebrow">YOUR DESIGN PASS</span><p class="pass-print-price">${order?'Test order · '+esc(orderStatus(order.status)):'Printing'} <strong>${price}</strong><br>${order?.status==='cancelled'?'This order cannot be printed.':order?'No real payment was taken.':'Confirm an order before printing.'}</p><img class="qr" src="${qr}" alt="Scannable design QR code: ${pass.code}" width="208" height="208"><strong class="human-code">${pass.code}</strong><p>${order?.server?'Design saved with your order.<br>Use the station demo in this browser.':pass.version===2?'Custom design saved locally.<br>Use this code in the station demo in this browser.':'Show this QR code to the station scanner.<br>You can also enter the code on its screen.'}</p><a class="button primary full" href="${qr}" download="${pass.code}.svg">${icon('box',18)} Save QR code</a><button class="text-button" data-action="copy-code">Copy design code</button></div></div><p class="saved-note">${storageWarning?'This pass could not be saved in this browser. Save the QR code before leaving.':'Saved in this browser. You can return through “My design.”'}</p>${order?.server?`<p class="order-reference">Order ${esc(order.id)} · Revision ${order.revision}<br><a href="#orders">View all my orders →</a></p>`:''}<div class="pass-actions"><a class="back-link" href="#choose" data-action="edit-pass">${icon('back',16)} ${editable?'Edit design before printing':'Use design for a new order'}</a><a class="text-button" href="#kiosk?code=${pass.code}">Try the station demo ${arrow()}</a></div>${order?.server&&editable?'<button class="text-button cancel-order" data-action="cancel-order">Cancel test order</button>':''}<p class="demo-note">${order?(editable?'You can edit until printing starts. Saving changes replaces this QR code; the old code stops working.<br>':'This print is locked. Changes require a new order.<br>'):''}${order?.server?'Demo order and design are saved only in this browser. Payment and printing are simulated.':pass.version===2?'Photo and effect passes are browser-local in this prototype. Real stations will need a connected design service.':'Prototype: this code contains your preset and phone model. It is not a paid order or a reservation.'}</p></section>`;
}
function kioskPage() {
  const job=state.job;
  if(job && ['printing','ready','collected'].includes(job.status))return printPage(job);
  const p=scannedPass;
  const availability=p?stationAvailability(state.stationId,p):null;
  const order=p?orderForCode(orderBook,p.code):null,paid=order?.mode==='demo'&&order?.status==='paid'&&order.pass.code===p?.code;
 const price=order?money(order.priceCents):PRINT_PRICE;
  return `<section class="flow wrap station-flow">${steps(2)}<div class="station-top"><span class="station-dot"></span> POPOMO STATION <span class="demo-badge">DEMO</span></div><h1>${p?'Looks like you.':'Hello, good taste.'}</h1><p class="intro">${p?'Confirm your design and phone model before printing.':'Scan your design pass at the machine to get started.'}</p><div class="station-card">${p?`<div class="station-review"><div class="station-case">${passPreview(p)}</div><div><p class="eyebrow">DESIGN RECOGNIZED</p><h2>${passName(p)}</h2><p>${esc(p.model)}</p>${effectCaption(p)}<span class="human-code">${p.code}</span></div></div>`:`<div class="scanner-icon">${icon('scan',58)}</div><form id="scan-form"><label for="design-code">Enter your design code</label><div class="scan-input"><input id="design-code" name="code" placeholder="POP-1117" maxlength="32" required autocomplete="off" autocapitalize="characters" aria-describedby="scan-error"><button class="button primary" type="submit">Find design ${arrow()}</button></div><p id="scan-error" class="error" role="alert"></p></form>${state.pass?'<button class="text-button" data-action="scan-saved">Simulate scanning my saved pass</button>':''}`}
  <label class="station-label" for="station">Demo machine</label><select id="station">${stations.map(s=>`<option value="${s.id}" ${s.id===state.stationId?'selected':''}>${s.name}</option>`).join('')}</select>${p?`<p class="availability ${availability.ok?'available':'unavailable'}" role="status">${icon(availability.ok?'check':'clock',17)} ${availability.message}</p><div class="price-row station-print-price"><span>${paid?'Print order · Demo paid':'Standard printing'}</span><strong>${price}</strong></div><p class="field-note">${paid?'Already paid in the demo order. No second print charge.':'Confirm a print order before starting.'}</p><button class="button primary full" data-action="start-print" ${availability.ok&&paid?'':'disabled'}>Start prepaid demo print ${arrow()}</button>${!paid?'<a class="text-button" href="#choose">Review a new print order →</a>':''}<button class="text-button" data-action="rescan">Use a different code</button>`:''}</div><p class="demo-note">Station preview · No camera or printer is connected.<br>Printing and collection below are simulated.</p></section>`;
}
function printPage(job) {
  const status=job.status;
  const d=currentDesign(job.pass.designId);
  const titles={printing:'A little magic in progress.',ready:'Your case is ready.',collected:'Go make it your everyday.'};
  return `<section class="flow wrap station-flow">${steps(2)}<div class="station-top">POPOMO STATION <span class="demo-badge">DEMO</span></div><div class="completion-icon ${status==='printing'?'working':''}">${icon(status==='printing'?'spark':'check',32)}</div><h1>${titles[status]}</h1><p class="intro">${status==='printing'?'Your design is making itself at home.':status==='ready'?'Take your new case from the collection tray.':'A small thing. A little more you.'}</p><div class="print-summary"><div class="station-case">${passPreview(job.pass)}</div><h2>${passName(job.pass)}</h2>${effectCaption(job.pass)}<p>${esc(job.pass.model)} · ${esc(job.stationId)}</p><ol class="print-progress">${['Design confirmed','Printing','Ready to collect'].map((label,i)=>`<li class="${i<=(status==='printing'?1:2)?'done':''}"><span>${icon('check',14)}</span>${label}</li>`).join('')}</ol>${status==='collected'?'<button class="button primary full" data-action="finish-session">Back to the designs '+arrow()+'</button>':`<button class="button primary full" data-action="advance-print">${status==='printing'?'Finish demo print':'I’ve collected my case'} ${arrow()}</button>`}</div><p class="demo-note">Demo only · No physical item has been printed.</p></section>`;
}
function orderStatus(status){return ({pending:'Awaiting payment',paid:'Paid',printing:'Printing',ready:'Ready to collect',completed:'Collected',collected:'Collected',cancelled:'Cancelled'})[status]||status;}
function ordersPage(){return `<section class="flow wrap"><div class="ai-heading"><p class="eyebrow">YOUR DESIGNS, ALL TOGETHER.</p><h1>My orders.</h1><p>Your orders are saved on the server and accessible from this browser.</p></div><button class="text-button" data-action="refresh-orders">Refresh orders ↻</button>${orderError?`<p class="error" role="alert">${esc(orderError)}</p>`:orderRows.length?`<div class="order-list">${orderRows.map(o=>`<article class="order-row"><div><span class="eyebrow">${esc(orderStatus(o.status))} · ${paymentLabel(o.mode)}</span><h2>${esc(o.model_name)}</h2><p>${esc(o.reference)}</p><small>${new Date(o.created_at).toLocaleString(locale())}</small></div><div><strong>${esc(o.currency)} ${Number(o.amount).toFixed(2)}</strong><button class="button secondary" data-action="view-order" data-id="${esc(o.reference)}">View design →</button></div></article>`).join('')}</div><div class="pass-actions">${orderPage>1?`<button class="text-button" data-action="orders-page" data-page="${orderPage-1}">← Previous</button>`:''}${orderHasMore?`<button class="text-button" data-action="orders-page" data-page="${orderPage+1}">Next →</button>`:''}</div>`:'<div class="empty"><h2>Your first design is waiting.</h2><p>Confirm a print order to see it here.</p><a class="button primary" href="#choose">Create a design →</a></div>'}<p class="demo-note">Keep this browser’s site data to retain access to your orders. Stripe test payments and demo payments do not charge money.</p></section>`;}
function paymentLabel(mode){return ({stripe_test:'STRIPE TEST',stripe_live:'STRIPE',demo:'DEMO PAYMENT'})[mode]||'ORDER';}
async function openStripeCheckout(id){
 const data=await orderRequest(id+'/checkout/',{method:'POST',body:{}});
 location.assign(stripeCheckoutUrl(data.checkout_url));
}
function stripeOrderPage(order){
 const paid=order.status==='paid',pending=order.status==='pending',qr=paid?qrSource(order.pass):null;
 const cancelled=new URLSearchParams(location.hash.split('?')[1]||'').get('result')==='cancel';
 return `<section class="flow wrap review-flow"><div class="ai-heading"><p class="eyebrow">${paymentLabel(order.mode)}</p><h1>${paid?'Payment received.':pending?'Your case is waiting.':'Checkout closed.'}</h1><p>${paid?'Your payment is confirmed and your design is saved.':pending?(cancelled?'You left checkout. Your order is still unpaid; you can continue when ready.':'Waiting for payment confirmation. Your order is not marked paid until Stripe confirms it.'):'This payment session ended. Create a new order to pay.'}</p></div><div class="ai-order-layout"><div class="checkout-preview"><div class="checkout-case">${passPreview(order.pass)}</div><h2>${passName(order.pass)}</h2><p>${esc(order.pass.model)}</p></div><div class="ai-order-card"><p class="eyebrow">${esc(orderStatus(order.status))}</p><h2>${esc(order.currency)} ${money(order.priceCents)}</h2><p class="order-reference">${esc(order.id)}</p>${order.mode==='stripe_test'?'<p class="field-note">Stripe test mode · No real charge.</p>':''}${paymentError?`<p class="error" role="alert">${esc(paymentError)}</p>`:''}${pending?`<button class="button primary full" data-action="pay-stripe" data-id="${esc(order.id)}" ${passBusy?'disabled':''}>Continue to Stripe</button>`:''}<button class="text-button" data-action="refresh-payment">Refresh payment status</button>${paid?`<img class="qr" src="${qr}" alt="Design QR code" width="208" height="208"><p class="human-code">${esc(order.pass.code)}</p><a class="button secondary full" href="${qr}" download="${esc(order.pass.code)}.svg">Save QR code</a><p class="field-note">Your order is saved. Physical printing is not connected yet.</p>`:''}<p><a class="text-button" href="#orders">View all my orders →</a></p><a class="text-button" href="#choose">Create a new design →</a></div></div><p class="demo-note">Keep this browser’s site data to retain access to your order.</p></section>`;
}
function paymentPage(){return paymentOrder?stripeOrderPage(paymentOrder):`<section class="empty wrap"><h1>Payment status</h1><p class="error" role="alert">${esc(paymentError||'Loading your order…')}</p><button class="text-button" data-action="refresh-payment">Refresh payment status</button><a class="text-button" href="#orders">View all my orders →</a></section>`;}
function schedulePaymentPoll(){
 if(!paymentOrder||paymentOrder.status!=='pending'||paymentPollCount>=12)return;
 const hash=location.hash,id=paymentOrder.id;
 paymentPollTimer=setTimeout(async()=>{if(location.hash!==hash)return;paymentPollCount++;try{const latest=await refreshOrder(id);if(location.hash!==hash)return;paymentOrder=latest;paymentError='';render(true);schedulePaymentPoll();}catch(e){if(location.hash===hash){paymentError=e.message;render(true);}}},2500);
}
function quoteBreakdown(pass,price,editing){
 const stripe=paymentConfig?.provider==='stripe'&&!editing;
 const hasAI=pass.source==='photo'&&Boolean(pass.ai);
 return `<section class="print-quote" aria-label="Price details"><h2>Price details</h2><dl>
  <div><dt>Standard printing · 1 case</dt><dd>${price}</dd></div>
  <div><dt>Graphics & text</dt><dd>Included</dd></div>
  <div><dt>AI image</dt><dd>${hasAI?'Already generated':'Not used'}</dd></div>
  ${editing?`<div><dt>Already paid · Demo</dt><dd>${price}</dd></div><div><dt>Design update</dt><dd>$0.00</dd></div>`:''}
  <div class="quote-total"><dt>${stripe?'Total due':'Total due · Demo'}</dt><dd>${editing?'$0.00':price}</dd></div>
 </dl>${hasAI?'<p class="quote-note">AI generation uses your separate allowance. It is not charged again with this print.</p>':''}<p class="quote-note">${stripe?(paymentConfig.mode==='test'?'Stripe test mode · No real charge.':'Pay securely with Stripe.'):'No real payment is taken in this demo.'}</p></section>`;
}
function checkoutPage(){
 if(!checkoutDraft)return '<section class="empty wrap"><h1>Choose your design first.</h1><a class="button primary" href="#choose">Back to your design</a></section>';
 const {pass,editId}=checkoutDraft,order=editId?orderBook.orders[editId]:null,locked=editId&&order?.status!=='paid';
 const price=order?money(order.priceCents):PRINT_PRICE;
 const stripe=paymentConfig?.provider==='stripe'&&!editId;
 return `<section class="flow wrap review-flow">${steps(1)}<a class="back-link" href="#choose">← Keep editing</a><div class="ai-heading"><p class="eyebrow">REVIEW YOUR PRINT · ${stripe?'STRIPE':'DEMO'}</p><h1>${editId?'Make it just right.':'Happy with your design?'}</h1><p>Check your artwork and phone model before confirming.</p></div><div class="ai-order-layout"><div class="checkout-preview"><div class="checkout-case">${passPreview(pass)}</div><h2>${passName(pass)}</h2><p>${esc(pass.model)}</p>${effectCaption(pass)}</div><div class="ai-order-card">${quoteBreakdown(pass,price,Boolean(editId))}<p class="field-note">${stripe?'Check your design carefully. The artwork is locked when the Stripe order is created.':'You can edit your design until printing starts. Saving a revision replaces the QR code. After printing starts, changes need a new order.'}</p>${!editId&&(!paymentConfig?.available||paymentError)?`<p class="error" role="alert">${esc(paymentError||'Payment is unavailable. Please try again later.')}</p><button class="text-button" data-action="refresh-payment">Reload checkout</button>`:!PRINT_AVAILABLE&&!editId?'<p class="error">Printing is unavailable. Please reload and try again.</p>':locked?'<p class="error">This order has started printing. Return to My design to create a new order.</p>':`<form id="print-checkout-form">${!editId?checkoutEmailField(membership):''}<label class="ai-consent"><input name="accepted" type="checkbox" required><span>I confirm this design and phone model. ${editId?'Replace my existing design and QR code at no extra printing charge.':stripe?`Pay ${price} for one case with Stripe.${paymentConfig.mode==='test'?' Test mode: no real charge.':''}`:`Simulate a ${price} payment for one print. No real charge.`} The design and any photo will be securely saved with this order.</span></label><button class="button primary full">${editId?'Save changes & replace QR code':stripe?`Pay ${price} with Stripe`:`Pay ${price} & get my code · Demo`}</button></form>`}</div></div></section>`;
}
function render(preserveScroll=false) {
  finishInlineText();
  cleanupAIStudio();
  const oldY=window.scrollY;
  const [route='home',query='']=location.hash.slice(1).split('?');
  canvasObserver?.disconnect();canvasObserver=null;canvasHome=null;
  if(route!=='choose')canvasExpanded=false;
  if(route!=='choose')effectPanelOpen=false;
  document.body.classList.toggle('canvas-editor-open',canvasExpanded);
  const pages={account:()=>customerPage(membership,customerUI),choose,pass:passPage,kiosk:kioskPage,ai:()=>aiPage(aiJob,membership,aiBusy,aiUi),membership:()=>membershipPage(membership),checkout:checkoutPage,orders:ordersPage,payment:paymentPage};
  app.classList.toggle('is-ai-studio',route==='ai'&&aiJob?.mode==='live');
  app.classList.toggle('is-editor',route==='choose');
  app.innerHTML=header()+`<main id="main" tabindex="-1">${catalogStatus==='unavailable'?'<div class="catalog-warning" role="status">Prices and AI previews could not be loaded. Your saved designs are still available. <button class="text-button" data-action="reload-catalog">Try again</button></div>':''}${(Object.hasOwn(pages,route)?pages[route]:home)()}</main>`+footer();
  if(aiBusy)document.querySelectorAll('[data-ai-action],#ai-credit-form button,#ai-subscription-form button').forEach(el=>el.disabled=true);
  const title=({account:'My account',choose:'Choose your case',pass:'Your design pass',kiosk:'Station demo',ai:'Your AI render',membership:'AI membership',checkout:'Review print order',orders:'My orders',payment:'Payment status'})[route];
  document.title=title?`${t(title)} · POPOMO`:t('POPOMO — A little more you.');
  localize(app);document.querySelector('.skip-link').textContent=t('Skip to content');
  cleanupAIStudio=mountAIStudio(app,aiJob,aiUi);
  document.querySelector('#language').disabled=aiBusy||photoBusy||passBusy;
  document.querySelectorAll('[data-editor-panel]').forEach(bindEditorPanel);
  document.querySelector('.canvas-editor')?.addEventListener('cancel',event=>{event.preventDefault();closeCanvasEditor();});
  document.querySelector('.look-browser')?.addEventListener('cancel',event=>{event.preventDefault();closeAIStudio();});
  if(canvasExpanded)openCanvasEditor();
  else if(effectPanelOpen)openAIStudio();
  highlightArtwork();
  document.querySelector('.crop-panel')?.addEventListener('toggle',e=>cropPanelOpen=e.target.open);
  if(preserveScroll)window.scrollTo(0,oldY);
  else if(['designs','how-it-works'].includes(route))document.getElementById(route)?.scrollIntoView();
  else window.scrollTo(0,0);
}
// A stable outer canvas retains capture while the selected artwork and handles update.
let artworkDrag=null,lastArtworkTap=null;
function deselectArtwork(){
 finishInlineText();
 if(!selectedArtwork)return;
 selectedArtwork=null;
 if(document.activeElement?.closest('.artwork-canvas'))document.activeElement.blur();
 highlightArtwork();
}
document.addEventListener('pointerdown',event=>{
 if(event.isPrimary===false||event.button!==0||artworkDrag)return;
 if(!event.target.closest('.artwork-canvas [data-layer-id],.artwork-canvas [data-photo-layer],.artwork-gizmo,.text-quick-tools,.artwork-selection-actions,.canvas-toolbar,.canvas-editor-header'))deselectArtwork();
});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&effectPanelOpen){event.preventDefault();if(document.querySelector('.look-browser.is-zoomed'))zoomAIStudio();else closeAIStudio();return;}
 if(['Delete','Backspace'].includes(event.key)&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!event.target.closest('input,textarea,select,[contenteditable],[role="textbox"]')){
  if(deleteSelectedArtwork())event.preventDefault();
 }
 if(event.key==='Escape'&&!artworkDrag&&!event.isComposing){event.preventDefault();if(canvasExpanded&&!inlineTextId)closeCanvasEditor();else{finishInlineText();deselectArtwork();}}
});
app.addEventListener('pointerdown',event=>{
 const canvas=event.target.closest('.artwork-canvas');
 if(!canvas||event.button!==0||event.isPrimary===false||event.target.closest('.camera,.artwork-reset,.artwork-delete,.artwork-edit-text,.text-quick-tools,[data-inline-text]')||artworkDrag)return;
 const handle=event.target.closest('[data-transform]'),layer=event.target.closest('[data-layer-id],[data-photo-layer]');
 if(!handle&&!layer)return;
 finishInlineText();
 if(!handle)selectedArtwork=layer.dataset.photoLayer?'photo':layer.dataset.layerId;
 if(document.activeElement?.closest('.text-editor'))document.activeElement.blur();
 highlightArtwork();
 fitCanvasEditor();
 const target=artworkTarget(),phone=canvas.querySelector('.phone-case'),box=canvas.querySelector('.artwork-gizmo').getBoundingClientRect(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 artworkDrag={mode:handle?.dataset.transform||'move',pointerId:event.pointerId,canvas,startX:event.clientX,startY:event.clientY,x:target.x,y:target.y,width:phone.clientWidth,height:phone.clientHeight,groupScale:selectedArtwork==='all'||selectedArtwork==='photo'||selectedArtwork.startsWith('extra-')?1:artworkLayout().zoom/100,cx,cy,startDistance:Math.max(1,Math.hypot(event.clientX-cx,event.clientY-cy)),startAngle:Math.atan2(event.clientY-cy,event.clientX-cx),scale:selectedArtwork==='all'?target.zoom:target.scale,rotation:target.rotation||0,snapshot:structuredClone(artworkLayout()),photoSnapshot:structuredClone({photoPlacement:state.photoPlacement,photoArtwork:state.photoArtwork})};
 canvas.setPointerCapture(event.pointerId);canvas.classList.add('is-dragging');event.preventDefault();
});
app.addEventListener('pointermove',event=>{
 const drag=artworkDrag;if(!drag||event.pointerId!==drag.pointerId)return;
 if(!drag.moved&&Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<4)return;
 drag.moved=true;lastArtworkTap=null;
 const target=artworkTarget(),all=selectedArtwork==='all';
 if(drag.mode==='move')Object.assign(target,dragPlacement({x:drag.x,y:drag.y,dx:event.clientX-drag.startX,dy:event.clientY-drag.startY,width:drag.width,height:drag.height,groupScale:drag.groupScale}));
 if(drag.mode==='scale')target[all?'zoom':'scale']=scaleFromPointer({scale:drag.scale,startDistance:drag.startDistance,distance:Math.hypot(event.clientX-drag.cx,event.clientY-drag.cy),min:all?50:25,max:all?180:200});
 if(drag.mode==='rotate'){
  const angle=Math.atan2(event.clientY-drag.cy,event.clientX-drag.cx);
  if(all)artworkLayout().artworkEdits=rotateGroup(drag.snapshot.artworkEdits,designFor(state.designId).layers,rotationFromPointer({startAngle:drag.startAngle,angle}),drag.width/drag.height);
  else target.rotation=rotationFromPointer({rotation:drag.rotation,startAngle:drag.startAngle,angle});
 }
 updatePreview();event.preventDefault();
});
function finishArtworkDrag(event,cancelled=false){
 const drag=artworkDrag;if(!drag||event.pointerId!==drag.pointerId)return;
 if(cancelled){state.artworkLayouts[state.designId]=drag.snapshot;Object.assign(state,drag.photoSnapshot);updatePreview();}
 artworkDrag=null;drag.canvas.classList.remove('is-dragging');if(drag.canvas.hasPointerCapture(event.pointerId))drag.canvas.releasePointerCapture(event.pointerId);save();
 // Pointer capture retargets native clicks to the canvas, so recognize a text double-tap here.
 if(!cancelled&&!drag.moved&&drag.mode==='move'&&selectedText()){
  const tap={id:selectedArtwork,time:event.timeStamp,x:drag.startX,y:drag.startY};
  if(lastArtworkTap?.id===tap.id&&tap.time-lastArtworkTap.time<450&&Math.hypot(tap.x-lastArtworkTap.x,tap.y-lastArtworkTap.y)<12){lastArtworkTap=null;beginInlineText();}
  else lastArtworkTap=tap;
 }else lastArtworkTap=null;
}
app.addEventListener('pointerup',event=>finishArtworkDrag(event));
app.addEventListener('pointercancel',event=>finishArtworkDrag(event,true));
app.addEventListener('lostpointercapture',event=>finishArtworkDrag(event,true));
app.addEventListener('dblclick',event=>{
 if(event.target.closest('[data-inline-text]'))return;
 const layer=event.target.closest('.artwork-canvas [data-layer-id]');if(!layer?.querySelector('.layer-text'))return;
 event.preventDefault();finishInlineText();selectedArtwork=layer.dataset.layerId;beginInlineText();
});
app.addEventListener('compositionend',event=>{if(event.target.matches('[data-inline-text]')){writeInlineText(event.target);highlightArtwork();}});
app.addEventListener('keydown',event=>{
 if(event.target.closest('[data-inline-text]')){
  if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.isComposing){event.preventDefault();finishInlineText();}
  return;
 }
 const canvas=event.target.closest('.artwork-canvas'),layer=event.target.closest('[data-layer-id],[data-photo-layer]'),handle=event.target.closest('[data-transform]'),delta={ArrowLeft:['x',-1],ArrowRight:['x',1],ArrowUp:['y',-1],ArrowDown:['y',1]}[event.key];
 if(!canvas)return;
 if(layer&&['Enter',' '].includes(event.key)){event.preventDefault();selectedArtwork=layer.dataset.photoLayer?'photo':layer.dataset.layerId;if(selectedText())beginInlineText();else highlightArtwork();return;}
 if(!delta||(!layer&&!handle))return;event.preventDefault();if(layer)selectedArtwork=layer.dataset.photoLayer?'photo':layer.dataset.layerId;
 const target=artworkTarget(),all=selectedArtwork==='all',amount=delta[1]*(event.shiftKey?5:1);
 if(handle?.dataset.transform==='scale'){const key=all?'zoom':'scale';target[key]=Math.max(all?50:25,Math.min(all?180:200,target[key]+amount));}
 else if(handle?.dataset.transform==='rotate'){if(all)target.artworkEdits=rotateGroup(target.artworkEdits,designFor(state.designId).layers,amount,canvas.querySelector('.phone-case').clientWidth/canvas.querySelector('.phone-case').clientHeight);else target.rotation=rotationFromPointer({rotation:target.rotation,startAngle:0,angle:amount*Math.PI/180});}
 else target[delta[0]]=Math.max(0,Math.min(100,target[delta[0]]+amount));
 const selector=handle?'.'+[...handle.classList].find(c=>c!=='artwork-handle'):(selectedArtwork==='photo'?'[data-photo-layer]':`[data-layer-id="${selectedArtwork}"]`);save();updatePreview();canvas.querySelector(selector)?.focus({preventScroll:true});
});
app.addEventListener('change',async event=>{
  if(event.target.matches('#ai-credit-form [name=accepted]'))aiUi.accepted=event.target.checked;
  if(event.target.id==='language'){
    if(aiBusy||photoBusy||passBusy)return;
    finishInlineText();
    const fields=[...app.querySelectorAll('input:not([type=file]),textarea,select:not(#language)')].map(el=>({id:el.id,name:el.name,form:el.form?.id,value:el.value,checked:el.checked}));
    const details=[...app.querySelectorAll('details')].map(el=>el.open),brand=modelBrand,search=modelQuery;
    setLocale(event.target.value);render(true);
    if(document.querySelector('.model-first-body')){modelBrand=brand;modelQuery=search;document.querySelector('.model-first-body').innerHTML=modelPickerBody();localize(document.querySelector('.model-first-body'));}
    for(const field of fields){const el=[...app.querySelectorAll('input:not([type=file]),textarea,select:not(#language)')].find(el=>field.id?el.id===field.id:field.name&&el.name===field.name&&el.form?.id===field.form);if(el){el.value=field.value;if('checked' in el)el.checked=field.checked;}}
    [...app.querySelectorAll('details')].forEach((el,i)=>{if(details[i]!==undefined)el.open=details[i];});
    document.querySelector('#language').focus({preventScroll:true});return;
  }
  if(event.target.id==='station'){state.stationId=event.target.value;save();render(true);document.querySelector('#station')?.focus({preventScroll:true});}
  if(event.target.id==='photo-file'){
    await receivePhoto(event.target.files[0],{startFresh:event.target.hasAttribute('data-home-upload')});
  }
});
app.addEventListener('input',event=>{
  if(event.target.matches('.look-wipe')){aiUi.lookCompare=setLookComparison(document.querySelector('.look-browser'),event.target.value);return;}
  if(event.target.id==='canvas-size'&&selectedArtwork){artworkTarget()[selectedArtwork==='all'?'zoom':'scale']=Number(event.target.value);save();updatePreview();return;}
 if(event.target.matches('[data-ai-compare]')){aiUi.compare=setAIComparison(app,event.target.value);return;}
 if(event.target.id==='model-search'){modelQuery=event.target.value;document.querySelector('.model-results').innerHTML=modelResults();localize(document.querySelector('.model-results'));return;}
 if(event.target.matches('[data-inline-text]')){if(!event.isComposing){writeInlineText(event.target);highlightArtwork();}return;}
 if(event.target.dataset.textField){applyTextStyle(event.target.dataset.textField,event.target.value);return;}

  if(event.target.dataset.artwork){const key=event.target.dataset.artwork;setArtwork(key,Number(event.target.value));}
  if(event.target.dataset.crop){const key=event.target.dataset.crop;state[key]=Number(event.target.value);document.getElementById(key+'-value').textContent=state[key]+'%';updatePreview();save();}
  if(event.target.id==='effect-strength'){state.intensity=Number(event.target.value);document.getElementById('intensity-value').textContent=state.intensity+'%';document.getElementById('selected-strength').textContent=state.intensity+'%';updatePreview();save();}
  if(event.target.id==='design-code'){event.target.removeAttribute('aria-invalid');document.getElementById('scan-error').textContent='';}
});
app.addEventListener('submit',async event=>{
  if(event.target.id==='customer-profile-form'){event.preventDefault();await handleCustomer('profile',new FormData(event.target));return;}
  if(event.target.id==='customer-email-form'){event.preventDefault();const fields=new FormData(event.target);await handleCustomer(customerUI.codeSent?'verify':'send',fields);return;}
  if(event.target.id==='ai-credit-form'||event.target.id==='ai-subscription-form'){
    event.preventDefault();if(aiBusy)return;const accepted=new FormData(event.target).has('accepted');
    await confirmAI(event.target.id==='ai-credit-form',accepted);return;
  }
  if(event.target.id==='print-checkout-form'){event.preventDefault();if(passBusy||!checkoutDraft)return;passBusy=true;
    const button=event.target.querySelector('button');button.disabled=true;button.textContent=t('Saving your order…');
    try{
      const values=new FormData(event.target),accepted=values.has('accepted'),existing=orderBook.orders[checkoutDraft.editId];let order;
      if(!existing&&!paymentConfig?.available)throw Error('Payment is unavailable. Please reload and try again.');
      if(checkoutDraft.editId&&!existing)throw Error('This order could not be loaded. Open it from My orders and retry.');
      if(existing&&!existing.server){let result;orderBook=await updateDesign('print-orders-v1',b=>{result=commitPrintOrder(b,checkoutDraft.pass,{accepted,editId:existing.id});return result.book;},freshOrders());order=result.order;}
      else{
        checkoutDraft.requestKey||=crypto.randomUUID();await writeDesign('checkout-draft',checkoutDraft);
        const data=existing?await orderRequest(existing.id+'/',{method:'PATCH',body:{accepted,revision:checkoutDraft.revision??existing.revision,snapshot:checkoutDraft.pass}}):await orderRequest('',{method:'POST',body:checkoutBody(checkoutDraft,{accepted,email:String(values.get('email')||''),account:membership,amount:(PRINT_PRICE_CENTS/100).toFixed(2),provider:paymentConfig.provider,mode:paymentConfig.mode})});
        order=await rememberOrder(data);
      }
      state.pass=order.pass;state.job=null;scannedPass=null;state.editOrderId=null;checkoutDraft=null;await writeDesign('checkout-draft',null);save();
      if(order.mode.startsWith('stripe_')){paymentOrder=order;go('payment?order='+order.id);if(order.status==='pending')await openStripeCheckout(order.id);}else go('pass');
    }
    catch(error){if(error.message==='Your sign-in changed. Reload checkout to review your email.'){paymentError=error.message;paymentConfig=null;}notify(error.message);}finally{passBusy=false;render(true);}return;
  }
  if(event.target.id==='design-form'){
    event.preventDefault();if(passBusy||photoBusy)return;
    if(!phoneModels.includes(state.model)){const panel=document.querySelector('.model-first');panel.open=true;panel.scrollIntoView({block:'start',behavior:'smooth'});panel.querySelector('#model-search').focus({preventScroll:true});notify('Choose your phone model first.');return;}
    const submitted={...state};passBusy=true;render(true);
    try{
      const pass=createPersonalPass(layoutSelection(submitted));
      checkoutDraft={pass,editId:state.editOrderId||null,requestKey:crypto.randomUUID(),revision:orderBook.orders[state.editOrderId]?.revision};await writeDesign('checkout-draft',checkoutDraft);comparing=false;go('checkout');
    }catch(error){notify(error.message||'The design could not be saved. Please try again.');}
    finally{passBusy=false;if(location.hash.startsWith('#choose'))render(true);}
  }
  if(event.target.id==='scan-form'){
    event.preventDefault();
    try{scannedPass=await resolvePass(new FormData(event.target).get('code'));render(true);}
    catch(error){const el=document.querySelector('#scan-error');if(el){el.textContent=t(error.message);document.querySelector('#design-code').setAttribute('aria-invalid','true');}}
  }
});
app.addEventListener('click',async event=>{
  const el=event.target.closest('[data-phone-brand],[data-phone-model],[data-action],[data-design],[data-start-design],[data-source],[data-effect],[data-ai-action],[data-ai-look-example],[data-ai-look-step],[data-look-action],[data-look-mode],[data-ai-group],[data-ai-view],[data-artwork-item],[data-add-graphic],[data-quick-font],[data-quick-color]');if(!el||el.disabled||photoBusy||passBusy||aiBusy)return;
  if(el.dataset.action==='home-photo'){openPhotoPicker();return;}
  if(el.dataset.lookAction==='open'){openAIStudio();return;}
  if(el.dataset.lookAction==='close'){closeAIStudio();return;}
  if(el.dataset.lookAction==='zoom'){zoomAIStudio();return;}
  if(el.dataset.lookMode){const dialog=document.querySelector('.look-browser');aiUi.lookMode=setLookMode(dialog,el.dataset.lookMode);updateLookImageState(dialog);return;}
  if(el.dataset.aiLookStep){
   const {group,index}=activeLook(state),next=group.looks[(index+Number(el.dataset.aiLookStep)+group.looks.length)%group.looks.length];
   state.aiExample=next.example.id;state.aiStyle=next.style.id;save();refreshAIStudio();return;
  }
  if(el.dataset.action==='reload-catalog'){location.reload();return;}
  if(el.dataset.action==='open-canvas'){openCanvasEditor();return;}
  if(el.dataset.action==='close-canvas'){closeCanvasEditor();return;}
  if(el.dataset.action==='rotate-canvas-artwork'&&selectedArtwork){
   const target=artworkTarget();
   if(selectedArtwork==='all'){const phone=document.querySelector('.artwork-canvas .phone-case');target.artworkEdits=rotateGroup(target.artworkEdits,designFor(state.designId).layers,15,phone.clientWidth/phone.clientHeight);}
   else target.rotation=rotationFromPointer({rotation:target.rotation||0,startAngle:0,angle:Math.PI/12});
   save();updatePreview();return;
  }
  if(el.dataset.phoneBrand){
   if(!phoneBrands(phoneModels).includes(el.dataset.phoneBrand))return;
   modelBrand=el.dataset.phoneBrand;modelQuery='';const body=document.querySelector('.model-first-body');body.innerHTML=modelPickerBody();localize(body);
   document.querySelector(`[data-phone-brand="${modelBrand}"]`)?.focus({preventScroll:true});return;
  }
  if(el.dataset.phoneModel){selectPhoneModel(el.dataset.phoneModel);return;}
  if(el.dataset.quickFont){applyTextStyle('font',el.dataset.quickFont);return;}
  if(el.dataset.quickColor){applyTextStyle('color',el.dataset.quickColor);return;}
  if(el.dataset.addGraphic){
   if(extraArtwork().length>=20){notify('You can add up to 20 graphics and text elements.');return;}
   if(!stickers.some(a=>a.id===el.dataset.addGraphic)||state.source==='photo'&&!state.photo&&!state.keepCollection)return;
   finishInlineText();const item={id:'extra-'+crypto.randomUUID(),type:'sticker',asset:el.dataset.addGraphic,x:50,y:55,scale:100,rotation:0};extraArtwork().push(item);selectedArtwork=item.id;save();updatePreview();revealArtwork();return;
  }
  if(el.dataset.artworkItem){selectedArtwork=el.dataset.artworkItem;refreshArtworkControls();document.querySelector(`[data-artwork-item="${selectedArtwork}"]`)?.focus({preventScroll:true});return;}
  if(el.dataset.aiGroup){
   const group=activeLook(state).groups.find(g=>g.example.id===el.dataset.aiGroup);if(!group)return;
   const next=group.looks.find(l=>l.style.id===state.aiStyle)||group.looks[0];state.aiExample=next.example.id;state.aiStyle=next.style.id;save();refreshAIStudio({resetScroll:true});
   document.querySelector(`[data-ai-group="${CSS.escape(el.dataset.aiGroup)}"]`)?.focus({preventScroll:true});return;
  }
  if(el.dataset.aiView){aiUi.mode=setAIView(app,el.dataset.aiView);return;}
  if(el.dataset.aiLookExample){
   const example=aiExamples.find(e=>e.id===el.dataset.aiLookExample),styleId=el.dataset.aiLookStyle;
   if(!example?.results[styleId])return;
   state.aiExample=example.id;state.aiStyle=styleId;effectPanelOpen=true;save();refreshAIStudio();
   document.querySelector(`[data-ai-look-example="${CSS.escape(example.id)}"][data-ai-look-style="${CSS.escape(styleId)}"]`)?.focus({preventScroll:true});return;
  }
  if(el.dataset.aiAction){await handleAI(el.dataset.aiAction);return;}
  if(el.dataset.source){
   if(el.dataset.source==='photo'){openPhotoPicker();return;}
   finishInlineText();
   selectedArtwork=null;state.source=el.dataset.source;comparing=false;history.replaceState(null,'','#choose');save();render(true);return;
  }
  if(el.dataset.design||el.dataset.startDesign){
   event.preventDefault();const startFresh=Boolean(el.dataset.startDesign);photoBusy=true;
   try{await selectCollectionDesign(el.dataset.design||el.dataset.startDesign,{startFresh});}
   catch(error){notify(error.message||'Your design could not be saved. Please try again.');return;}
   finally{photoBusy=false;}
   editorPanels.collection=false;history.replaceState(null,'',`#choose?design=${state.designId}`);render(!startFresh);document.querySelector('[data-editor-panel=collection]>summary')?.focus({preventScroll:true});if(startFresh)notify('New design started. Previous edits cleared.');
   return;
  }
  if(el.dataset.effect){state.effect=el.dataset.effect;comparing=false;effectPanelOpen=true;save();render(true);document.querySelector(`[data-effect="${state.effect}"]`)?.focus({preventScroll:true});return;}
  try {
    if(el.dataset.action==='toggle-library'){libraryExpanded=!libraryExpanded;render(true);return;}
    if(el.dataset.action==='edit-text'){if(inlineTextId)finishInlineText();else beginInlineText();return;}
    if(el.dataset.action==='text-submit'){
     if(extraArtwork().length>=20){notify('You can add up to 20 graphics and text elements.');return;}
     finishInlineText();
     const item={id:'extra-'+crypto.randomUUID(),type:'text',...textDraft,text:'Your text',x:50,y:65,scale:100,rotation:0};extraArtwork().push(item);selectedArtwork=item.id;save();updatePreview();openCanvasEditor();beginInlineText();return;
    }
    if(el.dataset.action==='delete-artwork'){deleteSelectedArtwork();return;}
    if(el.dataset.action==='reset-artwork'){
     if(selectedArtwork==='photo'){state.photoPlacement={x:50,y:50,scale:100,rotation:0};state.zoom=100;state.x=50;state.y=50;save();updatePreview();return;}
     if(selectedArtwork?.startsWith('extra-')){Object.assign(artworkTarget(),{x:50,y:55,scale:100,rotation:0});save();updatePreview();return;}
if(selectedArtwork==='all'){const layout=artworkLayout();layout.zoom=100;layout.x=50;layout.y=50;for(const id of Object.keys(layout.artworkEdits))resetPresetLayer(id);}else resetPresetLayer(selectedArtwork);save();updatePreview();refreshArtworkControls();}
    if(el.dataset.action==='center-artwork'){const target=artworkTarget();target.x=50;target.y=50;save();updatePreview();refreshArtworkControls();}
    if(el.dataset.action?.startsWith('nudge-')){const direction=el.dataset.action.slice(6),key=['left','right'].includes(direction)?'x':'y',delta=['left','up'].includes(direction)?-5:5,target=artworkTarget();setArtwork(key,Math.max(0,Math.min(100,target[key]+delta)));render(true);}
    if(el.dataset.action==='compare'){comparing=!comparing;render(true);document.querySelector('[data-action="compare"]')?.focus({preventScroll:true});}
    if(el.dataset.action==='reset-crop'){state.zoom=100;state.x=50;state.y=50;save();render(true);}
    if(el.dataset.action==='edit-pass'){
      event.preventDefault();const current=orderForCode(orderBook,state.pass.code);if(current?.server){const latest=await refreshOrder(current.id);state.pass=latest.pass;}const p=state.pass;orderBook=await readDesign('print-orders-v1')||freshOrders();const order=orderForCode(orderBook,p.code);selectedArtwork=null;if(p.source==='collection')state.artworkLayouts[p.designId]={zoom:p.zoom,x:p.x,y:p.y,artworkEdits:structuredClone(p.artworkEdits||{}),addedArtwork:structuredClone(p.addedArtwork||[])};state.editOrderId=order?.mode==='demo'&&order?.status==='paid'?order.id:null;
      if(p.version===2){if(p.source==='photo')await writeDesign('draft-photo',p.photo);Object.assign(state,{source:p.source,designId:p.designId,model:p.model,photo:p.source==='photo'?p.photo:state.photo,effect:p.effect,intensity:p.intensity,zoom:p.zoom,x:p.x,y:p.y,ai:p.ai||null,photoOrigin:'upload',...(p.source==='photo'?{photoArtwork:structuredClone(p.addedArtwork||[]),photoPlacement:structuredClone(p.photoPlacement||null),keepCollection:Boolean(p.collectionLayout)}:{})});}
      else Object.assign(state,{source:'collection',designId:p.designId,model:p.model,effect:'original'});
      if(!phoneModels.includes(state.model))state.model='';
      if(p.source==='photo'&&p.collectionLayout)state.artworkLayouts[p.designId]={...structuredClone(p.collectionLayout),addedArtwork:structuredClone(p.addedArtwork||[])};
      comparing=false;save();go('choose');
    }
    if(el.dataset.action==='copy-code'){
      try{await navigator.clipboard.writeText(state.pass.code);notify('Design code copied.');}
      catch{notify('Your design code: '+state.pass.code);}
    }
    if(el.dataset.action==='scan-saved'){scannedPass=await resolvePass(state.pass.code);render();}
    if(el.dataset.action==='rescan'){scannedPass=null;render(true);}
    if(el.dataset.action==='start-print'){const order=orderForCode(orderBook,scannedPass.code);if(order?.server){const updated=await orderAction(order,'start',state.stationId);state.job={pass:updated.pass,stationId:updated.stationId,status:updated.status,orderId:updated.id};save();render();return;}let result;orderBook=await updateDesign('print-orders-v1',b=>{result=beginOrderPrint(b,scannedPass.code,state.stationId);return result.book;},freshOrders());state.job=result.job;save();render();}
    if(el.dataset.action==='advance-print'){const order=orderBook.orders[state.job?.orderId];if(order?.server){const updated=await orderAction(order,state.job.status==='printing'?'ready':'collect');state.job={pass:updated.pass,stationId:updated.stationId,status:updated.status,orderId:updated.id};save();render();return;}const job=advancePrint(state.job);if(job.orderId)orderBook=await updateDesign('print-orders-v1',b=>{b.orders[job.orderId].status=job.status;return b;});state.job=job;save();render();}
    if(el.dataset.action==='view-order'){const order=await refreshOrder(el.dataset.id);if(order.mode.startsWith('stripe_')){paymentOrder=order;state.pass=order.pass;save();go('payment?order='+order.id);return;}state.pass=order.pass;state.job=order.stationId&&['printing','ready','collected'].includes(order.status)?{pass:order.pass,stationId:order.stationId,status:order.status,orderId:order.id}:null;save();go('pass');}
    if(el.dataset.action==='cancel-order'){const order=orderForCode(orderBook,state.pass.code);if(order?.server){await orderAction(order,'cancel');notify('Test order cancelled. No money was charged.');render(true);}}
    if(el.dataset.action==='orders-page'){orderPage=Number(el.dataset.page);await navigate();}
    if(el.dataset.action==='refresh-orders'||el.dataset.action==='refresh-payment')await navigate();
    if(el.dataset.action==='pay-stripe'){if(passBusy)return;passBusy=true;el.disabled=true;try{await openStripeCheckout(el.dataset.id);}catch(e){paymentError=e.message;}finally{passBusy=false;render(true);}}
    if(el.dataset.action==='finish-session'){state.job=null;scannedPass=null;save();go('designs');}
  } catch(error){notify(error.message||'Your design could not be saved. Please try again.');}
});
document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();document.querySelector('#main')?.focus();});
async function navigate(){
 const [route,query='']=location.hash.slice(1).split('?');const params=new URLSearchParams(query),code=params.get('code');
 if(route==='account'||route==='membership')try{await syncAIAccount();if(route==='account'&&membership.authenticated)await loadCustomerCredits(true);}catch(error){customerUI.error=error.message;}
 clearTimeout(paymentPollTimer);paymentPollCount=0;
 if(route==='checkout'){paymentConfig=null;paymentError='';try{const [config]=await Promise.all([getPaymentConfig(),syncAIAccount()]);paymentConfig=config;}catch(e){paymentError=e.message;}}
 if(route==='payment'){paymentError='';paymentOrder=null;try{paymentOrder=await refreshOrder(params.get('order'));state.pass=paymentOrder.pass;save();}catch(e){paymentError=e.message;}if(params.get('result')==='success')schedulePaymentPoll();}
 if(route==='pass'||route==='kiosk'){
   orderBook=await readDesign('print-orders-v1')||freshOrders();const order=state.pass&&orderForCode(orderBook,state.pass.code);
   if(order?.server)try{const latest=await refreshOrder(order.id);state.pass=latest.pass;if(state.job?.orderId===latest.id)state.job={...state.job,status:latest.status,pass:latest.pass};}catch(e){notify(e.message);}
 }
 if(route==='orders'){try{const data=await orderRequest('?page='+orderPage);orderRows=data.results;orderHasMore=data.has_more;orderError='';}catch(e){orderError=e.message;}}
 if(route==='choose'&&designs.some(d=>d.id===params.get('design'))){state.designId=params.get('design');state.source='collection';}
 if(route==='choose'&&params.get('source')==='photo'){
  if(params.get('fresh')==='1'){
   photoBusy=true;
   try{await clearPhotoDraft();state.editOrderId=null;}
   catch(error){notify(error.message||'Your design could not be saved. Please try again.');return;}
   finally{photoBusy=false;}
   params.delete('fresh');history.replaceState(null,'',`#choose?${params}`);
  }
  state.source='photo';save();
 }
 if(route==='choose'&&params.get('studio')==='1')effectPanelOpen=true;
 if(route==='kiosk'&&code){try{scannedPass=await resolvePass(code);const order=orderForCode(orderBook,scannedPass.code);state.job=order?.stationId&&['printing','ready','collected'].includes(order.status)?{pass:order.pass,stationId:order.stationId,status:order.status,orderId:order.id}:null;save();}catch(error){scannedPass=null;notify(error.message);}history.replaceState(null,'','#kiosk');}
 render();document.querySelector('#main')?.focus({preventScroll:true});
 if(route==='choose'&&params.get('studio')==='1')openAIStudio();
}
window.addEventListener('hashchange',navigate);
window.addEventListener('resize',()=>{if(!artworkDrag)highlightArtwork();});
app.addEventListener('load',event=>{if(!artworkDrag&&event.target.closest?.('.artwork-canvas'))highlightArtwork();},true);
for(const type of ['load','error'])app.addEventListener(type,event=>{if(event.target.matches?.('.look-comparison img'))updateLookImageState(document.querySelector('.look-browser'));},true);
await navigate();

async function loadAssetPhoto(url){
 const response=await fetch(url);if(!response.ok)throw Error('The style sample could not be loaded. Please try again.');
 const blob=await response.blob();return importPhoto(new File([blob],'sample.png',{type:blob.type}));
}
async function mergeAIAccount(data){
 if(membership.customer?.id!==data.customer?.id)Object.assign(customerUI,{ledger:[],ledgerNext:null,ledgerError:'',ledgerBusy:false,ledgerOpen:false});
 if(aiJob&&(aiJob.customerId&&aiJob.customerId!==data.customer?.id||aiJob.remoteId&&!aiJob.customerId)){aiJob=null;state.aiJobId=null;save();}
 membership=await updateDesign('ai-membership-v1',a=>({...a,...data,jobs:a.customer?.id===data.customer?.id?a.jobs||{}:{}}),freshMembership());
}
async function syncAIAccount(){await mergeAIAccount(await getAIAccount());}
async function rememberLiveJob(job){
 job={...job,customerId:job.customerId||membership.customer?.id||null};
 membership=await updateDesign('ai-membership-v1',a=>({...a,jobs:{...a.jobs,[job.id]:job}}),freshMembership());
 aiJob=job;state.aiJobId=job.id;save();
}
async function confirmAI(generation,accepted){
 if(aiBusy)return;
 if(!membership.authenticated){customerUI.next='ai';go('account');return;}
 aiBusy=true;aiUi.error='';aiUi.accepted=accepted;render(true);
 try{
  if(generation){
   if(aiJob?.mode!=='live')throw Error('Choose your photo and start a new AI render.');
   await rememberLiveJob(await submitLiveRender(aiJob,accepted));
   await syncAIAccount();
  }else await mergeAIAccount(await changeAIAccount('subscribe',accepted));
 }catch(error){aiUi.error=error.message||'The AI service could not be reached. Please try again.';notify(aiUi.error);}
 finally{aiBusy=false;render(true);if(location.hash==='#ai')document.querySelector('#main')?.focus({preventScroll:true});}
}
async function newAI(input){
 if(!AI_GENERATION_CONNECTED)throw Error('AI generation is not configured. Please contact the store.');
 const job=createLiveRender({...input,model:input.model||state.model});
 if(aiJob?.mode==='live'&&aiJob.status==='awaiting_confirmation'&&!aiJob.remoteId)await rememberLiveJob({...aiJob,status:'cancelled'});
 Object.assign(aiUi,{mode:'pair',compare:50,accepted:false,error:'',reconnecting:false});
 await rememberLiveJob(job);
 if(!membership.authenticated){customerUI.next='ai';go('account');}else go('ai');
}
async function handleAI(action){
 if(action==='upload'){openPhotoPicker();return;}
 aiBusy=true;aiUi.error='';aiUi.busyAction=action;render(true);
 try{
  if(action==='cancel'){
   const unsubmitted=aiJob?.status==='awaiting_confirmation';
   if(aiJob?.mode==='live')await rememberLiveJob(await cancelLiveRender(aiJob));
   await syncAIAccount();
   if(unsubmitted)go('choose');
  }
  if(action==='stop-renewal'||action==='resume-renewal')await mergeAIAccount(await changeAIAccount(action,true));
  if(action==='sample'){
   const example=exampleFor(state.aiExample);const photo=await loadAssetPhoto(example.original);await writeDesign('draft-photo',photo);
   Object.assign(state,{photo,source:'photo',photoOrigin:example.origin,ai:null,effect:'original',intensity:65,zoom:100,x:50,y:50});clearPreviousPhotoArtwork();effectPanelOpen=true;save();render(true);
  }
  if(action==='create'){
   if(aiJob?.mode==='live'&&['queued','generating'].includes(aiJob.status)){go('ai');notify('Finish or cancel your current render before starting another.');}
   else await newAI({photo:state.photo,sourceKind:state.photoOrigin===exampleFor(state.aiExample).origin?'sample':'upload',styleId:state.aiStyle,exampleId:state.aiExample});
  }
  if(action==='retry')await newAI({photo:aiJob.photo,sourceKind:aiJob.sourceKind,styleId:aiJob.styleId,exampleId:aiJob.exampleId,model:state.model||aiJob.model});
  if(action==='refresh')await rememberLiveJob(await refreshLiveRender(aiJob));
  if(action==='apply'){
   if(aiJob?.mode!=='live')throw Error('Choose your photo and start a new AI render.');
   await rememberLiveJob(await refreshLiveRender(aiJob));
   if(!canApplyAIOrder(aiJob))throw Error('Wait until the render is ready before using its result.');
   const photo=aiJob.resultPhoto;await writeDesign('draft-photo',photo);
   Object.assign(state,{photo,source:'photo',photoOrigin:'upload',effect:'original',zoom:100,x:50,y:50,photoPlacement:null,ai:{styleId:aiJob.styleId,jobId:aiJob.id,mode:'live'}});
   save();go('choose');notify('AI image applied. Adjust your crop, then review your print order.');
  }
 }catch(error){aiUi.error=error.message||'The AI service could not be reached. Please try again.';notify(aiUi.error);}
 finally{aiBusy=false;render(true);}
}
let pollBusy=false,pollErrors=0;
setInterval(async()=>{
 if(!aiJob||aiJob.mode!=='live'||aiBusy||pollBusy||!(['queued','generating'].includes(aiJob.status)||aiJob.status==='ready'&&!aiJob.resultPhoto))return;
 pollBusy=true;const pollingJob=aiJob;
 try{
  const previous=aiJob.status,hadImage=Boolean(aiJob.resultPhoto);
  const updated=await refreshLiveRender(pollingJob);
  if(aiJob?.id!==pollingJob.id)return;
  await rememberLiveJob(updated);pollErrors=0;aiUi.reconnecting=false;
  if(previous!==aiJob.status||hadImage!==Boolean(aiJob.resultPhoto)){
   if(['ready','failed','cancelled'].includes(aiJob.status))try{await syncAIAccount();}catch{/* Show the finished image even if the balance refresh is unavailable. */}
   render(true);
   if(aiJob.status==='ready')notify('Your AI image is ready. Open AI studio to use it.');
  }
 }catch{if(aiJob?.id===pollingJob.id){aiUi.reconnecting=true;if(++pollErrors===1)notify('We could not update your render. Reconnecting…');}}
 finally{pollBusy=false;}
},3000);

app.addEventListener('click',async event=>{
 const button=event.target.closest('[data-customer-action]');
 if(!button)return;event.preventDefault();await handleCustomer(button.dataset.customerAction);
});
async function loadCustomerCredits(reset=false){
 if(!membership.authenticated||customerUI.ledgerBusy)return;
 const id=membership.customer.id;customerUI.ledgerBusy=true;customerUI.ledgerError='';
 try{const data=await getCustomerCredits(reset?null:customerUI.ledgerNext);if(membership.customer?.id===id){customerUI.ledger=reset?data.results:[...customerUI.ledger,...data.results];customerUI.ledgerNext=data.nextCursor;}}
 catch(error){if(membership.customer?.id===id)customerUI.ledgerError=error.message;}
 finally{if(membership.customer?.id===id)customerUI.ledgerBusy=false;}
}
async function handleCustomer(action,fields){
 if(action==='credits-toggle'){customerUI.ledgerOpen=!customerUI.ledgerOpen;render(true);return;}
 if(action==='credits-more'||action==='credits-refresh'){const loading=loadCustomerCredits(action==='credits-refresh');render(true);await loading;render(true);return;}
 if(customerUI.busy)return;
 if(action==='change-email'){customerUI.codeSent=false;customerUI.error='';render(true);return;}
 customerUI.busy=true;customerUI.error='';customerUI.success='';
 if(action==='send')customerUI.email=String(fields.get('email')||'').trim();
 const code=String(fields?.get('code')||'').trim();
 render(true);
 try{
  if(action==='profile'){
   await updateCustomerName(String(fields.get('displayName')||'').trim());await syncAIAccount();customerUI.success='Your profile has been saved.';
  }else if(action==='send'||action==='resend'){
   await sendEmailCode(customerUI.email);customerUI.codeSent=true;customerUI.resendAt=Date.now()+60000;
   clearTimeout(resendTimer);resendTimer=setTimeout(()=>{const button=app.querySelector('[data-customer-action="resend"]');if(button&&!customerUI.busy)button.disabled=false;},60000);
  }else if(action==='verify'){
   await verifyEmailCode(customerUI.email,code);await syncAIAccount();customerUI.codeSent=false;
   customerUI.busy=false;go(customerUI.next==='ai'&&aiJob?'ai':'choose');
  }else if(action==='logout'){
   await signOutCustomer();
   await mergeAIAccount({server:true,authenticated:false,customer:null,trialRemaining:0,trialGranted:0,subscription:null,demoSubscriptionsAvailable:false});
   customerUI.email='';customerUI.codeSent=false;await syncAIAccount();
  }
 }catch(error){customerUI.error=error.message;}
 finally{customerUI.busy=false;render(true);if(customerUI.codeSent)document.getElementById('customer-code')?.focus({preventScroll:true});}
}
