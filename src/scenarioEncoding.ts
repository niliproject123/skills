import type {PartitionVisual,ScenarioConfig,VisualEncodingConfig} from './scenarioTypes';
export function partitionRates(total:number,count:number,overrides:Record<string,number>={}):number[]{
 const assigned=Object.values(overrides).reduce((sum,rate)=>sum+rate,0),remaining=count-Object.keys(overrides).length;
 return Array.from({length:count},(_,index)=>overrides[String(index)]!==undefined?overrides[String(index)]:(total-assigned)/remaining);
}
export function encodePartition(rate:number,index:number,visual:VisualEncodingConfig):PartitionVisual {
 const kind=rate<=visual.thresholds.car?'car':rate<=visual.thresholds.van?'van':rate<=visual.thresholds.truck?'truck':'semi';
 const extra=kind==='semi'&&rate>visual.thresholds.semi?Math.min(Math.max(0,visual.maxTrailers-1),Math.max(1,Math.ceil((rate-visual.vehicles.semi.messagesPerVehicle)/visual.vehicles.trailer.messagesPerTrailer))):0;
 const capacity=visual.vehicles[kind].messagesPerVehicle+extra*visual.vehicles.trailer.messagesPerTrailer;
 return {id:index,rate,kind,trailers:kind==='semi'?1+extra:0,messagesPerVehicle:capacity,frequency:rate===0?0:Math.max(.2,Math.min(2,rate/capacity))};
}
export function snapshotPartitions(config:ScenarioConfig){return Object.fromEntries(config.topology.topics.map(topic=>[topic.id,partitionRates(config.state.topics[topic.id].messagesPerSecond,topic.partitionCount,config.state.topics[topic.id].partitionOverrides).map((rate,index)=>encodePartition(rate,index,config.visualization))]));}
export function tint(hex:string,factor:number){const channels=[1,3,5].map(start=>parseInt(hex.slice(start,start+2),16));return '#'+channels.map(channel=>Math.round(factor<0?channel*(1+factor):channel+(255-channel)*factor).toString(16).padStart(2,'0')).join('');}
export function automaticColor(id:string){let hash=0;for(const character of id)hash=(hash*31+character.charCodeAt(0))>>>0;return ['#de7952','#798fcd','#66a887','#b889c0','#c9a65b','#669eae'][hash%6];}

export function groupSnapshot(config:ScenarioConfig,topicIds:string[],consumptionRate:number){const incomingRate=topicIds.reduce((sum,id)=>sum+config.state.topics[id].messagesPerSecond,0);return {incomingRate,status:consumptionRate>incomingRate?'catching up' as const:consumptionRate<incomingRate?'falling behind' as const:'stable' as const};}
