import {clearDemoStorage} from '../simple-storage.js';
const bar=document.createElement('aside');
bar.setAttribute('aria-label','Demo controls');
bar.style.cssText='position:relative;z-index:1000;padding:9px 16px;background:#253d3b;color:white;font:12px/1.5 system-ui;display:flex;gap:12px;align-items:center;flex-wrap:wrap';
bar.innerHTML='<strong>DEMO · 独立前端</strong><span>数据仅保存在此浏览器 · 登录验证码 123456 · AI 使用预置样片，不处理上传照片</span><button type="button" style="margin-left:auto;cursor:pointer;border:1px solid #fff8;border-radius:6px;background:transparent;color:white;padding:5px 10px">重置演示</button>';
document.body.prepend(bar);
bar.querySelector('button').onclick=async()=>{
 if(!confirm('清空此演示项目的订单、照片、账号和编辑草稿？'))return;
 for(const key of Object.keys(localStorage))if(key.startsWith('popomo-demo-'))localStorage.removeItem(key);
 try{
  for(const key of Object.keys(sessionStorage))if(key.startsWith('popomo-demo-'))sessionStorage.removeItem(key);
  await clearDemoStorage();location.replace(location.pathname);
 }catch{alert('重置失败，请关闭其他演示标签页后重试。');}
};
