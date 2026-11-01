import {creatorContent,contentById,creators} from './creator-core.js';

// This is a local demo ledger. Accounts share counts only within this browser's
// saved state; no action is sent to another user or a remote social service.
const fail = code => { throw Error('social:'+code); };
const record = value => value && typeof value==='object' && !Array.isArray(value);
const ownValue = (object,key) => record(object) && Object.hasOwn(object,key) ? object[key] : undefined;
const emailKey = s => typeof s.account?.email==='string' ? s.account.email.trim().toLowerCase() : '';
const signedIn = s => { const key=emailKey(s); if(!key)fail('login'); return key; };
const array = value => Array.isArray(value) ? value : [];
const accountData = (s,key=emailKey(s)) => ownValue(s.social?.accounts,key);
const commentData = (s,id) => array(ownValue(s.social?.comments,id));
const has = (s,field,id,key=emailKey(s)) => !!key && array(accountData(s,key)?.[field]).includes(id);
const setEntry = (object,key,value) => Object.defineProperty(object,key,{value,enumerable:true,configurable:true,writable:true});

function store(s){
  if(!record(s.social))s.social={accounts:{},comments:{}};
  if(!record(s.social.accounts))s.social.accounts={};
  if(!record(s.social.comments))s.social.comments={};
  return s.social;
}
function requireContent(s,id){
  if(typeof id!=='string'||!contentById(s,id))fail('unavailable');
}
function toggle(s,key,field,id){
  const data=store(s);
  if(!record(ownValue(data.accounts,key)))setEntry(data.accounts,key,{likes:[],saves:[],follows:[]});
  const account=data.accounts[key],values=new Set(array(account[field]));
  const active=!values.has(id);
  if(active)values.add(id);else values.delete(id);
  account[field]=[...values];
  return active;
}
function count(s,field,id){
  return Object.values(record(s.social?.accounts)?s.social.accounts:{}).reduce((total,account)=>total+(array(account?.[field]).includes(id)?1:0),0);
}
function displayName(key){
  // A stable local alias avoids copying a login email into any public field.
  let hash=2166136261;
  for(const char of key){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}
  const suffix=(hash>>>0).toString(36).padStart(7,'0').toUpperCase();
  return {nameZh:'创作伙伴 '+suffix,nameEn:'Creative friend '+suffix};
}
function publicComment(comment,key){
  return {id:comment.id,parentId:comment.parentId??null,body:comment.deleted?'':comment.body,...displayName(comment.authorKey),createdAt:comment.createdAt,own:!!key&&comment.authorKey===key,deleted:!!comment.deleted};
}

export function socialSnapshot(s,contentId){
  if(!contentById(s,contentId))return {liked:false,saved:false,likes:0,saves:0,comments:0};
  return {liked:has(s,'likes',contentId),saved:has(s,'saves',contentId),likes:count(s,'likes',contentId),saves:count(s,'saves',contentId),comments:commentData(s,contentId).filter(comment=>!comment.deleted).length};
}
export function isFollowing(s,creatorId){
  return creators.some(creator=>creator.id===creatorId)&&has(s,'follows',creatorId);
}
export function toggleLike(s,contentId){
  const key=signedIn(s);requireContent(s,contentId);
  return toggle(s,key,'likes',contentId);
}
export function toggleSave(s,contentId){
  const key=signedIn(s);requireContent(s,contentId);
  return toggle(s,key,'saves',contentId);
}
export function toggleFollow(s,creatorId){
  const key=signedIn(s);
  if(!creators.some(creator=>creator.id===creatorId))fail('creator');
  return toggle(s,key,'follows',creatorId);
}
export function listComments(s,contentId){
  if(!contentById(s,contentId))return [];
  return commentData(s,contentId).map(comment=>publicComment(comment,emailKey(s)));
}
export function addComment(s,contentId,body,parentId=null){
  const key=signedIn(s);requireContent(s,contentId);
  if(typeof body!=='string')fail('text');
  const text=body.trim();
  if(!text||text.length>300)fail('text');
  const comments=commentData(s,contentId);
  if(parentId!==null){
    const parent=comments.find(comment=>comment.id===parentId);
    if(!parent||parent.deleted||parent.parentId!==null)fail('reply');
  }
  const comment={id:'comment-'+crypto.randomUUID(),parentId,body:text,authorKey:key,createdAt:new Date().toISOString(),deleted:false};
  setEntry(store(s).comments,contentId,[...comments,comment]);
  return publicComment(comment,key);
}
export function deleteComment(s,contentId,commentId){
  const key=signedIn(s);requireContent(s,contentId);
  const comments=commentData(s,contentId),comment=comments.find(item=>item.id===commentId);
  if(!comment||comment.deleted)fail('missing');
  if(comment.authorKey!==key)fail('permission');
  let next;
  if(comments.some(item=>item.parentId===commentId)){
    next=comments.map(item=>item.id===commentId?{...item,body:'',deleted:true}:item);
  }else{
    next=comments.filter(item=>item.id!==commentId);
    // Remove an empty tombstone once its last remaining reply is deleted.
    if(comment.parentId&&!next.some(item=>item.parentId===comment.parentId))next=next.filter(item=>!(item.id===comment.parentId&&item.deleted));
  }
  setEntry(store(s).comments,contentId,next);
  return true;
}
export function socialFeed(s,items,mode='all'){
  const available=new Set(creatorContent(s).map(content=>content.id));
  return items.filter(content=>available.has(content.id)&&(mode==='following'?isFollowing(s,content.creatorId):mode==='saved'?has(s,'saves',content.id):true));
}
