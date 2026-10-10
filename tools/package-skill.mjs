import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {zipBundle} from './zipBundle.mjs';

const repository=fileURLToPath(new URL('../',import.meta.url));
function command(relativePath,args=[]){const result=spawnSync(process.execPath,[resolve(repository,relativePath),...args],{cwd:repository,stdio:'inherit'});if(result.error)throw result.error;if(result.status!==0)throw new Error(`Bundle build failed: ${relativePath}, exit ${result.status}`);}
command('node_modules/typescript/bin/tsc',['--noEmit']);command('node_modules/vite/bin/vite.js',['build']);
const entries=[];
const add=async(source,name)=>entries.push({name:`kafka-city/${name}`,data:await readFile(resolve(repository,source))});
async function tree(source,destination){for(const entry of (await readdir(resolve(repository,source),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){if(entry.isSymbolicLink())throw new Error(`Bundle cannot include a symlink: ${join(source,entry.name)}`);const target=destination?`${destination}/${entry.name}`:entry.name;if(entry.isDirectory())await tree(join(source,entry.name),target);else if(entry.isFile())await add(join(source,entry.name),target);}}
await tree('skills/kafka-city','');
// Use a fixed allowlist; never copy the working directory, secrets or sessions.
for(const file of ['mapServer.mjs','runProduct.mjs','staticFiles.mjs'])await add(`server/${file}`,`assets/app/server/${file}`);
await add('shared/mapProtocol.mjs','assets/app/shared/mapProtocol.mjs');await add('shared/clusterProtocol.mjs','assets/app/shared/clusterProtocol.mjs');await tree('dist','assets/app/dist');
await add('discussions/kafka-city/collector-setup.md','references/collector-setup.md');await add('discussions/kafka-city/docker-kafka-handoff.md','references/docker-kafka-handoff.md');
for(const dependency of ['react','react-dom','scheduler'])await add(`node_modules/${dependency}/LICENSE`,`licenses/${dependency}.txt`);
const {version}=JSON.parse(await readFile(resolve(repository,'package.json'),'utf8'));
const manifest={format:1,version,requiredNode:'20.19+',files:Object.fromEntries(entries.map(entry=>[entry.name.replace(/^kafka-city\//,''),createHash('sha256').update(entry.data).digest('hex')]))};
entries.push({name:'kafka-city/bundle-manifest.json',data:Buffer.from(JSON.stringify(manifest,null,2))});
entries.sort((a,b)=>a.name.localeCompare(b.name));
if(new Set(entries.map(entry=>entry.name)).size!==entries.length)throw new Error('Duplicate bundle paths.');
if(entries.some(entry=>/node_modules|\.kafka-city|access-token|snapshot\.json|\.git\//.test(entry.name)))throw new Error('Forbidden private or development file in bundle.');
const archive=zipBundle(entries),directory=resolve(repository,'releases');await mkdir(directory,{recursive:true});
const output=resolve(directory,`kafka-city-skill-v${version}.zip`);await writeFile(output,archive);await writeFile(`${output}.sha256`,`${createHash('sha256').update(archive).digest('hex')}  kafka-city-skill-v${version}.zip\n`);
console.log(JSON.stringify({archive:output,bytes:archive.length,files:entries.length,requiredNode:'20.19+',runtimePackagesToInstall:0},null,2));
