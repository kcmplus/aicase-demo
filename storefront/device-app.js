import {brandLogo,icon,phone,esc} from './art.js';
import {makePersonalDesign} from './simple-personalize.js';
import {create as createQR} from './vendor/qr.js';
import {DeviceError,normalizeScan,assertPrintable,readDeviceSession,phoneDesignUrl} from './device-core.js';
import {createDeviceClient} from './device-service.js';

const query=new URLSearchParams(location.search),config=window.POPOMO_DEVICE_CONFIG||{};
const mode=query.get('mode')||config.mode||'demo',stationId=query.get('station')||config.stationId||'DEMO-01';
let lang=query.get('lang')==='zh-CN'?'zh-CN':'en-US';
const root=document.querySelector('#device-app'),dialog=document.querySelector('#device-dialog');
const sessionKey=`popomo-demo-device-session-v1:${mode}:${stationId}`;
let sessionStorageSafe;try{sessionStorageSafe=window.sessionStorage;}catch{}
const client=createDeviceClient({mode,stationId,adapter:window.POPOMO_DEVICE_ADAPTER,storage:sessionStorageSafe});
let view='loading',station=null,order=null,job=null,busy=false,accepted=false,errorCode='',errorAction='code',startIntent=null,polling=false,connectionLost=false;
let queueState=null,queueLost=false,queueRequest=0;
let lastActivity=Date.now(),completedAt=0,epoch=0,dialogKind='',entryCode='POP-C-';
const words={
 'PRINT QUEUE':'打印队列','Waiting':'排队中','No one waiting':'当前无人排队','Queue unavailable':'队列暂不可用','Now printing':'正在打印','Please confirm':'请确认','Up next':'即将轮到','NOW CALLING':'现在叫号','Your turn.':'轮到你了。','Match this number with your phone, then review your design.':'核对手机上的排队号，再确认你的设计。','Review & print':'核对并打印','Let next customer go first':'让下一位先来','Ready when you are.':'准备好迎接你的设计。','Scan below to start on your phone.':'用手机扫描下方二维码开始设计。','Scan to design & join':'扫码设计 · 加入排队','Design while others wait or print.':'排队或打印时，也能继续扫码设计。','Your number stays in the queue.':'你的号码仍保留在队列中。','Demo: add order':'演示：加入一单','Queue preview · Phone push not connected':'队列演示 · 手机推单尚未接入','Back to queue':'返回队列','Check your design':'核对你的设计','Call changes in':'叫号切换剩余','Queue paused while reconnecting.':'队列连接中，请稍候。','Please wait for your number to be called.':'请等待叫到你的号码。','The queue is full. Please try again later.':'队列已满，请稍后再试。','More waiting':'更多排队订单','Please collect before the next print.':'请先取件，设备再开始下一单。',

 '01 / CODE':'01 / 设计码','02 / CONFIRM':'02 / 确认','03 / MAKE':'03 / 制作','READY FOR YOU':'等待你来领取','LET’S SORT THIS OUT':'我们来处理一下',
 'Scan to design your case, then enter your design code here to print.':'用手机扫码设计手机壳，完成后在这里输入设计码打印。','Print station':'打印站','Ready for your design':'准备好迎接你的设计','Station unavailable':'设备暂不可用','Your design.':'你的设计，','Made right here.':'即刻成真。','Design on your phone. Enter your code here. We’ll print it for you.':'手机上完成设计，在这里输入设计码，即可打印。','Enter my design code':'输入我的设计码','Create on my phone':'在手机上开始设计','Design on your phone':'手机上设计','Enter your code here':'在设备输入设计码','Collect your new case':'领取专属手机壳','Need a hand?':'需要帮助？','Touch to get started':'轻触屏幕，开始制作','Interactive preview · No printer connected':'交互预览 · 未连接打印设备','Try a sample order':'体验示例订单','Back':'返回','Checking your design…':'正在查找你的设计…','Make sure it’s yours.':'确认这是你的设计。','Check the phone model and artwork before we print.':'打印前，请核对手机型号和图案。','Phone model':'手机型号','Your design':'你的设计','Already paid':'已支付','No payment needed here.':'设备端无需再次付款。','This is my phone model and design.':'我确认手机型号和图案无误。','Print my case':'开始打印','Use another code':'换一个设计码','Preparing your print':'正在准备打印','Printing your case':'正在打印手机壳','Finishing touches':'正在完成最后工序','Your case is taking shape.':'你的手机壳，正在成形。','Please stay nearby. We’ll let you know when it’s ready.':'请在设备附近稍候，完成后这里会提示取件。','Preparing':'准备','Printing':'打印','Finishing':'完成工序','Ready to collect':'可以取件了','Made for you.':'为你而制。','Collect your case from the pickup tray.':'请从设备取件口取出你的手机壳。','I’ve collected my case':'我已取走手机壳','Enjoy your little masterpiece.':'带上你的小小杰作。','Thanks for making it yours.':'谢谢你，让它成为你的专属。','Back to start':'返回首页','Next customer in':'即将返回首页','seconds':'秒','Reconnecting to your print…':'正在重新连接打印任务…','We’re checking the printer. Your job has not been restarted.':'正在确认设备状态，不会重新发起打印。','Check print status':'查询打印状态','Please ask a staff member for help. Keep your design code ready.':'请联系现场工作人员，并保留好你的设计码。','Your paid order is not cancelled by leaving this screen.':'离开此页面不会取消你的已付款订单。','Got it':'知道了','Scan with your phone.':'用手机扫描屏幕二维码。','Use your phone to scan this screen. After designing, enter your design code at this station.':'用手机扫描屏幕上的二维码。完成设计后，在设备上输入你的设计码。','Open design page':'打开设计页面','Local preview link — available on this computer.':'本地预览链接，仅当前电脑可打开。','Ask a staff member for the design link.':'请向工作人员获取设计页面链接。','Enter your design code':'输入你的设计码','Use the latest POP-C- code from “My design”.':'请输入“我的设计”中最新的 POP-C- 开头设计码。','Find my design':'查找我的设计','Clear':'清空','Delete last character':'删除最后一位','Close':'关闭','Still here?':'还在这里吗？','We’ll clear this screen for the next customer soon.':'即将清空当前画面，迎接下一位顾客。','Keep my place':'继续操作','End this session':'结束本次操作','Try again':'重试','Checking the station…':'正在检查设备…','Something needs attention.':'需要处理一下。','Code not found':'未找到设计码','Check the latest design code in “My design” on your phone, then try again.':'请核对手机“我的设计”中最新的设计码后重试。','Finish your order on your phone.':'请先在手机上完成订单。','This order has already been collected.':'该订单已取件，无法重复打印。','This design code has been replaced. Use the newest code on your phone.':'该设计码已更新，请使用手机上的最新设计码。','This order was cancelled. Choose another design code.':'该订单已取消，请更换设计码。','This case is not available here right now.':'当前设备暂时没有这个机型的手机壳。','This station is serving another customer. Please wait a moment.':'设备正在为另一位顾客服务，请稍候。','This station is taking a break. Please ask a staff member.':'设备暂时无法服务，请联系工作人员。','We couldn’t reach the station. Please try again.':'暂时无法连接设备，请重试。','Your print needs assistance. Please ask a staff member.':'打印任务需要协助，请联系工作人员。','This station is not connected yet. Please ask a staff member.':'此设备尚未连接服务，请联系工作人员。','The station returned an incomplete response. Please ask a staff member.':'设备返回的信息不完整，请联系工作人员。','Please confirm your phone model first.':'请先确认你的手机型号。','Could not keep this session. Please ask a staff member.':'无法保存当前会话，请联系工作人员。'
};
const t=value=>lang==='zh-CN'?(words[value]||value):value;
const errorCopy={QUEUE_TURN:'Please wait for your number to be called.',QUEUE_FULL:'The queue is full. Please try again later.',INVALID_CODE:'Check the latest design code in “My design” on your phone, then try again.',NOT_FOUND:'Check the latest design code in “My design” on your phone, then try again.',UNPAID:'Finish your order on your phone.',ALREADY_COLLECTED:'This order has already been collected.',REPLACED:'This design code has been replaced. Use the newest code on your phone.',CANCELLED:'This order was cancelled. Choose another design code.',OUT_OF_STOCK:'This case is not available here right now.',BUSY:'This station is serving another customer. Please wait a moment.',ALREADY_STARTED:'This station is serving another customer. Please wait a moment.',OFFLINE:'This station is taking a break. Please ask a staff member.',CONNECTION:'We couldn’t reach the station. Please try again.',DEVICE_ERROR:'Your print needs assistance. Please ask a staff member.',NOT_CONNECTED:'This station is not connected yet. Please ask a staff member.',INVALID_RESPONSE:'The station returned an incomplete response. Please ask a staff member.',STORAGE:'Could not keep this session. Please ask a staff member.'};
const text=value=>esc(t(value));
const money=o=>new Intl.NumberFormat(lang,{style:'currency',currency:o.currency}).format(o.amountCents/100);
const caseHTML=pass=>phone(makePersonalDesign(pass),pass.model).replace(/aria-label="[^"]*设计预览"/,`aria-label="${esc(pass.model)} ${text('Your design')}"`).replace('alt="你上传的设计照片"',`alt="${text('Your design')}"`);
const action=(name,label,kind='primary',disabled=false)=>`<button type="button" class="device-button ${kind}" data-action="${name}" ${disabled?'disabled':''}>${text(label)} ${icon('arrow',24)}</button>`;
function persist(value){try{if(value)sessionStorageSafe.setItem(sessionKey,JSON.stringify(value));else sessionStorageSafe?.removeItem(sessionKey);}catch{throw new DeviceError('STORAGE');}}
function say(value){document.querySelector('#device-notice').textContent=t(value);}
function setError(error,action='code'){errorCode=error?.code||'CONNECTION';errorAction=action;view='error';accepted=false;render();}
function top(){return `<header class="device-header"><div class="device-brand">${brandLogo()}<span class="device-brand-label">${text('Print station')}</span></div><label class="device-language"><span class="sr-only">Language / 语言</span><select id="device-language" aria-label="Language / 语言"><option value="en-US" ${lang==='en-US'?'selected':''}>English</option><option value="zh-CN" ${lang==='zh-CN'?'selected':''}>中文</option></select></label></header><div class="device-station"><span><i class="${station?.status==='ready'&&!job&&!startIntent?'':'muted'}"></i>${text(job||view==='completed'?'Print station':station?.status==='ready'?'Ready for your design':'Station unavailable')}</span><span>${esc(stationId)}</span></div>`;}
const headTicket=()=>queueState?.items[0];
const currentTicket=()=>queueState?.items.find(item=>item.orderId===(order?.id||job?.order.id))?.ticket||headTicket()?.ticket||'';
function queueBoard(){
 const items=queueState?.items||[],waiting=items.filter(item=>['waiting','awaiting_confirmation'].includes(item.status)).length;
 const labels={waiting:'Up next',awaiting_confirmation:'Please confirm',printing:'Now printing',ready:'Ready to collect'};
 return `<section class="device-queue-board" aria-label="${text('PRINT QUEUE')}"><div class="device-queue-heading"><h2>${text('PRINT QUEUE')}</h2><span>${queueLost||!queueState?'—':waiting} ${text('Waiting')}</span></div>${items.length?`<ol class="device-queue-strip">${items.slice(0,3).map((item,i)=>`<li class="${i===0?'current-ticket':''}"><strong>${esc(item.ticket)}</strong><span>${text(labels[item.status])}</span>${item.status==='printing'?'<i class="queue-print-indicator"></i>':''}</li>`).join('')}${items.length>3?`<li class="queue-more"><strong>+${items.length-3}</strong><span>${text('More waiting')}</span></li>`:''}</ol>`:`<p class="device-queue-empty">${text(queueLost||!queueState?'Queue unavailable':'No one waiting')}</p>`}<p class="device-queue-connection" ${queueLost?'':'hidden'}>${text('Queue paused while reconnecting.')}</p></section>`;
}
function joinPanel(){
 const url=phoneDesignUrl(config.storefrontUrl||new URL(`./?lang=${lang}`,location.href).href,location.origin,stationId);
 const local=url&&/^(localhost|127\.0\.0\.1|\[::1\])$/.test(new URL(url).hostname),allowed=url&&(!local||client.isDemo);
 return `<aside class="device-join" aria-label="${text('Scan with your phone.')}"><div class="device-join-code">${allowed?qr(url):`<p>${text('Ask a staff member for the design link.')}</p>`}</div><div class="device-join-copy"><span class="device-join-kicker">${icon('phone',17)} POPOMO</span><h2>${text('Scan to design & join')}</h2><p>${text('Design while others wait or print.')}</p>${local?`<a href="${esc(url)}" target="_blank" rel="noopener">${text('Open design page')} ${icon('arrow',15)}</a><small>${text('Local preview link — available on this computer.')}</small>`:''}${!job&&!startIntent?`<button data-action="code" ${busy?'disabled':''}>${text('Enter my design code')} →</button>`:''}</div></aside>`;
}
function welcome(){
 const head=headTicket(),called=head?.status==='awaiting_confirmation';
 return `<section class="device-screen queue-welcome"><div class="device-call-copy"><p class="device-eyebrow">${text(called?'NOW CALLING':'Print station')}</p>${called?`<strong class="device-call-number">${esc(head.ticket)}</strong>`:`<span class="device-idle-spark" aria-hidden="true">✦</span>`}<h1>${text(called?'Your turn.':'Ready when you are.')}</h1><p>${text(called?'Match this number with your phone, then review your design.':'Scan below to start on your phone.')}</p></div>${called?`<div class="device-action-dock">${action('review','Review & print','primary',busy||queueLost)}${queueState.items.length>1?`<button class="device-text-button" data-action="defer" ${busy||queueLost?'disabled':''}>${text('Let next customer go first')}</button>`:''}<p class="device-call-countdown" ${queueState.confirmBy?'':'hidden'}>${text('Call changes in')} <span id="queue-countdown">${Math.max(0,Math.ceil((queueState.confirmBy-Date.now())/1000))}</span>s</p></div>`:''}</section>`;
}
function codeEntry(){return `<section class="device-screen code-screen"><div class="device-heading"><p class="device-eyebrow">${text('01 / CODE')}</p><h1>${text('Enter your design code')}</h1><p>${text('Use the latest POP-C- code from “My design”.')}</p></div><form id="device-code-form"><div class="device-entry-fields"><label for="device-code" class="sr-only">${text('Enter your design code')}</label><div class="device-code-input-row"><input id="device-code" name="code" inputmode="none" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="64" placeholder="POP-C-…" value="${esc(entryCode)}" ${busy?'disabled':''} required><button type="button" data-key="clear" class="key-clear" ${busy?'disabled':''}>${text('Clear')}</button><button type="button" data-key="delete" class="key-delete" aria-label="${text('Delete last character')}" ${busy?'disabled':''}>⌫</button></div><div class="device-keypad">${'123A456B789C0DEF'.split('').map(k=>`<button type="button" data-key="${k}" ${busy?'disabled':''}>${k}</button>`).join('')}</div></div><div class="device-action-dock"><button class="device-button primary" type="submit" ${busy?'disabled':''}>${text(busy?'Checking your design…':'Find my design')}${icon('arrow',22)}</button><button type="button" class="device-text-button" data-action="home" ${busy?'disabled':''}>${icon('back',19)}${text('Back')}</button></div></form></section>`;}
function confirm(){const p=order.snapshot;return `<section class="device-screen confirm-screen"><div class="device-heading"><p class="device-eyebrow">${esc(currentTicket())} · ${text('Please confirm')}</p><h1>${text('Check your design')}</h1></div><div class="device-confirm-summary"><div class="device-order-case">${caseHTML(p)}</div><div><span>${text('Phone model')}</span><strong>${esc(p.model)}</strong><p>${text('Already paid')} · ${money(order)}</p><small>${text('No payment needed here.')}</small></div></div><div class="device-action-dock"><label class="device-confirm-check"><input id="device-confirm" type="checkbox" ${accepted?'checked':''} ${busy?'disabled':''}><span>${text('This is my phone model and design.')}</span></label>${action('print',busy?'Preparing your print':'Print my case','primary',!accepted||busy||queueLost)}<button class="device-text-button" data-action="queue-home" ${busy?'disabled':''}>${text('Back to queue')}</button></div></section>`;}
function printing(){return `<section class="device-screen printing-screen"><div class="device-heading"><p class="device-eyebrow">${esc(currentTicket())} · ${text('Now printing')}</p><h1>${text('Your case is taking shape.')}</h1><p>${text('Please stay nearby. We’ll let you know when it’s ready.')}</p></div><div class="device-print-scene"><div class="print-glow"></div><div class="printing-case">${caseHTML(order.snapshot)}</div><div class="print-beam"></div><span class="print-model">${esc(order.snapshot.model)}</span></div><div class="device-progress-panel"><div class="device-progress-heading"><h2 id="device-phase">${text({preparing:'Preparing your print',printing:'Printing your case',finishing:'Finishing touches'}[job.phase])}</h2><span id="device-percent">${job.progress===null?'':Math.round(job.progress)+'%'}</span></div><div class="device-progress-track ${job.progress===null?'indeterminate':''}" role="progressbar" aria-label="${text('Printing')}" ${job.progress===null?'':`aria-valuenow="${Math.round(job.progress)}"`} aria-valuemin="0" aria-valuemax="100"><span style="width:${job.progress??25}%"></span></div><ol class="device-print-steps">${['preparing','printing','finishing'].map((phase,i)=>`<li class="${['preparing','printing','finishing'].indexOf(job.phase)>=i?'active':''}"><i>${i+1}</i>${text(['Preparing','Printing','Finishing'][i])}</li>`).join('')}</ol></div><p class="device-connection" id="device-connection" role="status" ${connectionLost?'':'hidden'}>${text('We’re checking the printer. Your job has not been restarted.')}</p></section>`;}
function ready(){return `<section class="device-screen ready-screen"><div class="device-heading"><span class="device-success-mark">${icon('check',32)}</span><p class="device-eyebrow">${esc(currentTicket())} · ${text('Ready to collect')}</p><h1>${text('Made for you.')}</h1><p>${text('Collect your case from the pickup tray.')}</p></div><div class="device-pickup-scene"><div class="pickup-case">${caseHTML(order.snapshot)}</div><div class="pickup-slot"><span></span></div><span class="pickup-arrow">↓</span></div><div class="device-ready-model">${icon('phone',22)}${esc(order.snapshot.model)}<span>${text('Ready to collect')}</span></div><div class="device-action-dock">${action('collect','I’ve collected my case','primary',busy)}</div></section>`;}
function completed(){return `<section class="device-screen completed-screen"><div class="device-thanks-art" aria-hidden="true"><span>✦</span>${icon('heart',130)}<i>✳</i></div><div class="device-heading"><h1>${text('Enjoy your little masterpiece.')}</h1><p>${text('Thanks for making it yours.')}</p></div><div class="device-action-dock">${action('home','Back to start')}<p class="device-return-note">${text('Next customer in')} <strong id="device-return-seconds">8</strong> ${text('seconds')}</p></div></section>`;}
function errorView(){const uncertain=Boolean(startIntent||job);return `<section class="device-screen error-screen"><div class="device-error-symbol">${icon('clock',54)}</div><div class="device-heading"><p class="device-eyebrow">${text('LET’S SORT THIS OUT')}</p><h1>${text(['INVALID_CODE','NOT_FOUND'].includes(errorCode)?'Code not found':'Something needs attention.')}</h1><p>${text(errorCopy[errorCode]||errorCopy.CONNECTION)}</p>${uncertain?`<p>${text('We’re checking the printer. Your job has not been restarted.')}</p>`:''}</div><div class="device-action-dock">${action('retry',uncertain?'Check print status':errorAction==='connect'?'Try again':'Use another code','primary',busy)}<button class="device-text-button" data-action="help">${text('Need a hand?')}</button></div></section>`;}
function render(){
 const focus=document.activeElement?.id;
 document.documentElement.lang=lang;document.title='POPOMO · '+t('Print station');
 root.classList.add('queue-layout');
 root.innerHTML=top()+queueBoard()+`<main class="device-workspace">`+({welcome,code:codeEntry,confirm,printing,ready,completed,error:errorView}[view]?.()||`<section class="device-screen loading-screen"><i class="device-loading"></i><p>${text('Checking the station…')}</p></section>`)+`</main>`+joinPanel()+`<footer class="device-footer"><button class="device-help" data-action="help">? <span>${text('Need a hand?')}</span></button>${client.isDemo?`<div class="device-preview-badge"><span>${text('Queue preview · Phone push not connected')}</span><button data-action="sample" ${busy?'disabled':''}>${text('Demo: add order')} +</button></div>`:'<span>POPOMO · A little more you.</span>'}</footer>`;
 root.setAttribute('aria-busy',String(busy));if(focus)document.getElementById(focus)?.focus({preventScroll:true});
}
function updateProgress(){
 const bar=document.querySelector('.device-progress-track'),percent=document.querySelector('#device-percent');
 if(bar){bar.classList.toggle('indeterminate',job.progress===null);if(job.progress!==null)bar.setAttribute('aria-valuenow',Math.round(job.progress));else bar.removeAttribute('aria-valuenow');bar.firstElementChild.style.width=(job.progress??25)+'%';}
 if(percent)percent.textContent=job.progress===null?'':Math.round(job.progress)+'%';
 const note=document.querySelector('#device-connection');if(note)note.hidden=!connectionLost;
}
function closeDialog(){dialog.close();dialog.innerHTML='';dialogKind='';lastActivity=Date.now();}
function reset(){epoch++;closeDialog();order=null;job=null;startIntent=null;accepted=false;entryCode='POP-C-';errorCode='';connectionLost=false;completedAt=0;busy=false;persist(null);view='welcome';lastActivity=Date.now();void boot();}
function acceptJob(next){
 job=next;order=next.order;startIntent=null;connectionLost=false;
 if(next.status==='completed'){persist(null);order=null;job=null;completedAt=Date.now();view='completed';}
 else{persist({kind:'job',jobId:next.id});view=next.status==='error'?'error':next.status;if(next.status==='error'){errorCode='DEVICE_ERROR';errorAction='job';}}
 render();
}
async function boot(){
 if(!/^[a-zA-Z0-9_-]{1,80}$/.test(stationId)){setError(new DeviceError('NOT_CONNECTED'),'connect');return;}
 busy=true;view='loading';render();
 try{
  station=await client.connect();if(client.supportsQueue)applyQueue(await client.getQueue());else queueLost=true;const saved=readDeviceSession(sessionStorageSafe,sessionKey);
  if(saved?.kind==='start'){startIntent=saved;order=await client.lookup(saved.code);if(order.jobId)acceptJob(await client.getJob(order.jobId));else setError(new DeviceError('CONNECTION'),'start');}
  else if(saved?.kind==='job'||station.activeJobId)acceptJob(await client.getJob(saved?.jobId||station.activeJobId));
  else if(station.status!=='ready')throw new DeviceError(station.status==='busy'?'BUSY':'OFFLINE');
  else view='welcome';
 }catch(error){setError(error,'connect');}
 finally{busy=false;render();}
}
async function lookup(raw){
 if(busy||!['welcome','code','error'].includes(view)||job||startIntent)return;
 const current=++epoch;busy=true;view='code';closeDialog();render();
 try{
  const code=normalizeScan(raw);station=await client.connect();const found=await client.lookup(code);if(current!==epoch)return;
  if(['printing','ready'].includes(found.status)&&found.jobId){acceptJob(await client.getJob(found.jobId));return;}
  applyQueue(await client.enqueue(code));order=null;accepted=false;view='welcome';lastActivity=Date.now();
 }catch(error){if(current===epoch)setError(error);}
 finally{if(current===epoch){busy=false;render();}}
}
async function start(){
 if(busy||(!startIntent&&(!order||!accepted)))return;
 busy=true;render();
 try{
  if(!startIntent){applyQueue(await client.getQueue());if(headTicket()?.orderId!==order?.id||queueLost)throw new DeviceError('QUEUE_TURN');station=await client.connect();assertPrintable(order,station);const intent={kind:'start',orderId:order.id,revision:order.revision,code:order.snapshot.code,idempotencyKey:crypto.randomUUID()};persist(intent);startIntent=intent;}
  const {kind,...request}=startIntent;acceptJob(await client.start(request));await refreshQueue();
 }catch(error){setError(error,startIntent?'start':'code');}
 finally{busy=false;render();}
}
async function collect(){
 if(busy||job?.status!=='ready')return;busy=true;render();
 try{acceptJob(await client.collect(job.id));await refreshQueue();}catch(error){setError(error,'job');}finally{busy=false;render();}
}
function applyQueue(next){
 queueRequest++;queueState=next;queueLost=false;
 if(view==='confirm'&&!startIntent&&next.items[0]?.orderId!==order?.id){order=null;accepted=false;view='welcome';}
}
async function refreshQueue(){
 if(!client.supportsQueue){queueLost=true;return;}
 const sequence=++queueRequest;
 try{const next=await client.getQueue();if(sequence!==queueRequest)return;const changed=queueLost||JSON.stringify(next)!==JSON.stringify(queueState);applyQueue(next);if(changed)render();}
 catch{if(sequence===queueRequest&&!queueLost){queueLost=true;render();}}
}
async function poll(){
 if(polling||busy)return;
 polling=true;
 try{
  if(job&&['printing','ready'].includes(view)){
   const id=job.id;
   try{const next=await client.getJob(id);if(job?.id!==id)return;const changed=next.status!==job.status||next.phase!==job.phase;connectionLost=false;if(changed)acceptJob(next);else{job=next;updateProgress();}}
   catch{connectionLost=true;updateProgress();}
  }
  await refreshQueue();
 }finally{polling=false;}
}
async function addSample(){
 if(busy)return;busy=true;render();
 try{applyQueue(await client.enqueueSample());}catch(error){say(errorCopy[error.code]||errorCopy.CONNECTION);}
 finally{busy=false;render();}
}
async function reviewHead(){
 if(busy||job||startIntent||queueLost)return;
 busy=true;render();
 try{applyQueue(await client.getQueue());const head=headTicket();if(head?.status!=='awaiting_confirmation')throw new DeviceError('QUEUE_TURN');station=await client.connect();order=await client.lookup(head.code);assertPrintable(order,station);accepted=false;view='confirm';lastActivity=Date.now();}
 catch(error){setError(error);}
 finally{busy=false;render();}
}
async function deferHead(){
 if(busy||job||startIntent||queueLost)return;busy=true;render();
 try{applyQueue(await client.defer(headTicket().code));order=null;accepted=false;view='welcome';}catch(error){setError(error);}
 finally{busy=false;render();}
}
function qr(url){const matrix=createQR(url,{errorCorrectionLevel:'M'}).modules;let path='';for(let y=0;y<matrix.size;y++)for(let x=0;x<matrix.size;x++)if(matrix.get(y,x))path+=`M${x+4} ${y+4}h1v1h-1z`;const size=matrix.size+8;return `<svg viewBox="0 0 ${size} ${size}" role="img" aria-label="${text('Scan with your phone.')}"><rect width="100%" height="100%" fill="white"/><path d="${path}" fill="#203f36"/></svg>`;}
function openDialog(kind){
 if(busy)return;dialogKind=kind;if(kind!=='idle')lastActivity=Date.now();
 const header=`<button class="device-dialog-close" data-action="close-dialog" aria-label="${text('Close')}">${icon('close',24)}</button>`;
 if(kind==='help')dialog.innerHTML=header+`<span class="device-dialog-symbol">?</span><h2>${text('Need a hand?')}</h2><p>${text('Please ask a staff member for help. Keep your design code ready.')}</p><p class="device-support-id">${esc(stationId)}${job?'<br>'+esc(job.id):''}</p><p>${text('Your paid order is not cancelled by leaving this screen.')}</p>${action('close-dialog','Got it')}`;
 if(kind==='idle')dialog.innerHTML=`<span class="device-dialog-symbol">${icon('clock',34)}</span><h2>${text('Still here?')}</h2><p>${text('We’ll clear this screen for the next customer soon.')}</p><strong class="device-idle-counter" id="idle-seconds">20</strong>${action('close-dialog','Keep my place')}<button class="device-text-button" data-action="home">${text('End this session')}</button>`;
 if(!dialog.open)dialog.show();
}
document.addEventListener('click',async event=>{
 const key=event.target.closest('[data-key]');if(key){if(busy)return;const input=document.querySelector('#device-code');if(!input)return;const k=key.dataset.key;input.value=k==='clear'?'POP-C-':k==='delete'?input.value.slice(0,-1):input.value.length<22?input.value+k:input.value;if(input.value.length<6)input.value='POP-C-';entryCode=input.value;return;}
 const target=event.target.closest('[data-action]');if(!target||target.disabled||busy)return;
 const a=target.dataset.action;
 if(a==='close-dialog'){closeDialog();return;}
 if(a==='help'){openDialog(a);return;}
 if((a==='code'||a==='change-code')&&!job&&!startIntent){order=null;accepted=false;entryCode='POP-C-';view='code';lastActivity=Date.now();render();return;}
 if(a==='home'){reset();return;}
 if(a==='sample'){await addSample();return;}
 if(a==='review'){await reviewHead();return;}
 if(a==='defer'){await deferHead();return;}
 if(a==='queue-home'){order=null;accepted=false;view='welcome';render();return;}
 if(a==='print'){await start();return;}
 if(a==='collect'){await collect();return;}
 if(a==='retry'){
  if(startIntent){await start();return;}
  if(job){busy=true;render();try{acceptJob(await client.getJob(job.id));}catch(e){setError(e,'job');}finally{busy=false;render();}return;}
  if(errorAction==='connect'){await boot();return;}
  view='code';order=null;render();
 }
});
document.addEventListener('submit',event=>{if(event.target.id==='device-code-form'){event.preventDefault();void lookup(new FormData(event.target).get('code'));}});
document.addEventListener('input',event=>{if(event.target.id==='device-code')entryCode=event.target.value;});
document.addEventListener('change',event=>{
 if(event.target.id==='device-confirm'){accepted=event.target.checked;document.querySelector('[data-action=print]').disabled=!accepted||busy||queueLost;}
 if(event.target.id==='device-language'){lang=event.target.value;const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url);render();}
});
dialog.addEventListener('cancel',event=>{event.preventDefault();closeDialog();});
for(const type of ['pointerdown','keydown'])document.addEventListener(type,()=>{if(dialogKind!=='idle')lastActivity=Date.now();});
setInterval(()=>{
 void poll();
 const countdown=document.querySelector('#queue-countdown');if(countdown&&queueState?.confirmBy)countdown.textContent=Math.max(0,Math.ceil((queueState.confirmBy-Date.now())/1000));
 if(view==='completed'){
  const seconds=Math.max(0,8-Math.floor((Date.now()-completedAt)/1000));const el=document.querySelector('#device-return-seconds');if(el)el.textContent=seconds;if(!seconds)reset();
 }else if(!busy&&!job&&!startIntent&&['code','confirm','error'].includes(view)){
  const elapsed=Date.now()-lastActivity;if(elapsed>=120000)reset();else if(elapsed>=100000&&!dialog.open)openDialog('idle');
  if(dialogKind==='idle'){const el=document.querySelector('#idle-seconds');if(el)el.textContent=Math.max(0,Math.ceil((120000-elapsed)/1000));}
 }
},1000);
await boot();
