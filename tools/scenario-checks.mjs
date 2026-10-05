import assert from 'node:assert/strict';
export async function runScenarioChecks(moduleUrl){
 const {defaultScenario}=await import(moduleUrl('scenarioDefault'));
 const {validateScenario}=await import(moduleUrl('scenarioValidation'));
 const {deriveScenario}=await import(moduleUrl('scenarioDerive'));
 const {partitionRates,encodePartition}=await import(moduleUrl('scenarioEncoding'));
 const {presetNames,createPreset}=await import(moduleUrl('scenarioPresets'));
 const {applyScenario,renderModel}=await import(moduleUrl('scenarioRuntime'));
 const {CitySimulation,makeTrafficUnits}=await import(moduleUrl('CitySimulation'));
 assert.deepEqual(validateScenario(JSON.parse(JSON.stringify(defaultScenario))),defaultScenario,'Scenario JSON must round-trip');
 assert.deepEqual(partitionRates(10000,4),[2500,2500,2500,2500]);
 assert.deepEqual(partitionRates(10000,4,{'3':5500}),[1500,1500,1500,5500]);
 assert.deepEqual(partitionRates(10000,4,{'1':2000,'3':6000}),[1000,2000,1000,6000]);
 const invalid=structuredClone(defaultScenario);invalid.state.topics.orders.partitionOverrides={'3':10001};assert.throws(()=>validateScenario(invalid),/exceed/);
 invalid.state.topics.orders.partitionOverrides={'6':500};assert.throws(()=>validateScenario(invalid),/valid partition/);
 invalid.state.topics.orders.partitionOverrides={'0':100,'1':100,'2':100,'3':100};assert.throws(()=>validateScenario(invalid),/sum to/);
 const missing=structuredClone(defaultScenario);missing.topology.consumerGroups[0].serviceId='missing';assert.throws(()=>validateScenario(missing),/unknown reference/);
 const thresholds=structuredClone(defaultScenario);thresholds.visualization.thresholds.van=50;assert.throws(()=>validateScenario(thresholds),/strictly increase/);
 const checkCaps=model=>{
 assert.ok(model.cityRoutes.reduce((sum,route)=>sum+route.moving+route.queue,0)<=model.visualization.maxVehiclesTotal);
 for(const topic of Object.keys(model.topics)){const routes=model.cityRoutes.filter(route=>route.topic===topic);assert.ok(routes.reduce((sum,route)=>sum+route.moving+route.queue,0)<=model.visualization.maxVehiclesPerTopic);for(let partition=0;partition<model.topics[topic].partitions;partition++)assert.ok(routes.reduce((sum,route)=>sum+route.laneTraffic[partition]+route.queueLanes[partition],0)<=model.visualization.maxVehiclesPerLane);}
 for(const group of model.consumerGroups)assert.ok(group.waiting<=model.visualization.maxQueueVehicles);
 for(const loads of Object.values(model.partitionLoads))for(const load of loads)assert.ok(load.trailers<=model.visualization.maxTrailers);
 };
 for(const name of presetNames){const config=createPreset(name),model=deriveScenario(config);checkCaps(model);assert.deepEqual(config.state,createPreset(name).state,'Derivation must not mutate snapshot state');}
 const normal=deriveScenario(createPreset('Normal'));assert.ok(normal.consumerGroups.every(group=>group.waiting===0));
 const hot=deriveScenario(createPreset('Hot partition'));assert.equal(hot.partitionLoads.orders[3].rate,8500);assert.equal(hot.partitionLoads.orders[0].rate,500);
 const recovering=deriveScenario(createPreset('Recovering consumer')).consumerGroups.find(group=>group.id==='notification-delivery');assert.equal(recovering.lag,50000);assert.equal(recovering.status,'catching up');assert.ok(recovering.waiting>0);
 const behind=deriveScenario(createPreset('Consumer lag')).consumerGroups.find(group=>group.id==='notification-delivery');assert.equal(behind.lag,100000);assert.equal(behind.status,'falling behind');
 const base=deriveScenario(defaultScenario),modified=structuredClone(defaultScenario);modified.topology.topics.find(topic=>topic.id==='orders').partitionCount=8;modified.state.topics.orders.partitionOverrides={'6':6500};modified.topology.producers.find(producer=>producer.id==='orders-dispatch').producerCount=12;
 modified.topology.consumerGroups.push({id:'analytics-extra',name:'Extra analytics',serviceId:'Analytics',topicIds:['orders','payments'],consumerCount:3});modified.state.consumerGroups['analytics-extra']={consumptionRate:20000,lag:100000};modified.layout.services.Payment.u+=150;modified.visualization.topicColors.orders='#be5643';modified.visualization.vehicles.truck.messagesPerVehicle=500;modified.visualization.thresholds.truck=1500;modified.visualization.maxTrailers=2;
 const changed=deriveScenario(modified);assert.equal(changed.partitionLoads.orders.length,8);assert.equal(changed.partitionLoads.orders[6].rate,6500);assert.ok(changed.partitionLoads.orders.filter(load=>load.id!==6).every(load=>load.rate===500));assert.equal(changed.terminals.find(terminal=>terminal.id==='orders-dispatch').instances,12);assert.ok(changed.terminals.find(terminal=>terminal.id==='orders-dispatch').depth>base.terminals.find(terminal=>terminal.id==='orders-dispatch').depth);assert.equal(changed.cityBuildings.Payment.u,590);assert.equal(changed.themes.orders.accent,'#be5643');assert.ok(changed.cityRoutes.some(route=>route.terminal==='analytics-extra'&&route.topic==='payments'));checkCaps(changed);
 const countOnly=structuredClone(defaultScenario);countOnly.topology.producers[0].producerCount=12;const moreProducers=deriveScenario(countOnly);assert.deepEqual(moreProducers.partitionLoads,base.partitionLoads);assert.deepEqual(moreProducers.cityRoutes.map(route=>route.laneTraffic),base.cityRoutes.map(route=>route.laneTraffic),'Producer count must not multiply Kafka throughput or traffic');
 assert.deepEqual(encodePartition(2500,0,defaultScenario.visualization),encodePartition(2500,0,createPreset('High throughput').visualization),'The same absolute rate has the same encoding across scenarios');
 const alternate=structuredClone(defaultScenario);alternate.metadata={id:'alternate',name:'Different topology'};alternate.topology={services:[{id:'checkout',name:'Checkout'},{id:'mail',name:'Mail'}],topics:[{id:'events',name:'events',partitionCount:3},{id:'metrics',name:'metrics',partitionCount:1}],producers:[{id:'checkout-events',serviceId:'checkout',topicId:'events',producerCount:8}],consumerGroups:[{id:'mail-events',name:'Delivery group',serviceId:'mail',topicIds:['events','metrics'],consumerCount:3}]};alternate.state={topics:{events:{messagesPerSecond:900},metrics:{messagesPerSecond:75}},consumerGroups:{'mail-events':{consumptionRate:0,lag:17000}}};alternate.layout={services:{},terminals:{},topics:{},routes:{},overpasses:[]};alternate.visualization.topicColors={events:'#c67854',metrics:'#607ecc'};alternate.visualization.serviceStyles={};
 const alternateModel=deriveScenario(alternate);assert.equal(alternateModel.cityRoutes.length,2,'Subscriptions establish connectivity without manual roads');assert.equal(alternateModel.consumerGroups[0].lag,17000);assert.equal(alternateModel.consumerGroups[0].consumptionRate,0);checkCaps(alternateModel);
 applyScenario(alternate);const units=makeTrafficUnits(renderModel.cityRoutes),simulation=new CitySimulation();for(let step=0;step<300;step++){simulation.advance(.05);for(const unit of units){const position=simulation.position(unit);assert.ok([position.x,position.y,position.depth].every(Number.isFinite),'Arbitrary IDs and one-partition topics must animate without NaN');}}assert.equal(alternate.state.consumerGroups['mail-events'].lag,17000,'Animation must not modify the snapshot');
 const idle=structuredClone(alternate);idle.topology.topics=[];idle.topology.producers=[];idle.topology.consumerGroups=[];idle.state={topics:{},consumerGroups:{}};idle.visualization.topicColors={};assert.equal(deriveScenario(idle).cityRoutes.length,0);
 const invalidJson={...alternate,state:undefined};assert.throws(()=>validateScenario(invalidJson),/state/);assert.equal(renderModel.services.checkout.name,'Checkout','Invalid input must not replace the installed model');
 applyScenario(defaultScenario);
 console.log('PASS: snapshot configuration, partition overrides, all presets, absolute encoding, explicit lag/status, traffic caps, 8 partitions, 12 producers, arbitrary topology and zero-consumption animation. Mocked data: none.');
}
