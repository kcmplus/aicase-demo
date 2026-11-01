import {shopUI,menuContent,menuResults,productCards,tr} from './shop-views.js';
import {addAccessory,addCase,changeQuantity} from './shop-core.js';
import {phoneBrands,productById} from './shop-catalog.js';
import {saveModel} from './core.js';
import {designFor} from './catalog.js';
import {localize} from './i18n.js';
export function installShop({app,getState,replaceDesign,persist,render,go,toast,account,changeLanguage,canInteract}){
 const dialog=document.querySelector('#menu-dialog');
 const refreshMenu=()=>{dialog.innerHTML=menuContent(getState());localize(dialog);};
 const close=()=>dialog.close();
 dialog.addEventListener('close',()=>app.querySelector('[data-shop="open-menu"]')?.focus({preventScroll:true}));
 dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
 const handle=e=>{const el=e.target.closest('[data-shop]');if(!el||el.disabled||!canInteract())return;const s=getState();try{switch(el.dataset.shop){
 case 'open-menu':shopUI.menuQuery='';refreshMenu();dialog.showModal();dialog.querySelector('[data-shop="close-menu"]').focus();break;
 case 'close-menu':close();break;
 case 'menu-account':close();account();break;
 case 'menu-mail':s.delivery='mail';persist();close();go('studio');break;
 case 'menu-language':shopUI.menuQuery='';refreshMenu();dialog.querySelector('.menu-language').hidden=false;dialog.querySelector('#drawer-language').focus();break;
 case 'choose-model':saveModel(s,el.dataset.model);persist();shopUI.menuQuery='';refreshMenu();render();toast(tr('已选择手机型号','Phone model selected'));break;
 case 'menu-design':replaceDesign(designFor(el.dataset.id));persist();close();go('studio');toast(tr('已套用图案，可撤销恢复原设计','Design applied. Undo restores your previous design.'));break;
 case 'add-accessory':addAccessory(s,el.dataset.product,shopUI.variants[el.dataset.product]);persist();render();toast(tr('已加入购物车 · 仅支持邮寄','Added to bag · Shipping only'));break;
 case 'add-case':case 'case-accessories':if(!s.model){go('studio');toast(tr('请先选择手机型号','Choose a phone model first'));break;}addCase(s);persist();go(el.dataset.shop==='case-accessories'?'shop':'cart');toast(tr('已保存手机壳设计并加入购物车','Case design saved to your bag'));break;
 case 'quantity':changeQuantity(s,el.dataset.id,Number(el.dataset.value));persist();render();break;
 case 'clear-cart':s.cart=[];persist();render();break;
 case 'fill-international':s.address={name:'Demo Customer',phone:'+1 202 555 0142',country:tr('美国','United States'),city:'New York, NY',postal:'10001',detail:'100 Demo Street, Apt 1'};for(const [key,value]of Object.entries(s.address)){const field=document.querySelector('#checkout-form').elements[key];if(field){field.value=value;field.setCustomValidity('');}}persist();break;
 }}catch(err){toast(err.message);}};
 app.addEventListener('click',handle);dialog.addEventListener('click',e=>{handle(e);if(e.target.closest('a[href^="#"]')){shopUI.query='';close();}const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))close();});
 dialog.addEventListener('input',e=>{if(e.target.id==='menu-search'){shopUI.menuQuery=e.target.value;dialog.querySelector('#menu-results').innerHTML=menuResults(getState());dialog.querySelector('#menu-main').hidden=!!e.target.value.trim();localize(dialog.querySelector('#menu-results'));}});
 dialog.addEventListener('change',e=>{if(e.target.id==='drawer-model'){if(e.target.value)saveModel(getState(),e.target.value);else getState().model='';persist();refreshMenu();render();dialog.querySelector('#drawer-model').focus();}if(e.target.id==='drawer-language'){changeLanguage(e.target.value);refreshMenu();dialog.querySelector('.menu-language').hidden=false;dialog.querySelector('#drawer-language').focus();}});
 app.addEventListener('click',e=>{const link=e.target.closest('.desktop-nav a[href^="#shop?category="]');if(link&&canInteract()){e.preventDefault();shopUI.query='';go(link.getAttribute('href').slice(1));}});
 app.addEventListener('input',e=>{if(e.target.id==='shop-search'){shopUI.query=e.target.value;document.querySelector('#product-grid').innerHTML=productCards();}});
 app.addEventListener('change',e=>{
  const el=e.target,product=el.dataset.product;
  if(!canInteract()||!['product-brand','product-variant'].includes(el.id))return;
  if(el.id==='product-brand'){
   shopUI.brands[product]=phoneBrands.some(b=>b.id===el.value)?el.value:'';
   delete shopUI.variants[product];
  }else{
   const variant=productById(product)?.variants.find(v=>v.id===el.value);
   shopUI.variants[product]=variant&&(!variant.brand||variant.brand===shopUI.brands[product])?variant.id:'';
  }
  const y=scrollY;render();document.getElementById(el.id)?.focus({preventScroll:true});scrollTo(0,y);
 });
 return {close};
}
