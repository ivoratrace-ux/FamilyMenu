// Static HTML/CSS/JavaScript, as in 286f930. Copy only public client files to Pages.
import {cp,mkdir,rm,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'_site');
const index=await readFile(resolve(root,'index.html'),'utf8');
if(!index.includes('src/bootstrap.js'))throw Error('Missing Web entry point');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await cp(resolve(root,'index.html'),resolve(out,'index.html'));
await cp(resolve(root,'src'),resolve(out,'src'),{recursive:true});
console.log('Static Web prepared in _site (no framework, Kotlin or bundler).');
