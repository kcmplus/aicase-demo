import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,login} from '../storefront/core.js';
import {creatorContent,saveDraft,submitDraft,publishDraft,unpublishContent} from '../storefront/creator-core.js';
import {socialSnapshot,isFollowing,toggleLike,toggleSave,toggleFollow,listComments,addComment,deleteComment,socialFeed} from '../storefront/social-core.js';

const firstId = s => creatorContent(s)[0].id;
const signIn = (s,email='first@example.com') => login(s,email,'iPhone 16');

test('guest reads are non-mutating and interactions require a signed-in demo account',()=>{
  const s=initialState(),id=firstId(s),before=JSON.stringify(s),items=creatorContent(s);
  assert.deepEqual(socialSnapshot(s,id),{liked:false,saved:false,likes:0,saves:0,comments:0});
  assert.deepEqual(listComments(s,id),[]);
  assert.equal(isFollowing(s,'noah'),false);
  assert.equal(socialFeed(s,items,'all').length,items.length);
  assert.deepEqual(socialFeed(s,items,'following'),[]);
  assert.deepEqual(socialFeed(s,items,'saved'),[]);
  assert.equal(JSON.stringify(s),before);
  for(const action of [()=>toggleLike(s,id),()=>toggleSave(s,id),()=>toggleFollow(s,'noah'),()=>addComment(s,id,'Hello'),()=>deleteComment(s,id,'missing')])assert.throws(action,/^Error: social:login$/);
  assert.equal(JSON.stringify(s),before);
});

test('like and save toggles cancel cleanly and account actions remain isolated',()=>{
  const s=initialState(),id=firstId(s);signIn(s);
  const accounts=structuredClone(s.accounts);
  assert.equal(toggleLike(s,id),true);assert.equal(toggleSave(s,id),true);
  assert.equal(toggleLike(s,id),false);assert.equal(toggleLike(s,id),true);
  assert.deepEqual(s.accounts,accounts);
  signIn(s,'second@example.com');
  assert.deepEqual(socialSnapshot(s,id),{liked:false,saved:false,likes:1,saves:1,comments:0});
  toggleLike(s,id);toggleSave(s,id);
  assert.deepEqual(socialSnapshot(s,id),{liked:true,saved:true,likes:2,saves:2,comments:0});
  signIn(s,' FIRST@EXAMPLE.COM ');
  assert.equal(toggleSave(s,id),false);
  assert.deepEqual(socialSnapshot(s,id),{liked:true,saved:false,likes:2,saves:1,comments:0});
  assert.equal(Object.keys(s.social.accounts).length,2);
});

test('following and saved feeds reflect current account and toggle cancellation',()=>{
  const s=initialState(),items=creatorContent(s),target=items.find(c=>c.creatorId==='noah');signIn(s);
  assert.equal(toggleFollow(s,'noah'),true);assert.equal(isFollowing(s,'noah'),true);
  assert.deepEqual(socialFeed(s,items,'following').map(c=>c.id),items.filter(c=>c.creatorId==='noah').map(c=>c.id));
  toggleSave(s,target.id);assert.deepEqual(socialFeed(s,items,'saved').map(c=>c.id),[target.id]);
  signIn(s,'second@example.com');assert.equal(isFollowing(s,'noah'),false);assert.deepEqual(socialFeed(s,items,'following'),[]);
  signIn(s);assert.equal(toggleFollow(s,'noah'),false);assert.deepEqual(socialFeed(s,items,'following'),[]);
});

test('comments trim and validate text, expose no email, and survive serialization with stable IDs',()=>{
  const s=initialState(),id=firstId(s);signIn(s);
  const first=addComment(s,id,'  Love this palette!  '),second=addComment(s,id,'Second thought');
  assert.equal(first.body,'Love this palette!');assert.notEqual(first.id,second.id);
  assert.equal(first.parentId,null);assert.equal(first.own,true);assert.equal(first.deleted,false);
  assert.ok(first.nameZh.startsWith('创作伙伴 '));assert.ok(first.nameEn.startsWith('Creative friend '));
  assert.ok(Number.isFinite(Date.parse(first.createdAt)));
  const roundTrip=JSON.parse(JSON.stringify(s));assert.deepEqual(listComments(roundTrip,id),listComments(s,id));
  const exported=JSON.stringify(listComments(s,id));assert.ok(!exported.includes('@'));assert.ok(!exported.includes('email'));
  for(const body of ['', '  \n  ','x'.repeat(301),null,{}])assert.throws(()=>addComment(s,id,body),/^Error: social:text$/);
  assert.equal(socialSnapshot(s,id).comments,2);
  addComment(s,id,'x'.repeat(300));assert.equal(socialSnapshot(s,id).comments,3);
  first.body='mutated output';assert.equal(listComments(s,id)[0].body,'Love this palette!');
  const returned=listComments(s,id);returned[0].body='another mutation';assert.equal(listComments(s,id)[0].body,'Love this palette!');
  signIn(s,'second@example.com');assert.equal(listComments(s,id)[0].own,false);
  const other=addComment(s,id,'Hello again');assert.notEqual(other.nameZh,first.nameZh);
  signIn(s);assert.equal(listComments(s,id)[0].nameZh,first.nameZh);
});

test('reply and deletion preserve other authors and retain parent tombstones until their replies are gone',()=>{
  const s=initialState(),id=firstId(s);signIn(s);
  const parent=addComment(s,id,'Original comment');
  signIn(s,'second@example.com');const reply=addComment(s,id,'A reply',parent.id);
  assert.equal(reply.parentId,parent.id);
  assert.throws(()=>deleteComment(s,id,parent.id),/^Error: social:permission$/);
  assert.throws(()=>addComment(s,id,'Too deeply nested',reply.id),/^Error: social:reply$/);
  signIn(s);assert.equal(deleteComment(s,id,parent.id),true);
  let comments=listComments(s,id);assert.equal(comments.length,2);assert.equal(comments[0].deleted,true);assert.equal(comments[0].body,'');
  assert.equal(socialSnapshot(s,id).comments,1);
  assert.throws(()=>addComment(s,id,'Reply to deleted',parent.id),/^Error: social:reply$/);
  assert.throws(()=>deleteComment(s,id,reply.id),/^Error: social:permission$/);
  signIn(s,'second@example.com');deleteComment(s,id,reply.id);
  assert.deepEqual(listComments(s,id),[]);assert.equal(socialSnapshot(s,id).comments,0);
  assert.throws(()=>deleteComment(s,id,'missing'),/^Error: social:missing$/);
});

test('reply targets must exist on the same work and errors leave state unchanged',()=>{
  const s=initialState(),items=creatorContent(s);signIn(s);
  const other=addComment(s,items[1].id,'Other work'),before=JSON.stringify(s);
  assert.throws(()=>addComment(s,items[0].id,'Wrong work',other.id),/^Error: social:reply$/);
  assert.throws(()=>addComment(s,items[0].id,'Missing parent','missing'),/^Error: social:reply$/);
  assert.throws(()=>toggleFollow(s,'missing'),/^Error: social:creator$/);
  assert.throws(()=>toggleLike(s,'missing'),/^Error: social:unavailable$/);
  assert.throws(()=>toggleSave(s,'missing'),/^Error: social:unavailable$/);
  assert.throws(()=>addComment(s,'missing','Hello'),/^Error: social:unavailable$/);
  assert.equal(JSON.stringify(s),before);
});

test('unpublished content is excluded from reads and feeds, and cannot accept new interactions',()=>{
  const s=initialState();signIn(s,'studio@popomo.demo');
  const draft=saveDraft(s,{creatorId:'mika',type:'sticker',zh:'Social test',src:'./assets/creator/bow.svg'});
  submitDraft(s,draft.id);publishDraft(s,draft.id);const items=creatorContent(s);
  toggleLike(s,draft.id);toggleSave(s,draft.id);const comment=addComment(s,draft.id,'Before unpublishing');
  unpublishContent(s,draft.id);
  assert.deepEqual(socialSnapshot(s,draft.id),{liked:false,saved:false,likes:0,saves:0,comments:0});
  assert.deepEqual(listComments(s,draft.id),[]);assert.deepEqual(socialFeed(s,items,'saved'),[]);
  for(const action of [()=>toggleLike(s,draft.id),()=>toggleSave(s,draft.id),()=>addComment(s,draft.id,'After'),()=>deleteComment(s,draft.id,comment.id)])assert.throws(action,/^Error: social:unavailable$/);
  assert.equal(s.social.comments[draft.id][0].body,'Before unpublishing');
});

test('signed-in reads never allocate stores or mutate existing state',()=>{
  const s=initialState();signIn(s);const id=firstId(s),items=creatorContent(s),before=JSON.stringify(s);
  socialSnapshot(s,id);listComments(s,id);isFollowing(s,'mika');socialFeed(s,items,'saved');
  assert.equal(JSON.stringify(s),before);assert.equal(s.social,undefined);
  toggleLike(s,id);addComment(s,id,'<img src=x onerror=alert(1)>');const after=JSON.stringify(s);
  socialSnapshot(s,id);listComments(s,id);socialFeed(s,items,'following');
  assert.equal(JSON.stringify(s),after);assert.equal(listComments(s,id)[0].body,'<img src=x onerror=alert(1)>');
});
