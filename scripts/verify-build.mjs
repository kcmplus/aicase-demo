import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import catalog from '../dist/demo/catalog.js';
import {applyCatalog} from '../dist/runtime-catalog.js';
import {imageAttributes} from '../dist/image-view.js';
const root=new URL('../dist/',import.meta.url);
applyCatalog(catalog);
const site=new URL('https://example.test/aicase-demo/');
for(const src of [...catalog.ai_styles.map(s=>s.image_path),...catalog.ai_examples.flatMap(e=>[e.original_path,...e.results.map(r=>r.image_path)])]){
 assert.ok(new URL(src,site).pathname.startsWith('/aicase-demo/assets/'),src);
 await access(new URL(src,root));
 const image=imageAttributes(src);
 assert.ok(new URL(image.src,site).pathname.startsWith('/aicase-demo/assets/'),image.src);
 await access(new URL(image.src,root));
 for(const variant of (image.srcset||'').split(', ').filter(Boolean))await access(new URL(variant.split(' ')[0],root));
}
async function check(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory()){await check(file);continue;}
  if(!/\.(js|html|css)$/.test(entry.name))continue;
  const source=await readFile(file,'utf8');
  assert.doesNotMatch(source,/["'`(]\/assets\//,`${file.pathname}: root-relative asset`);
  if(entry.name.endsWith('.js'))for(const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g))await access(new URL(match[1],file));
 }
}
await check(root);
for(const file of ['index.html','device.html','.nojekyll'])await access(new URL(file,root));
assert.match(await readFile(new URL('device-app.js',root),'utf8'),/new URL\(`\.\/\?lang=/);
console.log('Build verified: catalog, images, module imports and Pages subdirectory paths.');
