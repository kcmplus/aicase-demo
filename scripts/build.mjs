import {cp,mkdir,rm,readdir,readFile,writeFile} from 'node:fs/promises';
const destination=new URL('../dist/',import.meta.url);
await rm(destination,{recursive:true,force:true});
await mkdir(destination,{recursive:true});
await cp(new URL('../storefront/',import.meta.url),destination,{recursive:true});
// Documents, styles and modules are served from the site root. Make asset URLs
// document-relative so the same build works at / and /aicase-demo/ on Pages.
async function rewrite(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const file=new URL(entry.name+(entry.isDirectory()?'/':''),directory);
  if(entry.isDirectory())await rewrite(file);
  else if(/\.(?:html|css|js|json)$/.test(entry.name)){
   const source=await readFile(file,'utf8');
   await writeFile(file,source.replace(/(["'`(])\/assets\//g,'$1./assets/'));
  }
 }
}
await rewrite(destination);
await writeFile(new URL('.nojekyll',destination),'');
console.log('Static site built in dist/ (root and subdirectory hosting supported)');
