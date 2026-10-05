import {labelAnchors} from './labelGeometry';
import {computeLayout} from './mapLayout';
import type {ScenarioConfig,DerivedRenderModel,Route} from './scenarioTypes';
import {automaticColor,snapshotPartitions,tint,groupSnapshot} from './scenarioEncoding';
import {worldGeometry} from './scenarioLayout';
import {validateScenario} from './scenarioValidation';
export function deriveScenario(input:ScenarioConfig):DerivedRenderModel {
 const config=validateScenario(input),visual=config.visualization,partitionLoads=snapshotPartitions(config),layout=computeLayout(config.topology,config.layout),{buildings,terminals}=layout;
 const services:DerivedRenderModel['services']={},topics:DerivedRenderModel['topics']={},themes:DerivedRenderModel['themes']={};
 const producers=config.topology.producers.map(producer=>({id:producer.id,service:producer.serviceId,topic:producer.topicId,instances:producer.producerCount}));
 const consumerGroups=config.topology.consumerGroups.map(group=>{const snapshot=config.state.consumerGroups[group.id],facts=groupSnapshot(config,group.topicIds,snapshot.consumptionRate);const capacity=config.visualization.vehicles.truck.messagesPerVehicle;return {id:group.id,name:group.name,service:group.serviceId,topics:group.topicIds,instances:group.consumerCount,lag:snapshot.lag,consumptionRate:snapshot.consumptionRate,incomingRate:facts.incomingRate,status:facts.status,waiting:Math.min(visual.maxQueueVehicles,Math.round(snapshot.lag/visual.messagesPerQueueVehicle)),consumeEvery:snapshot.consumptionRate===0?Infinity:Math.max(.35,Math.min(10,capacity/snapshot.consumptionRate))};});
 for(const service of config.topology.services){const style=visual.serviceStyles[service.id],color=style?.color??automaticColor(service.id),owned=producers.filter(p=>p.service===service.id),groups=consumerGroups.filter(g=>g.service===service.id);services[service.id]={name:service.name,color,palette:style?.palette??[tint(color,.25),color,tint(color,-.3)],art:style?.art??'Office',produces:[...new Set(owned.map(p=>p.topic))],consumes:[...new Set(groups.flatMap(g=>g.topics))],producers:owned.reduce((sum,p)=>sum+p.instances,0),consumers:groups.reduce((sum,g)=>sum+g.instances,0),lag:groups.reduce((sum,g)=>sum+g.lag,0)};}
 const routes:Route[]=[];
 config.topology.topics.forEach((topic,topicIndex)=>{
 const rate=config.state.topics[topic.id].messagesPerSecond,color=visual.topicColors[topic.id]??automaticColor(topic.id),sources=producers.filter(p=>p.topic===topic.id),groups=consumerGroups.filter(g=>g.topics.includes(topic.id));
 topics[topic.id]={name:topic.name,partitions:topic.partitionCount,messagesPerSecond:rate,throughput:(rate/1000).toLocaleString(undefined,{maximumFractionDigits:2})+'k',producers:sources.reduce((sum,p)=>sum+p.instances,0),groups:groups.length};themes[topic.id]={accent:color,front:tint(color,-.2),side:tint(color,-.35),light:tint(color,.6)};
 for(const group of groups)for(const source of sources.length?sources:[undefined]){const receiver=terminals.find(t=>t.id===group.id)!;const producer=source?terminals.find(t=>t.id===source.id):undefined;const key=`${source?.id??'external'}/${group.id}`;routes.push({id:key,topic:topic.id,destination:group.service,terminal:group.id,points:layout.routes.find(route=>route.id===key)!.points,lanes:topic.partitionCount,moving:0,queue:0,consumeEvery:group.consumeEvery,laneTraffic:Array(topic.partitionCount).fill(0),queueLanes:Array(topic.partitionCount).fill(0)});}
 if(!groups.length)for(const source of sources){const terminal=terminals.find(t=>t.id===source.id)!;const key=`${source.id}/outgoing`;routes.push({id:key,topic:topic.id,destination:source.service,terminal:source.id,points:layout.routes.find(route=>route.id===key)!.points,lanes:topic.partitionCount,moving:0,queue:0,consumeEvery:1,laneTraffic:Array(topic.partitionCount).fill(0),queueLanes:Array(topic.partitionCount).fill(0)});}
 });
 if(routes.length>128)throw new Error('Topology exceeds 128 rendered connections. Reduce producer/group fan-out.');
 let total=0;
 for(const topic of config.topology.topics){const connections=routes.filter(route=>route.topic===topic.id),lanes=Array(topic.partitionCount).fill(0);let topicTotal=0;
 // Explicit backlog is compressed independently from incoming/consumption rates.
 for(const group of consumerGroups.filter(group=>group.topics.includes(topic.id))){const route=connections.find(route=>route.terminal===group.id);if(!route)continue;const portion=Math.floor(group.waiting/group.topics.length)+(group.topics.indexOf(topic.id)<group.waiting%group.topics.length?1:0);for(let index=0;index<portion;index++){const lane=index%topic.partitionCount;if(lanes[lane]>=visual.maxVehiclesPerLane||topicTotal>=visual.maxVehiclesPerTopic||total>=visual.maxVehiclesTotal)continue;route.queueLanes[lane]++;route.queue++;lanes[lane]++;topicTotal++;total++;}}
 for(const load of partitionLoads[topic.id]){const desired=load.rate===0?0:Math.max(connections.length,Math.ceil(load.rate*visual.trafficWindowSeconds/load.messagesPerVehicle));for(let index=0;index<desired;index++){if(!connections.length||lanes[load.id]>=visual.maxVehiclesPerLane||topicTotal>=visual.maxVehiclesPerTopic||total>=visual.maxVehiclesTotal)break;const route=connections[index%connections.length];route.laneTraffic[load.id]++;route.moving++;lanes[load.id]++;topicTotal++;total++;}}
 }
 for(const group of consumerGroups)group.waiting=routes.filter(route=>route.terminal===group.id).reduce((sum,route)=>sum+route.queue,0);
 const geometry=worldGeometry(config,buildings,terminals,routes);
 if(geometry.bounds.width*geometry.bounds.height*(config.topology.topics.length+3)*2.25>100000000)throw new Error('Scene exceeds the Canvas cache memory budget. Use a more compact layout or fewer topics.');
 return {labelAnchors:labelAnchors(config,buildings,terminals,routes),services,topics,producers,consumerGroups,partitionLoads,cityBuildings:buildings,terminals,cityRoutes:routes,themes,terrainOutline:geometry.terrain,worldBounds:geometry.bounds,visualization:structuredClone(visual),overpasses:layout.overpasses.map(bridge=>({...bridge,lanes:topics[bridge.topic].partitions,depth:bridge.u+bridge.v+45}))};
}
