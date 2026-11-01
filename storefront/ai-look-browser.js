import {aiGroups} from './ai-examples.js';
import {imageTag} from './image-view.js';
import {localized,t} from './simple-i18n.js';
import {esc,icon} from './art.js';
import {AI_AVAILABLE} from './ai-membership.js';

// Select the exact saved example/style pair, even when originals are shared.
export function activeLook(state){
 const groups=aiGroups();
 const group=groups.find(g=>g.looks.some(l=>l.example.id===state.aiExample&&l.style.id===state.aiStyle))||groups.find(g=>g.examples.some(e=>e.id===state.aiExample))||groups[0];
 if(!group)return {groups};
 const look=group.looks.find(l=>l.example.id===state.aiExample&&l.style.id===state.aiStyle)||group.looks[0];
 return {groups,group,look,index:group.looks.indexOf(look)};
}

export function lookBrowserContent(state,job,ui={}){
 const {groups,group,look,index}=activeLook(state);if(!look)return '';
 const hasPhoto=state.source==='photo'&&Boolean(state.photo),mode=ui.lookMode==='compare'?'compare':'effect',reveal=Math.max(0,Math.min(100,Number.isFinite(ui.lookCompare)?ui.lookCompare:50));
 return `<header class="look-header"><div><span class="look-mark" aria-hidden="true">${icon('spark',21)}</span><h2 id="look-browser-title">AI Studio</h2></div><button type="button" class="look-close" data-look-action="close" aria-label="Close AI Studio" autofocus>${icon('close',21)}</button></header>
 <div class="look-subjects" role="group" aria-label="Choose an example photo">${groups.map(g=>`<button type="button" data-ai-group="${esc(g.example.id)}" aria-pressed="${g===group}">${esc(localized(g.example))}</button>`).join('')}</div>
 <section class="look-preview" aria-label="Style example preview"><div class="look-preview-top"><div class="look-view-switch" role="group" aria-label="Example view"><button type="button" data-look-mode="compare" aria-pressed="${mode==='compare'}">Compare</button><button type="button" data-look-mode="effect" aria-pressed="${mode==='effect'}">AI effect</button></div><button type="button" class="look-enlarge" data-look-action="zoom" aria-label="Enlarge style example" aria-pressed="false">${icon('scan',18)}</button></div>
  <div class="look-comparison" data-look-view="${mode}" style="--look-reveal:${reveal}%">
   ${imageTag(look.image,{alt:`${localized(look.style)} · ${localized(look.example)}`,sizes:'(max-width: 760px) 100vw, 700px',loading:'eager'})}
   <div class="look-before">${imageTag(group.original,{alt:`${t('Original photo')} · ${localized(group.example)}`,sizes:'(max-width: 760px) 100vw, 700px',loading:'eager'})}</div>
   <span class="look-before-label">Original</span><span class="look-after-label">AI effect</span><span class="look-divider" aria-hidden="true"><span>↔</span></span>
   <input class="look-wipe" type="range" min="0" max="100" value="${reveal}" aria-label="Compare original and AI example" aria-valuetext="${reveal}%" ${mode==='effect'?'hidden':''}>
   <button type="button" class="look-photo-open" data-look-action="zoom" aria-label="View full style image"><span>${icon('scan',13)} View full image</span></button>
   <div class="look-load-note" role="status"><i class="studio-spinner" aria-hidden="true"></i><span>Loading preview…</span></div>
  </div><p class="look-preview-note">${mode==='compare'?'Drag across the photo to compare':'Detail preview · Tap to view the full image'}</p>
 </section>
 <section class="look-choices" aria-label="Choose your AI look"><div class="look-title-row"><div><span class="look-example-label">${esc(localized(group.example))} · ${group.looks.length} <span>AI looks</span></span><h3>${esc(localized(look.style))}</h3></div><div class="look-arrows"><span>${index+1} / ${group.looks.length}</span><button type="button" data-ai-look-step="-1" aria-label="Previous AI look">${icon('back',17)}</button><button type="button" data-ai-look-step="1" aria-label="Next AI look">${icon('arrow',17)}</button></div></div>
  <div class="look-filmstrip">${group.looks.map(({example,style,image})=>`<button type="button" class="look-thumb" data-ai-look-example="${esc(example.id)}" data-ai-look-style="${esc(style.id)}" aria-pressed="${look.example.id===example.id&&look.style.id===style.id}" aria-label="${esc(localized(style))} · ${esc(localized(example))}">${imageTag(image,{alt:'',sizes:'(max-width: 760px) 96px, 120px'})}<span>${esc(localized(style))}</span><i aria-hidden="true">${icon('check',12)}</i></button>`).join('')}</div>
 </section>
 <footer class="look-dock"><div class="look-photo-receipt">${hasPhoto?imageTag(state.photo,{alt:'Your photo',sizes:'40px'}):icon('image',18)}<p>${hasPhoto?'Your photo is ready':'Choose a look, then add your photo'}</p>${hasPhoto?'<button type="button" data-ai-action="upload">Change</button>':''}</div>
  <button type="button" class="button look-cta full" data-ai-action="${hasPhoto?'create':'upload'}" ${AI_AVAILABLE?'':'disabled'}>${AI_AVAILABLE?(hasPhoto?'Use this look':'Upload your photo'):'AI generation is currently unavailable.'} ${icon(hasPhoto?'arrow':'upload',18)}</button>
  <p class="look-disclaimer">Examples show the style. Generation starts after confirmation.</p>
  ${job?'<a class="look-latest" href="#ai">My latest render →</a>':''}
 </footer>`;
}

export function setLookComparison(root,value){
 const number=Number(value),position=Number.isFinite(number)?Math.max(0,Math.min(100,number)):50;
 root.querySelector('.look-comparison')?.style.setProperty('--look-reveal',position+'%');
 const input=root.querySelector('.look-wipe');if(input){input.value=String(position);input.setAttribute('aria-valuetext',position+'%');}
 return position;
}

export function setLookMode(root,value){
 const mode=value==='effect'?'effect':'compare';
 root.querySelector('.look-comparison').dataset.lookView=mode;
 root.querySelector('.look-wipe').hidden=mode==='effect';
 root.querySelectorAll('[data-look-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lookMode===mode)));
 root.querySelector('.look-preview-note').textContent=t(mode==='compare'?'Drag across the photo to compare':'Detail preview · Tap to view the full image');
 return mode;
}

export function updateLookImageState(root){
 const board=root?.querySelector('.look-comparison');if(!board)return;
 const images=[board.querySelector(':scope > img'),...(board.dataset.lookView==='compare'?[board.querySelector('.look-before img')]:[])];
 const failed=images.some(img=>img.complete&&!img.naturalWidth),ready=images.every(img=>img.complete&&img.naturalWidth);
 board.dataset.imageState=failed?'failed':ready?'ready':'loading';
 const note=board.querySelector('.look-load-note');note.hidden=ready;note.querySelector('i').hidden=failed;note.querySelector('span').textContent=t(failed?'This preview could not load. Please choose another look.':'Loading preview…');
}
