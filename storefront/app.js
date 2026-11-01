import {installSocial} from './social-events.js';
import {hydratePaymentLedger,commitWithPaymentLedger} from './payment-ledger.js';
import {discover,creator,content,creatorWorkspace} from './creator-view.js';
import {canCreate,validateDesignSources} from './creator-core.js';
import {installCreators,creatorMessage} from './creator-events.js';
import {installBeautifier} from './beautify-ui.js';
import {designFor} from './catalog.js';
import {offers,marketingMessage,couponFeedback,discountLines} from './marketing-view.js';
import {claimCoupon,selectCoupon,checkoutQuote,commitMarketingOrder,captureCampaign,mergeMarketingLedger} from './marketing-core.js';
import {installStudio} from './studio-events.js';
import {ui} from './studio-view.js';
import {addLayer} from './editor-model.js';
import {installShop} from './shop-events.js';
import {shop,product,cart,cartCheckout,materials,tr} from './shop-views.js';
import {createCartOrder} from './shop-core.js';
import {locale,setLocale,t,localize} from './i18n.js';
import {initialState,login,saveModel,scanDevice,availability,createOrder,advanceOrder,models} from './core.js';
import {header,footer,home,studio,delivery,checkout,orders,device} from './views.js';
import {icon,phone,esc} from './art.js';
const KEY='ai-case-studio-v1';
let s=initialState();
try{const stored=JSON.parse(localStorage.getItem(KEY));if(stored&&Array.isArray(stored.orders)&&stored.design&&stored.accounts)s={...s,...stored};}catch{}
s.ledgerId ||= crypto.randomUUID();
try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}
const app=document.querySelector('#app'),dialog=document.querySelector('#account-dialog');
let route='home',paying=false,toastTimer;let studioTools,shopTools,socialTools,creatorTools;
const params=new URLSearchParams(location.search);
captureCampaign(s,params);
// Consume explicit activity parameters once. Current device navigation must not
// become a new campaign touch when the page is reloaded.
if(params.has('campaign')&&params.has('source')){const clean=new URL(location.href);clean.searchParams.delete('campaign');clean.searchParams.delete('source');history.replaceState(null,'',clean);}
if(params.get('device')&&(!location.hash||location.hash==='#device')){scanDevice(s,params.get('device'));history.replaceState(null,'',location.pathname+location.search+'#device');}
if(params.get('screen')==='kiosk')document.body.classList.add('kiosk');
function syncMarketingLedger(){try{mergeMarketingLedger(s,JSON.parse(localStorage.getItem(KEY)));}catch{}}
function persist(){try{syncMarketingLedger();localStorage.setItem(KEY,JSON.stringify(s));return true;}catch{toast('本机存储空间不足，当前更改仅在本次页面保留');return false;}}
function toast(msg){const el=document.querySelector('#toast');el.textContent=t(msg);el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3400);}
function go(r){if(location.hash==='#'+r)render();else location.hash=r;}
function render(){route=(location.hash.slice(1)||'home').split('?')[0];const views={discover,creator,content,'creator-workspace':creatorWorkspace,offers,home,studio,delivery,checkout,orders,device,shop,product,cart,'cart-checkout':cartCheckout,materials};if(!views[route])route='home';if(['delivery','checkout'].includes(route)&&!s.model){history.replaceState(null,'','#studio');route='studio';toast('先选择手机型号，再继续定制');}if(route==='checkout'&&s.delivery==='pickup'&&!availability(s.deviceId,s.model).ok){route='delivery';history.replaceState(null,'','#delivery');toast('该设备暂不能制作此机型，请选择其他交付方式');}if(route==='cart-checkout'){s.checkoutMode='cart';s.delivery='mail';}if(route==='checkout')s.checkoutMode='case';app.innerHTML=header(s,route)+views[route](s)+footer(route);localize(app);const language=document.querySelector('#language');if(language)language.disabled=paying;document.title=t(({discover:tr('创作者内容','Creator content'),creator:tr('创作者主页','Creator profile'),content:tr('内容详情','Content details'),'creator-workspace':tr('创作空间','Creator workspace'),offers:tr('创作礼与优惠券','Offers & coupons'),home:'把灵感，握在手里',studio:'AI DIY 设计工作台',delivery:'选择交付方式',checkout:'确认与演示支付',orders:'订单与交付进度',device:'设备与扫码入口',shop:tr('手机壳搭配配件','Extras for your case'),product:tr('配件详情','Accessory details'),cart:tr('购物车','Shopping bag'),'cart-checkout':tr('邮寄合并结账','Combined shipping checkout'),materials:tr('壳体实物与材质','Case materials & details')})[route])+' · POPOMO';bindForms();studioTools?.decorateCanvas();if(document.querySelector('#coupon-select'))refreshCoupon();socialTools?.sync();}
function refreshPreview(){const el=document.querySelector('#live-phone');if(el){el.innerHTML=phone(s.design,s.model);localize(el);studioTools?.decorateCanvas();}}
function refreshCoupon(){
 const form=document.querySelector('#checkout-form');if(!form||paying)return;
 syncMarketingLedger();
 const q=checkoutQuote(s,form.dataset.cart==='true'),feedback=document.querySelector('#coupon-feedback');
 if(feedback){feedback.textContent=couponFeedback(q);feedback.classList.toggle('coupon-error',!q.ok);}
 const summary=form.querySelector('.order-summary');
 summary.querySelector('.marketing-prices').innerHTML=discountLines(q);
 summary.querySelector('.total-line strong').textContent='USD '+q.total.toFixed(2);
 const pay=form.querySelector('#pay-button');pay.disabled=!q.ok;pay.innerHTML=tr('模拟支付','Demo pay')+' USD '+q.total.toFixed(2)+' '+icon('arrow');
}
app.addEventListener('click',async e=>{
 const el=e.target.closest('[data-marketing]');if(!el||el.disabled||paying)return;e.preventDefault();
 try{
  const action=el.dataset.marketing,id=el.dataset.coupon;
  if(action==='claim'){
   if(!s.account)return account();
   syncMarketingLedger();
   claimCoupon(s,id);persist();render();toast(tr('演示券已保存至我的优惠券','Demo coupon saved to My coupons'));return;
  }
  if(action==='use'){
   selectCoupon(s,id);
   if(id==='station'){scanDevice(s,'SH-001');const url=new URL(location.href);url.searchParams.set('device','SH-001');history.replaceState(null,'',url);}
   if(id==='shipping')s.delivery='mail';
   persist();go(id==='station'?'device':id==='shipping'&&s.cart.length?'cart':'studio');return;
  }
  if(action==='coupon-order'){s.activeOrder=el.dataset.order;persist();go('orders');return;}
  if(action==='open-offers'){
   const source=el.dataset.source,params=new URLSearchParams({campaign:source==='station'?'station-moment':'creation-gifts',source});
   if(source==='station')params.set('device',s.deviceId);
   captureCampaign(s,params);persist();go('offers');return;
  }
  if(action==='copy-campaign'){
   const url=new URL(location.pathname,location.origin);url.searchParams.set('lang',locale());url.searchParams.set('campaign','creation-gifts');url.searchParams.set('source','partner');url.hash='offers';
   const input=document.querySelector('#campaign-link');input.value=url.href;input.hidden=false;
   try{await navigator.clipboard.writeText(url.href);toast(tr('活动链接已复制，不包含个人设计','Offer link copied. No personal designs included'));}catch{input.focus();input.select();toast(tr('请选择并复制下方活动链接','Select and copy the offer link below'));}
  }
 }catch(err){toast(err.message.startsWith('coupon:')?marketingMessage(err.message.slice(7)):err.message);}
});
function account(afterLogin){dialog.innerHTML=`<button class="close-dialog" data-close aria-label="关闭账户窗口">${icon('close')}</button><span class="eyebrow">YOUR CREATIVE IDENTITY</span><h2>${s.account?'很高兴，又见到你。':'让灵感，记得你。'}</h2>${s.account?`<p>${esc(s.account.email)}</p><div class="account-saved">我的默认机型<br><strong>${esc(s.account.defaultModel||'尚未选择')}</strong></div><p>下次扫码会自动读取此机型，并检查设备是否支持及有无库存。</p><a class="btn secondary account-wallet" href="#offers?tab=wallet" data-wallet>${tr('我的优惠券','My coupons')} ${icon('spark')}</a>${canCreate(s)?`<a class="btn secondary account-wallet" data-wallet href="#creator-workspace">${tr('我的创作空间','My creator workspace')}</a>`:''}<button class="btn primary wide" data-close>继续创作</button><button class="btn secondary wide" data-logout>退出演示账户</button>`:`<p>用演示邮箱进入，保存默认手机型号。<br>无需密码或验证码，不会发送邮件。</p><form id="account-form"><label for="email">演示邮箱<input id="email" name="email" type="email" required placeholder="you@example.com" autocomplete="off"></label><label for="default-model">默认手机型号<select id="default-model" name="model" required><option value="">选择手机型号</option>${models.map(m=>`<option ${s.model===m?'selected':''}>${m}</option>`).join('')}</select></label><button class="btn primary wide" type="submit">保存机型并进入演示 ${icon('arrow')}</button></form>`}<p class="fine-print">这是本机演示账户，没有真实注册、认证或跨设备同步。</p>`;localize(dialog);dialog.showModal();dialog.querySelectorAll('[data-wallet]').forEach(el=>el.addEventListener('click',()=>dialog.close()));dialog.querySelector('#email')?.addEventListener('input',e=>{const existing=s.accounts[e.target.value.trim().toLowerCase()];const select=dialog.querySelector('#default-model');if(existing?.defaultModel){select.value=existing.defaultModel;select.disabled=true;}else{select.disabled=false;}});dialog.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>dialog.close());dialog.querySelector('[data-logout]')?.addEventListener('click',()=>{s.account=null;s.model='';persist();dialog.close();render();toast('已退出演示账户');});dialog.querySelector('form')?.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);login(s,data.get('email'),data.get('model'));persist();dialog.close();render();toast('已保存默认机型，下次扫码自动带入');if(typeof afterLogin==='function')afterLogin();});}
app.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el||el.disabled||paying)return;const action=el.dataset.action;
 if(action==='account')return account();
 if(action==='template'){s.design=designFor(el.dataset.art);persist();return go('studio');}
 if(action==='art'){s.design=designFor(el.dataset.art);persist();return render();}
 if(action==='style'){delete s.design.beauty;s.design.style=el.dataset.style;persist();render();toast('已应用本地风格模拟');return;}
 if(action==='enhance'){delete s.design.beauty;s.design.enhance=!s.design.enhance;persist();render();return toast(s.design.enhance?'已应用美化模拟，可点击关闭还原':'已还原美化效果');}
 if(action==='reset-design'){s.design=initialState().design;persist();render();return toast('已重置为初始设计');}
 if(action==='to-delivery'){try{validateDesignSources(s,s.design);}catch(err){return toast(creatorMessage(err.message));}if(!s.model){document.querySelector('#model').focus();return toast('请先选择你的手机型号');}return go('delivery');}
 if(action==='delivery'){s.delivery=el.dataset.mode;persist();return render();}
 if(action==='select-device'){scanDevice(s,el.dataset.id);const url=new URL(location.href);url.searchParams.set('device',el.dataset.id);history.replaceState(null,'',url);persist();render();return toast('已识别设备 '+el.dataset.id);}
 if(action==='mail'){s.delivery='mail';persist();return render();}
 if(action==='mail-design'){s.delivery='mail';persist();return go('studio');}
 if(action==='to-checkout')return go('checkout');
 if(action==='device-design'){if(!availability(s.deviceId,s.model).ok)return toast('请先确认机型与设备库存');s.delivery='pickup';persist();return go('studio');}
 if(action==='fill-address'){const f=document.querySelector('#checkout-form');f.elements.name.value=locale()==='en-US'?'Demo Customer':'演示用户';f.elements.phone.value='13800138000';f.elements.detail.value=locale()==='en-US'?'Room 101, 100 Demo Rd, Jing An District, Shanghai':'上海市静安区演示路 100 号 101 室';for(const name of ['name','phone','detail'])f.elements[name].setCustomValidity('');s.address={name:f.elements.name.value,phone:f.elements.phone.value,detail:f.elements.detail.value};persist();return;}
 if(action==='advance'){const o=s.orders.find(x=>x.id===el.dataset.id);if(o.delivery==='pickup'&&o.step===2){const form=document.querySelector('#pickup-form');form.hidden=false;form.querySelector('input').focus();return;}advanceOrder(o);persist();render();return toast('演示订单进度已更新');}
 if(action==='order'){s.activeOrder=el.dataset.id;persist();return render();}
 if(action==='kiosk'){document.body.classList.toggle('kiosk');render();return;}
});
app.addEventListener('change',e=>{if(paying)return;if(e.target.id==='coupon-select'){selectCoupon(s,e.target.value);persist();refreshCoupon();return;}if(e.target.id==='language'){changeLanguage(e.target.value);return;}if(e.target.id==='model'){if(!e.target.value){s.model='';persist();render();return;}saveModel(s,e.target.value);persist();render();toast(s.account?'默认机型已保存':'已选择机型，可登录保存到演示账户');}if(e.target.id==='photo')upload(e.target.files[0]);});
app.addEventListener('input',e=>{if(e.target.id==='zoom'){s.design.zoom=Number(e.target.value);document.querySelector('#zoom-value').value=e.target.value+'%';refreshPreview();persist();}if(e.target.id==='caption'){s.design.caption=e.target.value;refreshPreview();persist();}if(['name','phone','detail','country','city','postal'].includes(e.target.name)&&['checkout','cart-checkout'].includes(route)){s.address[e.target.name]=e.target.value;persist();}});
async function upload(file,asLayer=false){if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))return toast('请上传 JPG、PNG 或 WebP 图片');if(file.size>10*1024*1024)return toast('图片超过 10 MB，请选择较小的文件');try{const bitmap=await createImageBitmap(file);const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();ui.history.push(s.design);if(asLayer){if((s.design.layers||[]).length>=20)return toast(locale()==='en-US'?'You can add up to 20 layers':'最多添加 20 个图层');ui.selected=addLayer(s.design,'image',canvas.toDataURL('image/jpeg',.82));}else{s.design.image=canvas.toDataURL('image/jpeg',.82);s.design.zoom=100;}persist();render();toast('照片已导入，可调整风格与缩放');}catch{toast('图片无法读取，请选择其他照片');}}
function bindForms(){document.querySelector('#scan-form')?.addEventListener('submit',e=>{e.preventDefault();const id=document.querySelector('#device-id').value.trim().toUpperCase();scanDevice(s,id);persist();const url=new URL(location.href);url.searchParams.set('device',id);url.hash='device';history.replaceState(null,'',url);render();toast('已读取扫码设备 ID：'+id);});
document.querySelector('#checkout-form')?.addEventListener('submit',async e=>{e.preventDefault();if(paying)return;const form=e.target;const isCart=form.dataset.cart==='true',failed=document.querySelector('#fail-payment').checked;if(s.delivery==='mail'){for(const name of (isCart?['name','phone','detail','country','city','postal']:['name','phone','detail']))s.address[name]=form.elements[name].value.trim();}syncMarketingLedger();const submitted=structuredClone(s);const button=document.querySelector('#pay-button'),error=document.querySelector('#checkout-error');paying=true;document.body.classList.add('is-paying');button.disabled=true;button.textContent=t('正在模拟支付…');document.querySelector('#language').disabled=true;error.textContent='';try{const quote=checkoutQuote(submitted,isCart);if(!quote.ok)throw Error('coupon:'+quote.reason);await new Promise(resolve=>setTimeout(resolve,650));if(failed)throw Error('模拟支付失败，未扣款、未生成订单。可取消失败选项后重试。');const commit=()=>{syncMarketingLedger();const order=isCart?createCartOrder(submitted):createOrder(submitted);commitMarketingOrder(s,order,quote);s.orders.unshift(order);s.activeOrder=order.id;if(isCart){s.cart=s.cart.flatMap(line=>{const purchased=submitted.cart.find(p=>p.id===line.id);const remaining=line.quantity-(purchased?.quantity||0);return remaining>0?[{...line,quantity:remaining}]:[];});}};if(navigator.locks?.request){await navigator.locks.request(KEY+'-payment',async()=>{await commitWithPaymentLedger(s,commit);persist();});}else{if(quote.couponId)throw Error('coupon:browser-lock');commit();persist();}go('orders');toast('模拟支付完成，已生成演示订单');}catch(err){const message=err.message.startsWith('coupon:')?marketingMessage(err.message.slice(7)):creatorMessage(err.message);error.dataset.message=err.message;error.textContent=t(message);button.disabled=false;button.innerHTML=t('重新模拟支付 ')+icon('arrow');}finally{paying=false;document.body.classList.remove('is-paying');const language=document.querySelector('#language');if(language)language.disabled=false;}});
document.querySelector('#pickup-form')?.addEventListener('submit',e=>{e.preventDefault();const o=s.orders.find(x=>x.id===s.activeOrder)||s.orders[0];if(document.querySelector('#pickup-code').value!==o.pickupCode){const error=document.querySelector('#pickup-error');error.dataset.message='取货码不匹配，请输入上方六位演示码。';error.textContent=t(error.dataset.message);return;}if(o.step===2)advanceOrder(o);persist();render();toast('演示取货完成，感谢你的创作');});}
function changeLanguage(value){
 const controls=[...app.querySelectorAll('input,textarea,select:not(#language)')].filter(el=>el.type!=='file').map(el=>({id:el.id,name:el.name,formId:el.form?.id,value:el.value,checked:el.checked}));
 const openDetails=[...app.querySelectorAll('details')].map(el=>el.open);
 const pickupOpen=document.querySelector('#pickup-form')?.hidden===false;
 const messages=[...app.querySelectorAll('.form-error')].map(el=>({id:el.id,message:el.dataset.message}));
 const y=window.scrollY;setLocale(value);render();
 for(const item of controls){const el=item.id?document.getElementById(item.id):document.getElementById(item.formId||'checkout-form')?.elements.namedItem(item.name);if(el){el.value=item.value;if(typeof item.checked==='boolean')el.checked=item.checked;}}
 app.querySelectorAll('details').forEach((el,j)=>el.open=openDetails[j]??el.open);
 if(pickupOpen&&document.querySelector('#pickup-form'))document.querySelector('#pickup-form').hidden=false;
 for(const m of messages){const el=document.getElementById(m.id);if(el&&m.message){el.dataset.message=m.message;el.textContent=m.message.startsWith('coupon:')?marketingMessage(m.message.slice(7)):t(m.message);}}
 document.querySelector('#language').focus({preventScroll:true});window.scrollTo(0,y);
}
document.addEventListener('invalid',e=>{const field=e.target;if(!field.matches('input,select'))return;let message='请填写此项。';if(field.type==='checkbox')message='请先勾选确认。';else if(field.type==='email'&&!field.validity.valueMissing)message='请输入有效的邮箱地址。';else if(field.name==='phone'&&!field.validity.valueMissing)message=route==='cart-checkout'?tr('请输入含国家区号的有效联系电话','Enter a valid phone number with country code'):'请输入 11 位中国手机号码。';else if(field.id==='pickup-code'&&!field.validity.valueMissing)message='请输入六位数字取货码。';else if(field.name==='detail'&&!field.validity.valueMissing)message='请完整填写地址（至少 6 个字符）。';field.setCustomValidity(t(message));},true);
document.addEventListener('input',e=>{if(e.target.setCustomValidity)e.target.setCustomValidity('');});
document.addEventListener('change',e=>{if(e.target.setCustomValidity)e.target.setCustomValidity('');});
window.addEventListener('hashchange',e=>{render();if(!socialTools?.afterNavigation(e.oldURL,e.newURL))window.scrollTo({top:0,behavior:'instant'});});
studioTools=installStudio({app,getState:()=>s,setDesign:d=>s.design=d,render,refresh:refreshPreview,persist,toast,go,upload});
shopTools=installShop({app,getState:()=>s,replaceDesign:d=>{studioTools.checkpoint();s.design=d;ui.selected=null;},persist,render,go,toast,account,changeLanguage,canInteract:()=>!paying});
creatorTools=installCreators({app,getState:()=>s,render,persist,toast,go,checkpoint:()=>studioTools.checkpoint(),select:id=>ui.selected=id});
installBeautifier({app,getDesign:()=>s.design,getModel:()=>s.model,onApply:d=>{studioTools.checkpoint();s.design=d;ui.selected=null;persist();render();},toast});
socialTools=installSocial({getState:()=>s,render,persist,toast,account,use:id=>creatorTools.use(id)});
try{await hydratePaymentLedger(s);}catch{toast(tr('本机交易记录暂不可用，请刷新后重试','Local transaction records are unavailable. Refresh and try again.'));}
render();persist();
