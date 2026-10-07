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
  code=code.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
  await writeFile(join(directory,file.replace(/\.ts$/,'.js')),code);
 }
 const source=name=>import(pathToFileURL(join(directory,`${name}.js`)));
 const {renderModel}=await source('scenarioRuntime');
 assert.equal(Object.keys(renderModel.services).length,7);
 assert.equal(Object.keys(renderModel.topics).length,4);
 const {createPreset,presetNames}=await source('scenarioPresets');
 const {deriveScenario}=await source('scenarioDerive');
 for(const name of presetNames){const model=deriveScenario(createPreset(name)),large=name==='Large city (15 services, 35 topics)';assert.equal(Object.keys(model.services).length,large?15:7);assert.equal(Object.keys(model.topics).length,large?35:4);console.log(`PASS startup: ${name}, ${model.cityRoutes.length} routes, ${model.overpasses.length} bridges`);}
 console.log('Mocked data: none. Uses actual default topology, presets, validation and route derivation.');
}finally{
 if(dirname(resolve(directory))!==resolve(tmpdir()))throw new Error('Unexpected temporary directory; cleanup cancelled.');
 await rm(directory,{recursive:true});
}
