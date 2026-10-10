import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';

// Real Chromium, application modules, example presets and IndexedDB. No mocks.
const browserPackages=process.argv[2];if(!browserPackages)throw new Error('Pass the directory containing the installed Playwright package.');
const require=createRequire(resolve(browserPackages,'package.json'));
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],warnings=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());if(message.type()==='warning')warnings.push(message.text());});
const observations=[];
try{
 await page.addInitScript(()=>{window.cityResponsiveness={maximumDelay:0,ticks:0};let previous=performance.now();setInterval(()=>{const now=performance.now();window.cityResponsiveness.maximumDelay=Math.max(window.cityResponsiveness.maximumDelay,now-previous-50);window.cityResponsiveness.ticks++;previous=now;},50);});
 await page.goto('http://localhost:5173/',{waitUntil:'networkidle'});
 const world=page.locator('.canvas-world');
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 observations.push({stage:'demo',data:await world.evaluate(element=>({...element.dataset}))});
 await page.getByText('Demo tools',{exact:true}).click();await page.getByRole('button',{name:'Configure',exact:true}).click();
 await page.getByRole('button',{name:'SCENARIOS',exact:true}).click();
 await page.getByLabel('Scenario preset').selectOption('Large city (15 services, 35 topics)');
 await page.evaluate(()=>{window.cityResponsiveness.maximumDelay=0;window.cityResponsiveness.ticks=0;});
 const started=Date.now();
 await page.getByRole('button',{name:'Load preset',exact:true}).click();
 await page.getByRole('status').filter({hasText:'Current city: Large city (15 services, 35 topics)'}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Close configuration',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 observations.push({stage:'large overview',loadMs:Date.now()-started,data:await world.evaluate(element=>({...element.dataset}))});
 observations.push({stage:'loading responsiveness',data:await page.evaluate(()=>window.cityResponsiveness)});
 await page.mouse.move(300,40);await page.waitForTimeout(3500);
 observations.push({stage:'large steady animation',data:await world.evaluate(element=>({...element.dataset}))});
 await page.screenshot({path:resolve('discussions/kafka-city/large-city-overview.png')});
 const geometry=await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').map(entry=>entry.name).findLast(name=>/\/src\/scenarioRuntime\.ts(?:\?|$)/.test(name));if(!url)throw new Error('Active runtime module was not found');const {renderModel}=await import(url);return {services:Object.keys(renderModel.services).length,topics:Object.keys(renderModel.topics).length,bridges:renderModel.overpasses.length,bounds:renderModel.worldBounds};});
 assert.equal(geometry.services,15);assert.equal(geometry.topics,35);
 assert.ok(Number(await world.getAttribute('data-tile-bytes'))<=96*1024*1024);
 await page.mouse.move(720,500);await page.mouse.wheel(0,-1400);
 await page.waitForFunction(()=>Number(document.querySelector('.canvas-world')?.getAttribute('data-camera')?.split(',')[2])>3);
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 await page.mouse.move(600,550);await page.mouse.down();await page.mouse.move(900,680,{steps:20});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 observations.push({stage:'zoom and pan',data:await world.evaluate(element=>({...element.dataset}))});
 await page.mouse.move(300,40);await page.waitForTimeout(3500);
 observations.push({stage:'close steady animation',data:await world.evaluate(element=>({...element.dataset}))});
 await page.screenshot({path:resolve('discussions/kafka-city/large-city-close.png')});
 const hover=await page.evaluate(async()=>{
  const active=part=>performance.getEntriesByType('resource').map(entry=>entry.name).findLast(name=>name.includes(`/src/${part}.ts`));
  const {renderModel}=await import(active('scenarioRuntime')),{pick}=await import(active('canvasPicking'));
  const root=document.querySelector('.canvas-world'),box=root.getBoundingClientRect(),[offsetX,offsetY,zoom]=root.dataset.camera.split(',').map(Number),bounds=renderModel.worldBounds;
  const scale=Math.min(box.width/bounds.width,box.height/bounds.height)*zoom,viewX=box.width/2-(bounds.x+bounds.width/2-offsetX)*scale,viewY=box.height/2-(bounds.y+bounds.height/2-offsetY)*scale;
  for(const route of renderModel.cityRoutes)for(let index=1;index<route.points.length;index++){const a=route.points[index-1],b=route.points[index],u=(a.u+b.u)/2,v=(a.v+b.v)/2,x=u-v,y=(u+v)/2,clientX=box.x+viewX+x*scale,clientY=box.y+viewY+y*scale,target=pick(x,y);if((target?.kind==='topic'||target?.kind==='partition')&&clientX>30&&clientX<box.width-30&&clientY>100&&clientY<box.height-190)return {x:clientX,y:clientY,topic:target.name,title:target.kind==='partition'?`${renderModel.topics[target.name].name} / P${target.partitionId}`:target.name};}
  throw new Error('No visible topic road could be hovered.');
 });
 await page.mouse.move(hover.x,hover.y);assert.equal(await world.getAttribute('title'),hover.title);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 observations.push({stage:'topic hover and focus tiles',topic:hover.topic,data:await world.evaluate(element=>({...element.dataset}))});
 await page.screenshot({path:resolve('discussions/kafka-city/large-city-hover.png')});
 await page.mouse.move(300,40);
 await page.getByRole('button',{name:'Pause',exact:false}).click();
 const before=await world.getAttribute('data-simulation-time');await page.waitForTimeout(200);assert.equal(await world.getAttribute('data-simulation-time'),before);
 await page.getByRole('button',{name:'Play',exact:false}).click();
 await page.getByRole('button',{name:'Reset view',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 const retainedCamera=await world.getAttribute('data-camera');await page.getByRole('button',{name:'CLUSTER',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.canvas-world')?.dataset.knownReplicas==='105');assert.equal(await world.getAttribute('data-camera'),retainedCamera);assert.equal(await world.getAttribute('data-replica-connections'),'0');await page.getByRole('button',{name:'Center brokers',exact:true}).click();await page.waitForFunction(previous=>document.querySelector('.canvas-world')?.dataset.camera!==previous,retainedCamera);await page.waitForFunction(()=>document.querySelector('.canvas-world')?.dataset.pendingTiles==='0',{},{timeout:60000});const brokerCounts=await page.evaluate(async()=>{const url=performance.getEntriesByType('resource').findLast(entry=>new URL(entry.name).pathname==='/src/scenarioRuntime.ts')?.name;const {renderModel}=await import(url);return renderModel.cluster.brokers.map(broker=>({broker:broker.id,replicas:Object.values(renderModel.cluster.partitions).flat().filter(partition=>partition.replicaBrokerIds.includes(broker.id)).length}));});for(const broker of brokerCounts)assert.ok(broker.replicas>0,`${broker.broker} receives demo replicas`);observations.push({stage:'large broker distribution',data:{brokers:brokerCounts}});await page.screenshot({path:resolve('discussions/kafka-city/large-city-cluster.png')});observations.push({stage:'large Cluster View',data:await world.evaluate(element=>({...element.dataset}))});await page.getByRole('button',{name:'APPLICATION',exact:true}).click();await page.getByRole('button',{name:'Reset view',exact:true}).click();
 if(!await page.getByRole('button',{name:'Configure',exact:true}).isVisible())await page.getByText('Demo tools',{exact:true}).click();await page.getByRole('button',{name:'Configure',exact:true}).click();
 await page.getByRole('button',{name:'SCENARIOS',exact:true}).click();
 const repeatStarted=Date.now();await page.getByRole('button',{name:'Load preset',exact:true}).click();
 await page.getByText('Large city (15 services, 35 topics) applied: 15 services, 35 topics.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close configuration',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.canvas-world')?.getAttribute('data-pending-tiles')==='0',{},{timeout:60000});
 observations.push({stage:'repeat large load',loadMs:Date.now()-repeatStarted,data:await world.evaluate(element=>({...element.dataset}))});
 const saved=await page.evaluate(async()=>{
  const moduleUrl=part=>{const url=performance.getEntriesByType('resource').map(entry=>entry.name).findLast(name=>name.includes(`/src/${part}.ts`));if(!url)throw new Error(`Missing active module ${part}`);return url;};
  const {prepareScenario,cancelScenarioPreparation}=await import(moduleUrl('scenarioPreparation'));
  const {currentScenario}=await import(moduleUrl('scenarioRuntime'));
  const custom=structuredClone(currentScenario);custom.topology.services[0].name+=' saved layout check';
  const first=[],second=[];
  const model=await prepareScenario(custom,message=>first.push(message));
  custom.state.consumerGroups[custom.topology.consumerGroups[0].id].lag+=100;
  const reused=await prepareScenario(custom,message=>second.push(message));
  const cancelled=prepareScenario(custom,()=>{});cancelScenarioPreparation();let cancellation;
  try{await cancelled;throw new Error('Cancelled job returned a model');}catch(error){cancellation=error.message;if(cancellation!=='City preparation cancelled.')throw error;}
  return {first,second,cancellation,unchangedRoads:JSON.stringify(model.cityRoutes.map(route=>route.points))===JSON.stringify(reused.cityRoutes.map(route=>route.points))};
 });
 assert.ok(saved.first.some(message=>message.startsWith('Calculating roads')));assert.ok(saved.second.includes('Reusing saved roads and bridges…'));assert.ok(saved.unchangedRoads);
 observations.push({stage:'persistent layout, state update and worker cancellation',data:saved});
 for(const observation of observations){if(observation.data.tileBytes)assert.ok(Number(observation.data.tileBytes)<=96*1024*1024);if(observation.data.assetBytes)assert.ok(Number(observation.data.assetBytes)<=160*1024*1024);}
 assert.deepEqual(errors,[],'Browser errors must be resolved');assert.deepEqual(warnings,[],'Browser warnings must be resolved');
 const result={geometry,observations,errors,warnings,mockedData:'none',exampleData:'built-in simulated Kafka topology and state'};
 await writeFile('discussions/kafka-city/large-city-browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){console.error(JSON.stringify({error:String(error),errors,warnings,observations}));await page.screenshot({path:resolve('discussions/kafka-city/large-city-failure.png')});throw error;}
finally{await browser.close();}
