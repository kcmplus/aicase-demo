import {demoFetch} from './demo/api.js';
import {registerImageVariants} from './image-view.js';
// Bundled defaults support standalone rule tests and legacy saved renders.
// The browser loads the server catalog before offering new orders.
export const bundledStyles=[
 {id:'anime',name:'Anime portrait',tag:'Illustrated',description:'Expressive eyes, clean linework and a hand-painted world.',image:'./assets/ai-styles/anime.png'},
 {id:'realism',name:'Cinematic realism',tag:'Photographic',description:'Natural detail, beautiful light and an editorial finish.',image:'./assets/ai-styles/realism.png'},
 {id:'3d',name:'3D character',tag:'Playful',description:'A sculpted character with soft materials and studio lighting.',image:'./assets/ai-styles/3d.png'},
];
export const bundledExamples=[
 {id:'portrait',name:'Portrait',subject:'Seaside portrait',original:'./assets/ai-styles/original.png',origin:'popomo-portrait-v1',results:{anime:'./assets/ai-styles/anime.png',realism:'./assets/ai-styles/realism.png','3d':'./assets/ai-styles/3d.png'}},
 ...[['pets','Pets','A little best friend'],['couples','Couples','Better together'],['travel','Travel','Somewhere worth keeping']].map(([id,name,subject])=>({id,name,subject,original:`./assets/ai-styles/${id}-original.png`,origin:`popomo-${id}-v1`,results:Object.fromEntries(['anime','realism','3d'].map(style=>[style,`./assets/ai-styles/${id}-${style}.png`]))})),
];
export const aiStyles=structuredClone(bundledStyles),aiExamples=structuredClone(bundledExamples);
export let PRINT_PRICE_CENTS=1000,PRINT_PRICE='$10.00',PRINT_AVAILABLE=true;
export let AI_MONTHLY_CENTS=990,AI_MONTHLY_PRICE='$9.90',AI_MONTHLY_LIMIT=20,AI_TRIAL_LIMIT=1,AI_AVAILABLE=true;
export let catalogStatus='demo';
export let AI_GENERATION_CONNECTED=false;
export let AI_PROVIDER='openai';
export const money=cents=>'$'+(cents/100).toFixed(2);
export const safeAssetPath=value=>typeof value==='string'&&/^\.?\/(?:assets|media)\/[a-zA-Z0-9_/-]+\.(?:svg|png|jpg|jpeg|webp)$/.test(value);
const code=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(value);
const label=value=>typeof value==='string'&&value.length>0&&value.length<=500;
const quota=value=>Number.isInteger(value)&&value>=0&&value<=2147483647;
function plan(data,kind){
 const plans=data.filter(p=>p.kind===kind&&p.active!==false);
 if(plans.length>1)throw Error('Multiple active plans');
 if(!plans.length)return null;
 const p=plans[0];
 if(p.currency!=='USD'||!/^\d{1,6}(?:\.\d{1,2})?$/.test(String(p.price))||!quota(p.monthly_credits)||!quota(p.trial_credits)||(kind==='ai_monthly'&&p.monthly_credits<1))throw Error('Invalid plan');
 return {...p,cents:Math.round(Number(p.price)*100)};
}
export function applyCatalog(data){
 if(data?.version!==2||!['plans','ai_styles','ai_examples'].every(key=>Array.isArray(data[key])))throw Error('Invalid catalog');
 const print=plan(data.plans,'print'),ai=plan(data.plans,'ai_monthly');
 const signupCredits=data.signupCredits??ai?.trial_credits??0;
 if(!quota(signupCredits))throw Error('Invalid signup credits');
 const styles=data.ai_styles.map(s=>{
  if(!code(s.code)||!label(s.name)||!safeAssetPath(s.image_path))throw Error('Invalid AI style');
  return {id:s.code,name:s.name,name_zh:typeof s.name_zh==='string'?s.name_zh:'',description:s.description||'',description_zh:typeof s.description_zh==='string'?s.description_zh:'',image:s.image_path,tag:'AI style'};
 });
 if(new Set(styles.map(s=>s.id)).size!==styles.length)throw Error('Duplicate style');
 const examples=data.ai_examples.map(e=>{
  if(!code(e.code)||!label(e.name)||!label(e.subject)||!safeAssetPath(e.original_path)||!Array.isArray(e.results))throw Error('Invalid AI example');
  const results=Object.create(null);
  for(const r of e.results){
   if(!styles.some(s=>s.id===r.style_code)||!safeAssetPath(r.image_path)||Object.hasOwn(results,r.style_code))throw Error('Invalid AI result');
   results[r.style_code]=r.image_path;
  }
  return {id:e.code,name:e.name,name_zh:typeof e.name_zh==='string'?e.name_zh:'',subject:e.subject,subject_zh:typeof e.subject_zh==='string'?e.subject_zh:'',original:e.original_path,origin:`popomo-${e.code}-v1`,results};
 }).filter(e=>Object.keys(e.results).length);
 if(new Set(examples.map(e=>e.id)).size!==examples.length)throw Error('Duplicate example');
 registerImageVariants(data.image_variants);
 AI_PROVIDER=data.ai_provider==='ai778'?'ai778':'openai';
 AI_GENERATION_CONNECTED=data.ai_generation_connected===true;
 PRINT_AVAILABLE=!!print;PRINT_PRICE_CENTS=print?.cents??0;PRINT_PRICE=print?money(print.cents):'Unavailable';
 AI_AVAILABLE=!!ai;AI_MONTHLY_CENTS=ai?.cents??0;AI_MONTHLY_PRICE=ai?money(ai.cents):'Unavailable';AI_MONTHLY_LIMIT=ai?.monthly_credits??0;AI_TRIAL_LIMIT=signupCredits;
 aiStyles.splice(0,aiStyles.length,...styles);aiExamples.splice(0,aiExamples.length,...examples);catalogStatus='ready';
}
export function unavailableCatalog(){
 AI_GENERATION_CONNECTED=false;
 PRINT_AVAILABLE=false;AI_AVAILABLE=false;PRINT_PRICE='Unavailable';AI_MONTHLY_PRICE='Unavailable';AI_TRIAL_LIMIT=0;
 aiStyles.splice(0);aiExamples.splice(0);catalogStatus='unavailable';
}
export async function loadCatalog(fetcher=demoFetch){
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetcher('/api/v1/catalog/',{cache:'no-store',credentials:'omit',signal:controller.signal});if(!response.ok)throw Error('Catalog unavailable');applyCatalog(await response.json());return true;}
 catch{unavailableCatalog();return false;}
 finally{clearTimeout(timer);}
}
