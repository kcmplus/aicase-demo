import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {designs,legacyPhoneModels,phoneModels,createPass,readPass,stationAvailability,startPrint,advancePrint} from '../storefront/simple-core.js';

test('all 30 preset and phone combinations round-trip through unique design codes',()=>{
 const codes=new Set();
 for(const d of designs)for(const model of legacyPhoneModels){const pass=createPass(d.id,model);assert.deepEqual(readPass(pass.code),pass);codes.add(pass.code);}
 assert.equal(codes.size,30);
});
test('missing models, unknown designs and malformed or mistyped codes are rejected',()=>{
 assert.throws(()=>createPass('bloom',''));
 assert.throws(()=>createPass('custom','iPhone 16 Pro'));
 for(const code of ['','POP-9999','POP-1111','POP-1719','POP-1162','<script>','POP-1117extra'])assert.throws(()=>readPass(code));
 assert.equal(readPass(' pop-1117 ').model,'iPhone 16 Pro');
});
test('station availability blocks unknown, offline and out-of-stock machines',()=>{
 const pass=createPass('bloom','Samsung S24');
 for(const id of ['UNKNOWN','DEMO-02','DEMO-03']){assert.equal(stationAvailability(id,pass).ok,false);assert.throws(()=>startPrint(pass,id));}
 assert.equal(stationAvailability('DEMO-01',pass).ok,true);
});
test('station reconstructs the preset from the code rather than trusting altered pass fields',()=>{
 const pass=createPass('bloom','Samsung S24');
 const job=startPrint({...pass,model:'iPhone 16 Pro',designId:'type'},'DEMO-01');
 assert.deepEqual(job.pass,pass);
 assert.throws(()=>startPrint({...pass,model:'iPhone 16 Pro'},'DEMO-02'));
});
test('printing preserves the design snapshot and advances once through collection',()=>{
 const pass=createPass('type','iPhone 15');
 const printing=startPrint(pass,'DEMO-01');pass.designId='bloom';
 const ready=advancePrint(printing),collected=advancePrint(ready);
 assert.equal(printing.status,'printing');assert.equal(ready.status,'ready');assert.equal(collected.status,'collected');
 assert.equal(collected.pass.designId,'type');assert.throws(()=>advancePrint(collected));
 assert.deepEqual(JSON.parse(JSON.stringify(collected)),collected);
});
test('every supported combination has a local QR asset with a quiet zone',async()=>{
 for(const d of designs)for(const model of legacyPhoneModels){
  const {code}=createPass(d.id,model);
  const svg=await readFile(new URL(`../storefront/assets/passes/${code}.svg`,import.meta.url),'utf8');
  assert.match(svg,/<svg/);assert.match(svg,/viewBox="0 0 29 29"/);assert.match(svg,/<path/);
 }
});

const {createPersonalPass}=await import('../storefront/simple-core.js');
const {makePersonalDesign,collectionForPhoto}=await import('../storefront/simple-personalize.js');
const draft=()=>({source:'photo',designId:'bloom',model:'iPhone 16 Pro',photo:'data:image/jpeg;base64,AQID',effect:'warm',intensity:65,zoom:125,x:35,y:70});
test('custom photo passes require their saved local snapshot and preserve crop and effects',()=>{
 const input=draft(),pass=createPersonalPass(input);
 assert.match(pass.code,/^POP-C-[A-F0-9]{16}$/);assert.throws(()=>readPass(pass.code),/original browser/);
 input.photo='data:image/jpeg;base64,BAUG';input.effect='bold';
 const restored=readPass(pass.code,JSON.parse(JSON.stringify(pass)));
 assert.equal(restored.photo,'data:image/jpeg;base64,AQID');assert.equal(restored.effect,'warm');assert.equal(restored.zoom,125);assert.equal(restored.x,35);assert.equal(restored.y,70);
 const job=startPrint(restored,'DEMO-01');restored.effect='fresh';assert.equal(job.pass.effect,'warm');
 assert.notEqual(createPersonalPass(draft()).code,pass.code);
});
test('photo and effect validation rejects missing images, executable URLs and unsupported models',()=>{
 for(const photo of ['', 'https://example.com/private.jpg','data:image/svg+xml;base64,AQID','javascript:alert(1)'])assert.throws(()=>createPersonalPass({...draft(),photo}));
 assert.throws(()=>createPersonalPass({...draft(),model:'Other phone'}));
 assert.throws(()=>createPersonalPass({...draft(),effect:'unknown'}));
 assert.throws(()=>createPersonalPass({...draft(),zoom:999}));
 const pass=createPersonalPass(draft());assert.throws(()=>readPass(pass.code,{...pass,code:'POP-C-0000000000000000'}));
});
test('comparison and zero-strength effects do not destroy or change the original photo crop',()=>{
 const selected=draft(),original=makePersonalDesign(selected,true),enhanced=makePersonalDesign(selected);
 assert.equal(original.image,enhanced.image);assert.equal(enhanced.zoom,125);assert.equal(enhanced.photoX,35);assert.equal(enhanced.photoY,70);
 assert.equal(enhanced.beauty.preset,'warm');assert.equal(original.beauty,undefined);
 assert.deepEqual(makePersonalDesign({...selected,intensity:0}),original);
 assert.equal(selected.effect,'warm');
});
test('curated designs can include an optional effect and still use the same station flow',()=>{
 const pass=createPersonalPass({...draft(),source:'collection',designId:'type',photo:''});
 const design=makePersonalDesign(pass);
 assert.equal(design.templateId,'type');assert.equal(design.beauty.preset,'warm');assert.equal(design.layers[0].text,'MAKE');
 assert.equal(startPrint(pass,'DEMO-01').pass.effect,'warm');assert.throws(()=>startPrint(pass,'DEMO-03'));
});
test('vendored browser QR encoder handles the longer custom pass codes',async()=>{
 const {create}=await import('../storefront/vendor/qr.js');
 const matrix=create(createPersonalPass(draft()).code,{errorCorrectionLevel:'M'}).modules;
 assert.ok(matrix.size>=21);assert.equal(matrix.get(0,0),1);assert.equal(matrix.get(6,6),1);
});

test('collection artwork placement transforms the group while keeping background and camera separate',()=>{
 const original=makePersonalDesign({source:'collection',designId:'sunset'});
 const moved=makePersonalDesign({source:'collection',designId:'sunset',zoom:80,x:60,y:40});
 assert.equal(moved.background,original.background);
 for(let i=0;i<original.layers.length;i++){
  assert.equal(moved.layers[i].x,50+(original.layers[i].x-50)*.8+10);
  assert.equal(moved.layers[i].y,50+(original.layers[i].y-50)*.8-10);
  assert.equal(moved.layers[i].size,original.layers[i].size*.8);
 }
 assert.deepEqual(makePersonalDesign({source:'collection',designId:'sunset'}),original);
});
test('individual icon and text layouts survive saved passes and print snapshots independently',()=>{
 const selection={...draft(),source:'collection',designId:'sunset',photo:'',effect:'original',zoom:100,x:50,y:50,artworkEdits:{'sunset-0':{x:65,y:45,scale:75,rotation:20},'sunset-2':{x:40,y:80,scale:90,rotation:0}}};
 const pass=createPersonalPass(selection),restored=readPass(pass.code,JSON.parse(JSON.stringify(pass))),result=makePersonalDesign(restored);
 assert.equal(result.layers[0].x,65);assert.equal(result.layers[0].y,45);assert.equal(result.layers[0].size,45);assert.equal(result.layers[0].rotation,20);
 assert.equal(result.layers[1].x,36);assert.equal(result.layers[2].x,40);
 const job=startPrint(restored,'DEMO-01');restored.artworkEdits['sunset-0'].x=0;selection.artworkEdits['sunset-0'].x=100;
 assert.equal(job.pass.artworkEdits['sunset-0'].x,65);assert.equal(pass.artworkEdits['sunset-0'].x,65);
 assert.throws(()=>createPersonalPass({...selection,artworkEdits:{unknown:{x:0,y:0,scale:100,rotation:0}}}));
 assert.throws(()=>createPersonalPass({...selection,artworkEdits:{'sunset-0':{x:0,y:0,scale:999,rotation:0}}}));
 assert.equal(createPersonalPass({...selection,zoom:50}).zoom,50);assert.throws(()=>createPersonalPass({...draft(),zoom:50}));
});

test('added graphics, edited template text and custom text survive checkout and print snapshots',()=>{
 const addedArtwork=[{id:'extra-flower',type:'sticker',asset:'tulip',x:68,y:60,scale:70,rotation:18},{id:'extra-message',type:'text',text:'Hello <world>\n你好',font:'hand',color:'#e44592',x:50,y:80,scale:90,rotation:-10}];
 const input={...draft(),source:'collection',designId:'type',effect:'original',zoom:100,x:50,y:50,addedArtwork,artworkEdits:{'type-0':{x:50,y:35,scale:100,rotation:0,text:'MY DAY',font:'serif',color:'#146561'}}};
 const pass=createPersonalPass(input),restored=readPass(pass.code,JSON.parse(JSON.stringify(pass))),design=makePersonalDesign(restored),job=startPrint(restored,'DEMO-01');
 assert.equal(design.layers[0].text,'MY DAY');assert.equal(design.layers[3].asset,'tulip');assert.equal(design.layers[3].size,31.5);assert.equal(design.layers[4].text,'Hello <world>\n你好');
 input.addedArtwork[0].x=0;restored.addedArtwork[1].text='Changed';restored.artworkEdits['type-0'].text='Changed';
 assert.equal(pass.addedArtwork[0].x,68);assert.equal(job.pass.addedArtwork[1].text,'Hello <world>\n你好');assert.equal(job.pass.artworkEdits['type-0'].text,'MY DAY');
});
test('direct photo placement and overlay graphics persist without changing legacy crop fields',()=>{
 const input={...draft(),photoPlacement:{x:58,y:55,scale:72,rotation:15},addedArtwork:[{id:'extra-heart',asset:'heart-line',x:60,y:80,scale:110,rotation:0}]};
 const pass=createPersonalPass(input),restored=readPass(pass.code,JSON.parse(JSON.stringify(pass))),design=makePersonalDesign(restored);
 assert.deepEqual(design.photoPlacement,input.photoPlacement);assert.equal(design.zoom,100);assert.equal(design.photoX,35);assert.equal(design.photoY,70);assert.equal(design.layers[0].asset,'heart-line');
 input.photoPlacement.scale=200;assert.equal(pass.photoPlacement.scale,72);
 assert.equal(makePersonalDesign(draft()).zoom,125);assert.equal(makePersonalDesign(draft()).photoPlacement,undefined);
});
test('untrusted overlays, duplicate ids, invalid text styles and placements cannot enter orders',()=>{
 const graphic={id:'extra-valid',asset:'cat',x:50,y:50,scale:100,rotation:0};
 for(const addedArtwork of [[{...graphic,asset:'https://bad.example/file.svg'}],[graphic,graphic],Array.from({length:21},(_,i)=>({...graphic,id:'extra-'+i})),[{...graphic,scale:201}],[{...graphic,type:'text',text:'Hello',font:'unknown',color:'#ffffff'}],[{...graphic,type:'text',text:'x'.repeat(81),font:'sans',color:'#ffffff'}],[{...graphic,type:'text',text:'Hi',font:'sans',color:'red;position:fixed'}]])assert.throws(()=>createPersonalPass({...draft(),addedArtwork}));
 assert.throws(()=>createPersonalPass({...draft(),photoPlacement:{x:50,y:50,scale:0,rotation:0}}));
});


test('switching a collection to a photo retains template transforms, text and added artwork through printing',()=>{
 const selection={source:'collection',designId:'bloom',effect:'original',zoom:145,x:63,y:40,artworkEdits:{'bloom-0':{x:82,y:20,scale:160,rotation:35},'bloom-2':{x:48,y:78,scale:90,rotation:-12,text:'Stay sunny',font:'hand',color:'#e44592'}},addedArtwork:[{id:'extra-kept',asset:'bow',x:35,y:55,scale:80,rotation:17}]};
 const original=makePersonalDesign(selection),retained=collectionForPhoto(selection);
 const input={...draft(),effect:'original',photoPlacement:{x:50,y:50,scale:100,rotation:0},...retained};
 const pass=createPersonalPass(input),restored=readPass(pass.code,JSON.parse(JSON.stringify(pass))),result=makePersonalDesign(restored),job=startPrint(restored,'DEMO-01');
 assert.deepEqual(result.layers,original.layers);
 assert.equal(result.image,input.photo);
 assert.deepEqual(makePersonalDesign({...restored,photo:'data:image/png;base64,AQID'}).layers,original.layers);
 selection.artworkEdits['bloom-2'].text='Changed';restored.collectionLayout.artworkEdits['bloom-0'].x=0;
 assert.equal(pass.collectionLayout.artworkEdits['bloom-2'].text,'Stay sunny');assert.equal(job.pass.collectionLayout.artworkEdits['bloom-0'].x,82);
});

test('repeated collection/photo switches keep existing photo edits without duplicating custom layers',()=>{
 const collection={designId:'type',zoom:100,x:50,y:50,addedArtwork:[{id:'extra-one',type:'text',text:'Hello',font:'sans',color:'#ffffff',x:50,y:50,scale:100,rotation:0}]};
 const first=collectionForPhoto(collection);first.addedArtwork[0].text='Edited on photo';
 const second=collectionForPhoto(collection,first.addedArtwork),third=collectionForPhoto(collection,second.addedArtwork);
 assert.equal(third.addedArtwork.length,1);assert.equal(third.addedArtwork[0].text,'Edited on photo');
 const full=Array.from({length:20},(_,i)=>({id:'extra-'+i,asset:'cat',x:50,y:50,scale:100,rotation:0}));
 assert.throws(()=>collectionForPhoto(collection,full));assert.equal(full.length,20);
});

test('retained photo template layouts reject invalid selections and preserve legacy photo-only passes',()=>{
 const valid={zoom:100,x:50,y:50,artworkEdits:{}};
 for(const collectionLayout of [null,{...valid,zoom:999},{...valid,x:-1},{...valid,artworkEdits:{unknown:{x:50,y:50,scale:100,rotation:0}}},{...valid,artworkEdits:{'bloom-2':{x:50,y:50,scale:100,rotation:0,text:'Hi',font:'bad',color:'#ffffff'}}}])assert.throws(()=>createPersonalPass({...draft(),collectionLayout}));
 assert.throws(()=>createPersonalPass({...draft(),designId:'unknown',collectionLayout:valid}));
 assert.equal(createPersonalPass(draft()).collectionLayout,undefined);assert.equal(makePersonalDesign(draft()).layers.length,0);
});

test('deleted template graphics and text remain absent after save, photo switching and printing',()=>{
 const input={...draft(),source:'collection',effect:'original',zoom:100,x:50,y:50,artworkEdits:{'bloom-0':{x:73,y:30,scale:100,rotation:-12,deleted:true},'bloom-2':{x:51,y:85,scale:100,rotation:0,text:'Removed words',font:'sans',color:'#ffffff',deleted:true}}};
 const pass=createPersonalPass(input),restored=readPass(pass.code,JSON.parse(JSON.stringify(pass)));
 assert.deepEqual(makePersonalDesign(restored).layers.map(l=>l.id),['bloom-1']);
 const photo=createPersonalPass({...draft(),...collectionForPhoto(input)}),job=startPrint(photo,'DEMO-01');
 assert.deepEqual(makePersonalDesign(photo).layers.map(l=>l.id),['bloom-1']);
 photo.collectionLayout.artworkEdits['bloom-0'].deleted=false;
 assert.deepEqual(makePersonalDesign(job.pass).layers.map(l=>l.id),['bloom-1']);
 assert.equal(pass.artworkEdits['bloom-2'].deleted,true);
});

test('deleted flags are validated and do not hide other layers or older layouts',()=>{
 const edit={x:73,y:30,scale:100,rotation:-12};
 const input={...draft(),source:'collection',zoom:100,x:50,y:50,artworkEdits:{'bloom-0':edit}};
 assert.equal(makePersonalDesign(createPersonalPass(input)).layers.length,3);
 for(const deleted of ['true',1,{},null])assert.throws(()=>createPersonalPass({...input,artworkEdits:{'bloom-0':{...edit,deleted}}}));
 assert.equal(makePersonalDesign(createPersonalPass({...input,artworkEdits:{'bloom-0':{...edit,deleted:false}}})).layers.length,3);
});
