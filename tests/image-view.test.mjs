import test from 'node:test';
import assert from 'node:assert/strict';
import {stat,readFile} from 'node:fs/promises';
import manifest from '../storefront/image-manifest.js';
import {imageAttributes,imageTag,registerImageVariants} from '../storefront/image-view.js';
import {phone} from '../storefront/art.js';
import {designFor} from '../storefront/catalog.js';

test('all responsive candidates exist and the largest previews are materially smaller than originals',async()=>{
 let originalBytes=0,previewBytes=0;
 for(const [src,record] of Object.entries(manifest)){
  originalBytes+=(await stat(new URL('../storefront'+src,import.meta.url))).size;
  for(const v of record.variants){
   assert.ok(v.width<=record.width);assert.ok(Math.abs(v.width/v.height-record.width/record.height)<.01);
   const bytes=await readFile(new URL('../storefront'+v.src,import.meta.url));
   assert.equal(bytes.toString('ascii',8,12),'WEBP');
   if(v===record.variants.at(-1))previewBytes+=bytes.length;
  }
 }
 assert.ok(previewBytes<originalBytes*.2);
});
test('responsive display does not mutate original design paths or photo data',()=>{
 const design=designFor('garden'),before=structuredClone(design);
 assert.match(phone(design),/srcset="\/assets\/optimized\//);
 assert.deepEqual(design,before);
 const photo='data:image/png;base64,AQID';assert.equal(imageAttributes(photo).src,photo);
 assert.equal(imageAttributes('/media/uploads/unknown.png').src,'/media/uploads/unknown.png');
 const thumbnail=imageAttributes('./assets/ai-styles/original.png',{sizes:'100px'});
 assert.equal(thumbnail.loading,'lazy');assert.equal(thumbnail.decoding,'async');assert.equal(thumbnail.sizes,'100px');
 assert.equal(imageAttributes('/assets/ai-styles/original.png',{loading:'eager'}).loading,'eager');
});
test('managed upload previews work while unsafe URLs and malformed optional metadata fall back',()=>{
 const src='/media/uploads/example.png';
 registerImageVariants({[src]:{width:900,height:1200,variants:[{src:'/media/previews/abc-320.webp',width:320,height:427}]}});
 assert.equal(imageAttributes(src).src,'/media/previews/abc-320.webp');
 registerImageVariants({'/media/uploads/bad.png':{width:1,height:1,variants:[{src:'https://evil.test/a.webp',width:1,height:1}]}});
 assert.equal(imageAttributes('/media/uploads/bad.png').srcset,undefined);
 assert.match(imageTag(src,{alt:'" onerror="alert(1)'}),/alt="&quot; onerror=&quot;alert\(1\)"/);
});
