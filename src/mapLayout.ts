import {planTopicNetwork} from './topicNetwork';
import type {TopologyModel,LayoutModel,Route} from './scenarioTypes';
import {buildLayout,routePoints} from './scenarioLayout';
import {automaticOverpasses} from './autoRouting';
import {automaticSpatialLayout,spatialLayout,rememberSpatialLayout} from './spatialLayout';
import {RoadLayoutConflict} from './roadLayoutConflict';
export function computeLayout(topology:TopologyModel,overrides:LayoutModel){
 if(!automaticSpatialLayout(overrides))return routeLayout(topology,overrides);
 let conflict:RoadLayoutConflict|undefined;
 // Constraint search: each candidate retains all routing rules. Never render
 // a partial layout or relax clearance to accept an unsuccessful candidate.
 for(const expansion of [1,1.15,1.35,1.6]){
  const candidate=spatialLayout(topology,overrides,expansion);
  try{const layout=routeLayout(topology,candidate);rememberSpatialLayout(topology,overrides,candidate);return layout;}catch(error){
   if(!(error instanceof RoadLayoutConflict))throw error;
   conflict=error;
  }
 }
 throw new Error(`Automatic layout could not fit all roads after four corridor allocations. ${conflict?.message} Reduce topic fan-out or provide a manual layout.`);
}
function routeLayout(topology:TopologyModel,overrides:LayoutModel){
 const config={topology,layout:overrides},{buildings,terminals}=buildLayout(config),routes:Route[]=[];
 topology.topics.forEach((topic,topicIndex)=>{const sources=topology.producers.filter(producer=>producer.topicId===topic.id),groups=topology.consumerGroups.filter(group=>group.topicIds.includes(topic.id));
 const sharedPaths=planTopicNetwork(config,terminals,topic.id,routes);
 const add=(sourceId:string|undefined,receiverId:string,outgoing=false)=>{const receiver=terminals.find(terminal=>terminal.id===receiverId)!;const producer=sourceId?terminals.find(terminal=>terminal.id===sourceId):undefined,id=`${sourceId??'external'}/${outgoing?'outgoing':receiverId}`;routes.push({id,topic:topic.id,destination:receiver.service,terminal:receiverId,lanes:topic.partitionCount,points:routePoints(config,topic.id,producer,receiver,id,topicIndex,routes,sharedPaths),moving:0,queue:0,consumeEvery:1,laneTraffic:Array(topic.partitionCount).fill(0),queueLanes:Array(topic.partitionCount).fill(0)});};
 for(const group of groups)for(const source of sources.length?sources:[undefined])add(source?.id,group.id);if(!groups.length)for(const source of sources)add(source.id,source.id,true);
 });
 return {buildings,terminals,routes,overpasses:automaticOverpasses(config,routes,terminals)};
}
