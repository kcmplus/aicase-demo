import {templates,stickers,designFor} from './catalog.js';
import {addLayer} from './editor-model.js';
export const creators=[{id:'mika',zh:'Mika 花间工作室',en:'Mika Bloom Studio',bioZh:'用花朵与轻快色彩，收藏生活的小美好。',bioEn:'Flowers, playful colors, and little everyday moments.',avatar:'daisy',color:'#f8dce9'},{id:'noah',zh:'Noah 日光相册',en:'Noah Daylight',bioZh:'把自然光、远方和慢下来的时刻带在身边。',bioEn:'Keep natural light and slower moments close.',avatar:'cloud',color:'#dcefed'},{id:'popomo',zh:'POPOMO 创意小组',en:'POPOMO Creative Team',bioZh:'照片、贴纸与可编辑设计，等你自由组合。',bioEn:'Photos, stickers, and editable designs, ready to mix.',avatar:'smile',color:'#fff0cd'}];
export const demoAssignments={'studio@popomo.demo':['mika','noah','popomo'],'mika@popomo.demo':['mika'],'noah@popomo.demo':['noah']};
export const assignedCreators=s=>demoAssignments[s.account?.email]||[];
export const canCreate=s=>assignedCreators(s).length>0;
export const canPublish=s=>s.account?.email==='studio@popomo.demo';
const fail=code=>{throw Error('creator:'+code);};
const store=s=>s.creator??=( {drafts:[],published:[]} );
const owns=(s,id)=>{if(!assignedCreators(s).includes(id))fail('permission');};
export const photos=[{id:'photo-meadow',type:'photo',creatorId:'noah',zh:'午后花田',en:'Afternoon meadow',src:'./assets/creator/photo-meadow.png'},{id:'photo-coast',type:'photo',creatorId:'noah',zh:'海边慢时光',en:'Slow coastal mornings',src:'./assets/creator/photo-coast.png'}];
function seeds(){return [...photos,...stickers.map(a=>({id:'sticker-'+a.id,type:'sticker',creatorId:a.creatorId,zh:a.zh,en:a.en,src:a.src,stickerId:a.id,license:a.license})),...templates.map((t,i)=>({id:'case-'+t.id,type:'case',creatorId:creators[i%3].id,zh:t.zh,en:t.en,design:designFor(t.id),templateId:t.id}))].map(c=>({...c,version:1,status:'published',demo:true}));}
export function creatorContent(s,includeUnavailable=false){return [...seeds(),...(s.creator?.published||[]).map(c=>structuredClone(c))].filter(c=>includeUnavailable||c.status==='published');}
export const contentById=(s,id)=>creatorContent(s).find(c=>c.id===id);
export function validateDesignSources(s,d){const ids=new Set(creatorContent(s).map(c=>c.id));for(const source of [d.source,...(d.layers||[]).map(l=>l.source)])if(source?.contentId&&!ids.has(source.contentId))fail('unavailable');return true;}
export function useContent(s,id){const c=contentById(s,id);if(!c)fail('unavailable');const source={contentId:c.id,creatorId:c.creatorId,version:c.version,type:c.type};
 if(c.type==='case'){validateDesignSources(s,c.design);s.design=structuredClone(c.design);s.design.source=source;return null;}
 const layerId=addLayer(s.design,c.stickerId?'sticker':'image',c.stickerId||c.src);if(!layerId)fail('layer-limit');Object.assign(s.design.layers.at(-1),{source,labelZh:c.zh,labelEn:c.en});return layerId;
}
function validSrc(src){return typeof src==='string'&&(/^\.\/assets\/[a-z\d_./-]+\.(png|jpe?g|webp|svg)$/i.test(src)||/^data:image\/(png|jpe?g|webp);base64,[a-z\d+/=]+$/i.test(src));}
export function saveDraft(s,input){owns(s,input.creatorId);if(!['photo','sticker','case'].includes(input.type))fail('type');if(!String(input.zh||'').trim()||String(input.zh).length>60)fail('title');
 const data=store(s),old=data.drafts.find(d=>d.id===input.id);if(input.id&&!old)fail('missing');if(old&&old.creatorId!==input.creatorId)fail('permission');
 if(input.type==='case'&&old&&input.design?.source?.contentId===old.id){input={...input,design:structuredClone(input.design)};if(old.design?.source)input.design.source=structuredClone(old.design.source);else delete input.design.source;}
 if(input.type==='case'){if(!input.design||!Array.isArray(input.design.layers)||input.design.layers.length>20)fail('design');validateDesignSources(s,input.design);}else if(!validSrc(input.src))fail('asset');
 const draft={id:old?.id||'content-'+crypto.randomUUID(),creatorId:input.creatorId,type:input.type,zh:String(input.zh).trim(),en:String(input.en||input.zh).trim().slice(0,80),description:String(input.description||'').slice(0,280),status:'draft',version:old?.version||0,updatedAt:new Date().toISOString(),...(input.type==='case'?{design:structuredClone(input.design)}:{src:input.src})};
 if(old)data.drafts[data.drafts.indexOf(old)]=draft;else data.drafts.push(draft);return draft;
}
export function submitDraft(s,id){const d=store(s).drafts.find(d=>d.id===id);if(!d)fail('missing');owns(s,d.creatorId);if(d.status!=='draft'&&d.status!=='changes')fail('status');d.status='review';return d;}
export function requestChanges(s,id){if(!canPublish(s))fail('permission');const d=store(s).drafts.find(d=>d.id===id);if(!d||d.status!=='review')fail('status');d.status='changes';return d;}
export function publishDraft(s,id){if(!canPublish(s))fail('permission');const data=store(s),d=data.drafts.find(d=>d.id===id);if(!d||d.status!=='review')fail('status');if(d.type==='case')validateDesignSources(s,d.design);const old=data.published.find(c=>c.id===id),published={...structuredClone(d),status:'published',version:(old?.version||0)+1,demo:true};if(old)data.published[data.published.indexOf(old)]=published;else data.published.push(published);d.status='published';d.version=published.version;return published;}
export function unpublishContent(s,id){if(!canPublish(s))fail('permission');const c=store(s).published.find(c=>c.id===id);if(!c)fail('missing');c.status='unpublished';const draft=store(s).drafts.find(d=>d.id===id);if(draft)draft.status='unpublished';}
