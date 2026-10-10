import ts from 'typescript';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const directory=await mkdtemp(join(tmpdir(),'kafka-startup-'));
try{
 await writeFile(join(directory,'package.json'),JSON.stringify({type:'module'}));
 for(const file of await readdir('src')){
  if(!file.endsWith('.ts'))continue;
  let code=ts.transpileModule(await readFile(join('src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.js'").replace(/from '\.\.\/shared\/([^']+)'/g,"from './$1'");
  await writeFile(join(directory,file.replace(/\.ts$/,'.js')),code);
 }
 for(const file of await readdir('shared'))if(file.endsWith('.mjs'))await writeFile(join(directory,file),await readFile(join('shared',file)));
 const source=name=>import(pathToFileURL(join(directory,`${name}.js`)));
 const {renderModel}=await source('scenarioRuntime');
 assert.equal(Object.keys(renderModel.services).length,7);
 assert.equal(Object.keys(renderModel.topics).length,4);
 const {createPreset,presetNames}=await source('scenarioPresets');
 const {deriveScenario}=await source('scenarioDerive');
 const {applicationTopology}=await source('clusterModel');
 const started=performance.now();
 for(const name of process.argv.includes("--large")?presetNames.filter(name=>name.startsWith("Large")):presetNames){const preset=createPreset(name),model=deriveScenario(preset),large=name==='Large city (15 services, 35 topics)';assert.equal(Object.keys(model.services).length,large?15:7);assert.equal(Object.keys(model.topics).length,large?35:4);console.log(`PASS startup: ${name}, ${model.cityRoutes.length} routes, ${model.overpasses.length} bridges (${Math.round(performance.now()-started)} ms)`);if(large&&process.argv.includes('--save')){const layout={buildings:model.cityBuildings,terminals:model.terminals,routes:model.cityRoutes,overpasses:model.overpasses};await writeFile('src/largeCityLayout.json',JSON.stringify({version:1,key:JSON.stringify([1,applicationTopology(preset.topology),{...preset.layout,labels:undefined}]),layout}));}}
 console.log('Mocked data: none. Uses actual default topology, presets, validation and route derivation.');
}finally{
 if(dirname(resolve(directory))!==resolve(tmpdir()))throw new Error('Unexpected temporary directory; cleanup cancelled.');
 await rm(directory,{recursive:true});
}
