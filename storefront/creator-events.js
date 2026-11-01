import {creatorUI,ct,creatorResults} from './creator-view.js';
import {useContent,saveDraft,submitDraft,publishDraft,unpublishContent,requestChanges} from './creator-core.js';
export function creatorMessage(message){const key=message.replace('creator:','');const messages={permission:['此演示账号未分配该创作身份','This demo account is not assigned to this creator'],type:['请选择内容类型','Choose a content type'],title:['请填写中文标题','Enter a Chinese title'],missing:['草稿不存在','Draft not found'],design:['设计不可用，请返回工作台检查','Check your design in the studio'],asset:['请选择 PNG、JPG 或 WebP 文件或演示素材','Select an image file or demo asset'],unavailable:['引用内容已下架，请移除对应素材或选择其他设计','A referenced asset is unavailable. Remove it or choose another design.'],status:['状态已变化，请重新检查','The status changed. Please check again.'],'layer-limit':['最多添加 20 个图层','You can add up to 20 layers']};return messages[key]?ct(...messages[key]):message;}
export function installCreators({app,getState,render,persist,toast,go,checkpoint,select}){
const error=err=>toast(creatorMessage(err.message));
let replacement=null;
function use(id){checkpoint();select(useContent(getState(),id));persist();go('studio');toast(ct('已加入个人设计，可编辑或撤销','Added to your design. Edit it or undo.'));}
app.addEventListener('click',e=>{const el=e.target.closest('[data-creator]');if(!el||el.disabled)return;const s=getState(),a=el.dataset.creator,id=el.dataset.id;try{
if(a==='use')return use(id);
if(a==='filter'){creatorUI.type=el.dataset.type;creatorUI.limit=24;creatorUI.query='';render();return;}
if(a==='more'){creatorUI.limit+=24;const profile=location.hash.startsWith('#creator?')?new URLSearchParams(location.hash.split('?')[1]).get('id'):null;document.getElementById('creator-results').innerHTML=creatorResults(s,profile);return;}
if(a==='new'){creatorUI.edit=null;creatorUI.asset='';creatorUI.designDraft=null;creatorUI.formValues=null;replacement=null;go('creator-workspace?type='+el.dataset.type);return;}
if(a==='asset'){creatorUI.asset=el.dataset.src;const img=document.createElement('img');img.src=creatorUI.asset;img.alt=ct('已选择素材','Selected asset');document.getElementById('creator-asset-preview').replaceChildren(img);return;}
if(a==='replace-design'){replacement=structuredClone(s.design);toast(ct('保存草稿时将使用当前工作台设计','The draft will use your current studio design when saved'));return;}
if(a==='edit-design'){const draft=s.creator?.drafts.find(d=>d.id===id);if(!draft)return;const form=document.getElementById('creator-form');creatorUI.formValues={id,zh:form.elements.zh.value,en:form.elements.en.value};if(creatorUI.designDraft!==id){checkpoint();s.design=structuredClone(replacement||draft.design);select(null);}creatorUI.designDraft=id;replacement=null;persist();go('studio');return;}
if(a==='edit'){if(creatorUI.edit!==id){creatorUI.designDraft=null;creatorUI.formValues=null;}creatorUI.edit=id;creatorUI.asset='';replacement=null;render();document.getElementById('creator-form').scrollIntoView({block:'center'});return;}
if(a==='submit')submitDraft(s,id);
if(a==='publish')publishDraft(s,id);
if(a==='changes')requestChanges(s,id);
if(a==='unpublish')unpublishContent(s,id);
persist();render();toast(ct('内容状态已更新（本机演示）','Content updated (local demo)'));
}catch(err){error(err);}});
app.addEventListener('input',e=>{if(e.target.id==='creator-search'){creatorUI.query=e.target.value;creatorUI.limit=24;document.getElementById('creator-results').innerHTML=creatorResults(getState());}});
app.addEventListener('submit',e=>{if(e.target.id!=='creator-form')return;e.preventDefault();const f=e.target,s=getState(),data=new FormData(f),old=s.creator?.drafts.find(d=>d.id===f.dataset.id);try{if(creatorUI.uploading)throw Error(ct('图片仍在处理，请稍候','Please wait for the image to finish loading'));saveDraft(s,{id:old?.id,creatorId:old?.creatorId||data.get('creatorId'),type:f.dataset.type,zh:data.get('zh'),en:data.get('en'),src:creatorUI.asset||old?.src,design:replacement||(old&&creatorUI.designDraft===old.id?s.design:old?.design||s.design)});creatorUI.edit=null;creatorUI.asset='';creatorUI.designDraft=null;creatorUI.formValues=null;replacement=null;const saved=persist();render();if(saved)toast(ct('草稿已保存，可以提交审核','Draft saved. Ready to submit for review.'));}catch(err){document.getElementById('creator-form-error').textContent=creatorMessage(err.message);}});
app.addEventListener('change',async e=>{if(e.target.id!=='creator-file')return;const file=e.target.files[0];if(!file)return;if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>10*1024*1024)return toast(ct('请选择 10 MB 以内的 PNG、JPG 或 WebP','Choose PNG, JPG, or WebP up to 10 MB'));creatorUI.uploading=true;const input=e.target;try{const bitmap=await createImageBitmap(file),scale=Math.min(1,1000/Math.max(bitmap.width,bitmap.height)),canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();if(!input.isConnected)return;creatorUI.asset=canvas.toDataURL(file.type==='image/png'?'image/png':'image/jpeg',.82);const img=document.createElement('img');img.src=creatorUI.asset;img.alt=ct('已选择素材','Selected asset');document.getElementById('creator-asset-preview').replaceChildren(img);}catch{toast(ct('图片无法读取，请重新选择','Unable to read this image. Choose another file'));}finally{creatorUI.uploading=false;}});
return {use};
}
