import {runEditorChecks} from './editor-checks.mjs';
import {runScenarioChecks} from './scenario-checks.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';

// Execute the actual application modules. No mocked modules or test data.
const temporaryDirectory=await mkdtemp(join(tmpdir(),'kafka-city-check-'));
try {
 await writeFile(join(temporaryDirectory,'package.json'),'{"type":"module"}');
 for(const name of ['model','isometric','cityLayout','CitySimulation','canvasPicking','terminalPicking','kafkaTopology','terminalLayout','canvasCamera','roadGeometry','laneGeometry','roadMesh','campusGeometry','buildingFeatures','signAnchors','terminalConnection','topicTheme','scenarioTypes','scenarioDefault','scenarioValidation','scenarioEncoding','scenarioLayout','autoLayout','autoRouting','mapLayout','labelGeometry','scenarioActions','scenarioDerive','scenarioRuntime','scenarioPresets']) {
 const source=await readFile(resolve('src',`${name}.ts`),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
 await writeFile(join(temporaryDirectory,`${name}.js`),compiled);
 }
 const {project}=await import(pathToFileURL(join(temporaryDirectory,'isometric.js')));
 const {cityRoutes,cityBuildings,roadSegments,routeLength,onRoute}=await import(pathToFileURL(join(temporaryDirectory,'cityLayout.js')));
 const {CitySimulation,trafficUnits}=await import(pathToFileURL(join(temporaryDirectory,'CitySimulation.js')));
 const {pick}=await import(pathToFileURL(join(temporaryDirectory,'canvasPicking.js')));
 const {terminals,terminalById,roadElevation}=await import(pathToFileURL(join(temporaryDirectory,'terminalLayout.js')));
 const {partitionLoads,consumerGroups}=await import(pathToFileURL(join(temporaryDirectory,'kafkaTopology.js')));
 const {connectionLength}=await import(pathToFileURL(join(temporaryDirectory,'terminalConnection.js')));
 const {roadFootprint,roadJoint}=await import(pathToFileURL(join(temporaryDirectory,'roadGeometry.js')));
 const gate=project(507.5,280,20);
 assert.deepEqual(pick(gate.x,gate.y),{kind:'terminal',name:'Payment',id:'payment-orders',producer:false,topic:'orders'});
 const yard=project(545,330);
 assert.equal(pick(yard.x,yard.y)?.id,'payment-orders','The receiving apron must select its consumer group');
 const roof=project(515,155,120);
 assert.deepEqual(pick(roof.x,roof.y),{kind:'service',name:'Payment'});
 const road=project(330,400);
 assert.deepEqual(pick(road.x,road.y),{kind:'topic',name:'orders'});
 assert.equal(pick(1400,900),null);
 assert.deepEqual(project(100,0),{x:100,y:50});
 assert.deepEqual(project(0,100),{x:-100,y:50});
 assert.deepEqual(project(100,100,80),{x:0,y:20});
 for(const topic of ['orders','payments']) for(const segment of roadSegments(topic)) {
 assert.ok(segment.from.u===segment.to.u||segment.from.v===segment.to.v,'Roads must follow isometric ground axes');
 assert.equal(segment.lanes,topic==='orders'?4:2);
 }

 // Actual paved footprints must not run beneath any solid building or depot.
 for(const topic of ['orders','payments'])for(const segment of roadSegments(topic)){
 const shapes=[roadFootprint(segment.from,segment.to,segment.lanes),...(segment.join?[roadJoint(segment.to,segment.lanes)]:[])];
 for(const footprint of shapes){const left=Math.min(...footprint.map(point=>point[0])),right=Math.max(...footprint.map(point=>point[0])),back=Math.min(...footprint.map(point=>point[1])),front=Math.max(...footprint.map(point=>point[1]));
 for(const building of [...Object.values(cityBuildings),...terminals])assert.ok(!(left<building.u+building.width&&right>building.u&&back<building.v+building.depth&&front>building.v),`A ${topic} road intersects a solid building footprint`);
 }
 }
 for(const segment of roadSegments('payments'))if(segment.from.v===segment.to.v&&segment.from.v>600&&(segment.from.u===745||segment.to.u===745))assert.ok(segment.from.v>=840,'Bridge landing requires at least 60 ground units before a turn');
 assert.deepEqual([620,675,725,780].map(v=>roadElevation('payments',745,v)),[0,48,48,0]);
 const branch=cityRoutes[1].points[0];
 assert.ok(roadSegments('orders').some(segment=>segment.from.v===branch.v&&segment.to.v===branch.v&&segment.from.u<=branch.u&&segment.to.u>=branch.u),'Analytics must branch from the shared orders trunk');
 assert.deepEqual(cityRoutes.map(route=>route.queue),[0,5,0,14,0]);
 assert.equal(terminals.length,7);
 assert.equal(consumerGroups.length,4);
 assert.deepEqual(terminals.map(terminal=>terminal.instances).sort(),[1,1,2,2,2,3,4]);
 assert.equal(roadElevation('payments',745,700),48);
 assert.equal(roadElevation('orders',745,700),0);
 for(const unit of trafficUnits){const load=partitionLoads[cityRoutes[unit.route].topic][unit.partition];assert.equal(unit.kind,load.kind);assert.equal(unit.trailers,load.trailers);}
 assert.equal(consumerGroups.filter(group=>group.service==='Analytics').length,2);
 assert.equal(new Set(terminals.filter(terminal=>terminal.service==='Orders'&&terminal.producer).flatMap(terminal=>terminal.topics)).size,2);
 const longSemi=trafficUnits.find(unit=>unit.route===0&&!unit.waiting&&unit.partition===3);
 const turningSimulation=new CitySimulation();let trailerTurnsSeparately=false;
 for(let step=0;step<1200;step++){turningSimulation.advance(.05);const head=turningSimulation.position(longSemi),trailer=turningSimulation.position(longSemi,38);if(head.visible&&trailer.visible&&head.direction!==trailer.direction){trailerTurnsSeparately=true;break;}}
 assert.ok(trailerTurnsSeparately,'Trailer samples must follow the previous road segment through a bend');
 for(const topic of ['orders','payments'])assert.ok(cityRoutes.filter(route=>route.topic===topic).reduce((sum,route)=>sum+route.moving+route.queue,0)<=50,'Default topic traffic must stay within its visual cap');
 for(const route of cityRoutes){
 const endpoint=onRoute(route.points,routeLength(route.points)),terminal=terminalById(route.terminal);
 assert.equal(endpoint.v,terminal.v+terminal.depth,'Receiving path ends at the consumer terminal, not the service building');
 const approach=roadSegments(route.topic).find(segment=>segment.to.u===endpoint.u&&segment.to.v===endpoint.v+connectionLength);
 assert.ok(approach&&approach.to.v-endpoint.v>=50,'Asphalt must stop before a separate apron and driveway');
 }
 const simulation=new CitySimulation();
 for(let step=0;step<1200;step++){
 simulation.advance(.05);
 for(const unit of trafficUnits){const point=simulation.position(unit);assert.ok([point.x,point.y,point.depth].every(Number.isFinite));assert.ok(['east','west','south','north'].includes(point.direction));}
 }
 const queued=trafficUnits.find(unit=>unit.waiting&&unit.waiting&&cityRoutes[unit.route].terminal==='notification-delivery'&&unit.index===4);
 const before=new CitySimulation();before.advance(4.999);const beforePosition=before.position(queued);
 const after=new CitySimulation();after.advance(5.001);const afterPosition=after.position(queued);
 assert.ok(Math.hypot(afterPosition.x-beforePosition.x,afterPosition.y-beforePosition.y)<1,'Waiting vehicles advance continuously across a consumption cycle');
 const {roadCurves,roadBranches}=await import(pathToFileURL(join(temporaryDirectory,'roadMesh.js')));
 const {serviceSignAnchor}=await import(pathToFileURL(join(temporaryDirectory,'signAnchors.js')));
 for(const topic of ['orders','payments']){
 const curves=roadCurves(roadSegments(topic));assert.ok(curves.length>0);
 for(const curve of curves){assert.ok(curve.points.every(point=>Number.isFinite(point.u)&&Number.isFinite(point.v)));assert.ok(curve.points.some((point,index)=>index&&point.u!==curve.points[index-1].u&&point.v!==curve.points[index-1].v),'Road corners must contain continuous curved geometry');}
 }
 assert.ok(roadBranches(roadSegments('orders')).length>0,'Shared topic branches must have reusable junction geometry');
 for(const [id,building] of Object.entries(cityBuildings)){
 const anchor=serviceSignAnchor(id),ground=project(anchor.u,anchor.v),left=project(building.u,building.v+building.depth);
 assert.ok(anchor.u>building.u+building.width,'The dedicated ground anchor must sit at the campus side edge');assert.ok(ground.y-anchor.rise<project(building.u,building.v,180).y,'The sign must sit above the building');
 }
 const {applyScenario,currentScenario}=await import(pathToFileURL(join(temporaryDirectory,'scenarioRuntime.js')));
 const {createPreset}=await import(pathToFileURL(join(temporaryDirectory,'scenarioPresets.js')));
 const original=structuredClone(currentScenario);applyScenario(createPreset('High throughput'));
 const {makeTrafficUnits}=await import(pathToFileURL(join(temporaryDirectory,'CitySimulation.js')));
 const linkedSimulation=new CitySimulation(),articulated=makeTrafficUnits(cityRoutes).filter(unit=>unit.kind==='semi');assert.ok(articulated.some(unit=>unit.trailers>1));
 let checkedLinks=0;
 for(let step=0;step<120;step++){linkedSimulation.advance(.5);for(const unit of articulated){const chain=linkedSimulation.chain(unit);assert.equal(chain.length,unit.trailers+1);for(let index=1;index<chain.length;index++){const a=chain[index-1],b=chain[index];if(!a.visible||!b.visible)continue;assert.ok(Math.abs(a.pathDistance-b.pathDistance-(index===1?38:46))<.001,'Segments must maintain fixed spacing along one continuous lane path');assert.ok(Number.isFinite(b.heading));checkedLinks++;}}}
 assert.ok(checkedLinks>100,'Actual high-throughput articulated traffic must exercise the linkage');applyScenario(original);
 console.log('PASS: curved road ribbons, shared branch geometry, linked multi-trailer axle spacing and dedicated campus-edge sign anchors. Mocked data: none.');
 await runScenarioChecks(name=>pathToFileURL(join(temporaryDirectory,`${name}.js`)));
 await runEditorChecks(name=>pathToFileURL(join(temporaryDirectory,`${name}.js`)));
 console.log(`PASS: strict 2:1 projection, axis-aligned partition roads, shared branch, bay endpoints, ${trafficUnits.length} vehicles over 60 simulated seconds, continuous queue advancement.`);
 console.log('Mocked data: none. Checks use the application’s explicitly simulated demo topology.');
} finally {
 assert.equal(dirname(resolve(temporaryDirectory)),resolve(tmpdir()),'Cleanup must stay inside the expected temporary directory');
 assert.ok(basename(temporaryDirectory).startsWith('kafka-city-check-'),'Cleanup must target this test run');
 await rm(temporaryDirectory,{recursive:true});
}
