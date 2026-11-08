#!/usr/bin/env node
// Conservative read-only audit. Absence of literal references is NOT safe-delete proof.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const files=[];
function walk(dir){
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(['.git','node_modules','dist','.vite','coverage','audit-output'].includes(e.name))continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())walk(p);
  else if(e.isFile())files.push(path.relative(root,p).split(path.sep).join('/'));
 }
}
walk(root);files.sort();
const fileSet=new Set(files);
const sourceFiles=files.filter(f=>/\.(?:js|mjs|cjs|ts|tsx|jsx|html|css|json|yml|yaml|md|sh)$/.test(f));
const js=files.filter(f=>/\.(?:js|mjs|cjs|ts|tsx|jsx)$/.test(f));
const code=new Map(sourceFiles.map(f=>[f,fs.readFileSync(path.join(root,f),'utf8')]));
const edges=new Map(),unresolved=[];
function resolve(from,spec){
 if(!spec.startsWith('.'))return null;
 const base=path.posix.normalize(path.posix.join(path.posix.dirname(from),spec.split('?')[0].split('#')[0]));
 for(const candidate of [base,base+'.js',base+'.mjs',base+'.ts',base+'/index.js'])if(fileSet.has(candidate))return candidate;
 unresolved.push({from,spec});return null;
}
for(const f of js){
 const s=code.get(f),deps=new Set();
 const rx=/(?:\bimport\s*(?:[\s\S]{0,200}?\sfrom\s*)?|\bexport\s+(?:[\s\S]{0,200}?\sfrom\s*)?|\bimport\s*\()\s*['"]([^'"]+)['"]/g;
 let m;while((m=rx.exec(s))){const target=resolve(f,m[1]);if(target)deps.add(target);}
 edges.set(f,[...deps].sort());
}
const roots=['src/main.js',...js.filter(f=>f.startsWith('test/'))];
const reached=new Set(),queue=roots.filter(f=>fileSet.has(f));
while(queue.length){const f=queue.pop();if(reached.has(f))continue;reached.add(f);for(const dep of edges.get(f)||[])queue.push(dep);}
const binaries=files.filter(f=>/\.(?:glb|gltf|png|jpe?g|webp|ogg|mp3|wav|ktx2|bin|hdr)$/i.test(f));
const assets=binaries.map(f=>{
 const name=path.posix.basename(f),full=[],basename=[];
 for(const [source,body] of code){
  if(body.includes(f)||body.includes(f.replace(/^public\//,'')))full.push(source);
  else if(body.includes(name))basename.push(source);
 }
 return {path:f,bytes:fs.statSync(path.join(root,f)).size,
  literalReferences:full,basenameReferences:basename,
  status:full.length?'literal-reference':basename.length?'basename-reference':'no-static-literal-reference'};
});
const report={generatedAt:new Date().toISOString(),
 disclaimer:'Read-only static evidence. No network, browser, dynamic URL or GPU proof. NEVER automatically delete.',
 fileCount:files.length,jsCount:js.length,reachedModuleCount:reached.size,
 moduleRoots:roots,staticUnreachedModules:js.filter(f=>!reached.has(f)),
 unresolvedRelativeImports:unresolved,
 imports:Object.fromEntries([...edges].sort(([a],[b])=>a.localeCompare(b))),
 assets};
const out=path.join(root,'audit-output');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'static-inventory.json'),JSON.stringify(report,null,2)+'\n');
const lines=['# Static audit results','','NOT a safe-delete manifest. Dynamic URLs and conditional runtime paths are not resolved.','',
 'Files: '+files.length+'; JS: '+js.length+'; reachable JS: '+reached.size+'.','','## GLB inventory','','| Path | MiB | Evidence |','| --- | ---: | --- |'];
for(const x of assets.filter(x=>x.path.endsWith('.glb')).sort((a,b)=>b.bytes-a.bytes)){
 lines.push('| '+x.path+' | '+(x.bytes/1048576).toFixed(2)+' | '+x.status+' |');
}
lines.push('','## Unreached JS modules (review only)','');
for(const f of report.staticUnreachedModules)lines.push('- '+f);
lines.push('','## Important limitations','','- Static references do not prove runtime requests.','- Missing references do not prove unused assets.','- No real browser, iPhone Safari, or GPU allocation measurements.','- Never delete without explicit review and regression tests.');
fs.writeFileSync(path.join(out,'static-audit.md'),lines.join('\n')+'\n');
console.log('Audit:',files.length,'files,',js.length,'JS,',reached.size,'reachable JS,',assets.length,'binary assets');
