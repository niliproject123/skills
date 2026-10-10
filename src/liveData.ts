import type {MapSnapshot} from '../shared/mapProtocol.mjs';
import {defaultScenario} from './scenarioDefault';
import type {ScenarioConfig} from './scenarioTypes';
export let liveSnapshot:MapSnapshot|null=null;
export let measurementRevision=0;
export function setLiveSnapshot(snapshot:MapSnapshot|null){liveSnapshot=snapshot;measurementRevision++;}
export function scenarioFromSnapshot(snapshot:MapSnapshot,previous?:ScenarioConfig):ScenarioConfig{
 const visualization=structuredClone(previous?.visualization??defaultScenario.visualization);visualization.serviceStyles={};
 const cluster={brokers:structuredClone(snapshot.cluster.brokers??[]),placementMode:'reported' as const};
 const retained=previous?.visualization.topicColors??{},palette=['#de7952','#798fcd','#67a981','#bd83bc','#c9a65b','#669eae'];
 visualization.topicColors=Object.fromEntries(snapshot.topology.topics.filter(topic=>retained[topic.id]).map(topic=>[topic.id,retained[topic.id]]));
 for(const topic of snapshot.topology.topics)if(!visualization.topicColors[topic.id]){const used=Object.values(visualization.topicColors),color=palette.find(value=>!used.includes(value))??palette[used.length%palette.length];visualization.topicColors[topic.id]=color;}
 return {version:1,metadata:{id:snapshot.cluster.id,name:snapshot.cluster.name},topology:{...structuredClone(snapshot.topology),producers:snapshot.topology.producers.map(item=>({...item,producerCount:Math.max(1,item.producerCount)})),consumerGroups:snapshot.topology.consumerGroups.map(item=>({...item,consumerCount:Math.max(1,item.consumerCount)}))},layout:{services:{},terminals:{},topics:{},routes:{},overpasses:[]},visualization,state:{
  // Zero here suppresses unmeasured traffic; the UI reads the nullable actual
  // measurements below and never presents this rendering value as measured.
  topics:Object.fromEntries(snapshot.topology.topics.map(item=>[item.id,{messagesPerSecond:snapshot.metrics.topics[item.id].messagesPerSecond??0}])),
  consumerGroups:Object.fromEntries(snapshot.topology.consumerGroups.map(item=>[item.id,{consumptionRate:snapshot.metrics.consumerGroups[item.id].consumptionRate??0,lag:snapshot.metrics.consumerGroups[item.id].lag??0}]))
 },cluster};
}
export function measuredLag(id:string,demoValue:number){return liveSnapshot?liveSnapshot.metrics.consumerGroups[id]?.lag??null:demoValue;}
