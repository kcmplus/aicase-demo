import {socialDetail,draftFor} from './social-view.js';
import {toggleLike,toggleSave,toggleFollow,addComment,deleteComment,listComments} from './social-core.js';
import {ct} from './creator-view.js';

export function installSocial({getState,render,persist,toast,account,use}){
 const dialog=document.createElement('dialog');dialog.id='content-dialog';dialog.setAttribute('aria-labelledby','social-content-title');document.body.append(dialog);
 let origin=null,openId=null,previousFocus=null,restoring=false,pendingAccount=null;
 const route=()=>{const [path,q='']=location.hash.slice(1).split('?');return {path,params:new URLSearchParams(q)};};
 const stripPost=()=>{const r=route();r.params.delete('post');return '#'+r.path+(r.params.size?'?'+r.params:'');};
 const errors={login:['请先进入演示账户','Enter a demo account first'],unavailable:['内容已下架，无法继续互动','This content is unavailable'],creator:['创作者暂不可用','Creator unavailable'],text:['请输入 1–300 个字符','Enter 1–300 characters'],reply:['这条评论暂时无法回复','This comment cannot be replied to'],permission:['只能删除自己发布的评论','You can only delete your own comments'],missing:['评论暂不可用','Comment unavailable']};
 function error(err){toast(errors[err.message.replace('social:','')]?ct(...errors[err.message.replace('social:','')]):err.message);}
 function draw(){const scroll=dialog.querySelector('.social-detail-scroll')?.scrollTop||0,mobileScroll=dialog.querySelector('.social-detail-layout')?.scrollTop||0;dialog.innerHTML=`<button class="social-close" data-social="close" aria-label="${ct('关闭作品详情','Close content details')}">×</button>`+socialDetail(getState(),openId);dialog.querySelector('.social-detail-scroll')?.scrollTo(0,scroll);dialog.querySelector('.social-detail-layout')?.scrollTo(0,mobileScroll);}
 function close(){if(!openId)return;const fallback=stripPost();if(history.state?.popomoPost===openId)history.back();else{history.replaceState(null,'',fallback);render();}}
 function sync(){if(pendingAccount&&pendingAccount.hash!==location.hash){pendingAccount=null;document.getElementById('account-dialog').close();}const r=route(),id=['discover','creator'].includes(r.path)?r.params.get('post'):null;
  if(id){if(!openId){origin??={hash:stripPost(),y:window.scrollY};previousFocus=document.activeElement;openId=id;draw();dialog.showModal();document.body.classList.add('social-modal-open');dialog.querySelector('[data-social=close]').focus({preventScroll:true});}else{openId=id;const focus=document.activeElement;const key=focus?.dataset?.social,which=focus?.dataset?.id;const isInput=focus?.name==='comment',start=focus?.selectionStart;draw();if(isInput){const input=dialog.querySelector('textarea');input?.focus({preventScroll:true});input?.setSelectionRange(start,start);}else if(key){dialog.querySelector(`[data-social="${key}"]${which?`[data-id="${CSS.escape(which)}"]`:''}`)?.focus({preventScroll:true});}}}
  else if(openId){const restore=origin&&location.hash===origin.hash,y=origin?.y||0,oldId=openId;openId=null;dialog.close();dialog.innerHTML='';document.body.classList.remove('social-modal-open');if(restore){restoring=true;window.scrollTo(0,y);const target=document.querySelector(`.content-title[data-id="${CSS.escape(oldId)}"]`);(target||previousFocus)?.focus?.({preventScroll:true});}origin=null;}
 }
 function afterNavigation(oldURL,newURL){const before=new URL(oldURL).hash,after=new URL(newURL).hash;const root=h=>h.replace(/([?&])post=[^&]*(&|$)/,(_,a,b)=>b?a:'').replace(/[?&]$/,'');const keep=restoring||root(before)===root(after);restoring=false;return keep;}
 function mutate(fn){try{const focus=document.activeElement,action=focus?.dataset?.social,id=focus?.dataset?.id;fn();persist();render();if(!dialog.open&&action&&id)document.querySelector(`[data-social="${action}"][data-id="${CSS.escape(id)}"]`)?.focus({preventScroll:true});}catch(err){error(err);}}
 function requireAccount(fn){if(getState().account)return fn();const intent={hash:location.hash};pendingAccount=intent;account(()=>{if(pendingAccount===intent&&intent.hash===location.hash){pendingAccount=null;fn();}});document.getElementById('account-dialog').addEventListener('close',()=>{if(pendingAccount===intent)pendingAccount=null;},{once:true});}
 document.addEventListener('click',e=>{const b=e.target.closest('[data-social]');if(!b||b.disabled)return;const action=b.dataset.social,id=b.dataset.id;
  if(action==='open'&&(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey))return;
  e.preventDefault();
  if(action==='open'){const r=route();if(!['discover','creator'].includes(r.path)){location.hash='content?id='+encodeURIComponent(id);return;}origin={hash:stripPost(),y:window.scrollY};r.params.set('post',id);history.pushState({popomoPost:id},'','#'+r.path+'?'+r.params);sync();return;}
  if(action==='close')return close();
  if(['like','save','follow'].includes(action))return requireAccount(()=>mutate(()=>({like:toggleLike,save:toggleSave,follow:toggleFollow})[action](getState(),id)));
  if(action==='comment-focus'){(dialog.open?dialog:document).querySelector('#social-comment-form textarea')?.focus();return;}
  if(action==='reply'||action==='cancel-reply'){const d=draftFor(getState(),id),comment=listComments(getState(),id).find(c=>c.id===b.dataset.commentId);d.parentId=action==='reply'?(comment?.parentId||comment?.id||null):null;render();(dialog.open?dialog:document).querySelector('#social-comment-form textarea')?.focus();return;}
  if(action==='delete')return mutate(()=>{deleteComment(getState(),id,b.dataset.commentId);const d=draftFor(getState(),id);if(d.parentId===b.dataset.commentId)d.parentId=null;});
 });
 document.addEventListener('input',e=>{if(e.target.matches('#social-comment-form textarea')){const f=e.target.form;draftFor(getState(),f.dataset.id).text=e.target.value;f.querySelector('[data-comment-length]').textContent=e.target.value.length+'/300';}});
 document.addEventListener('submit',e=>{if(e.target.id!=='social-comment-form')return;e.preventDefault();const id=e.target.dataset.id,d=draftFor(getState(),id),text=e.target.elements.comment.value,parent=d.parentId;if(!text.trim())return toast(ct('写点内容，再发送吧。','Write a comment before sending.'));requireAccount(()=>mutate(()=>{addComment(getState(),id,text,parent);d.text='';d.parentId=null;Object.assign(draftFor(getState(),id),{text:'',parentId:null});toast(ct('评论已保存（本机演示）','Comment saved (local demo)'));}));});
 dialog.addEventListener('click',e=>{const b=e.target.closest('[data-creator=use]');if(b){try{use(b.dataset.id);}catch(err){error(err);}return;}if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 return {sync,afterNavigation};
}
