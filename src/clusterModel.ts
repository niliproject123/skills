import type {ClusterModel,ScenarioConfig,PartitionPlacement,Broker,TopologyModel} from './scenarioTypes';
const location=(broker:Broker)=>JSON.stringify([broker.zone??'',broker.rack??'']);
export const placementStart=(topicId:string)=>[...topicId].reduce((value,letter)=>(value*31+letter.charCodeAt(0))>>>0,0);
export function demoPartitionPlacement(brokers:Broker[],partitionCount:number,replicationFactor:number,startOffset=0):PartitionPlacement[]{
 if(!Number.isInteger(partitionCount)||partitionCount<1||partitionCount>32)throw new Error('Demo partition count must be an integer from 1 to 32.');
 if(!Number.isInteger(replicationFactor)||replicationFactor<1||replicationFactor>32)throw new Error('Demo replication factor must be an integer from 1 to 32.');
 if(replicationFactor>brokers.length)throw new Error(`Demo replication factor ${replicationFactor} exceeds ${brokers.length} configured brokers.`);
 const ordered=brokers.slice().sort((a,b)=>a.id.localeCompare(b.id));
 return Array.from({length:partitionCount},(_,partitionId)=>{
  const candidates=ordered.map((_,index)=>ordered[(index+partitionId+startOffset)%ordered.length]),chosen:Broker[]=[];
  const separation=(broker:Broker)=>broker.zone??broker.rack??'';
  for(const broker of candidates)if(!chosen.some(value=>separation(value)===separation(broker))&&chosen.length<replicationFactor)chosen.push(broker);
  for(const broker of candidates)if(!chosen.some(value=>location(value)===location(broker))&&chosen.length<replicationFactor)chosen.push(broker);
  for(const broker of candidates)if(!chosen.includes(broker)&&chosen.length<replicationFactor)chosen.push(broker);
  const replicas=chosen.map(broker=>broker.id);
  return {partitionId,leaderBrokerId:replicas[0],replicaBrokerIds:replicas,inSyncReplicaBrokerIds:replicas.slice()};
 });
}
export function deriveCluster(config:ScenarioConfig):ClusterModel{
 const brokers=structuredClone(config.cluster?.brokers??[]),placementMode=config.cluster?.placementMode??'demo';
 const partitions=Object.fromEntries(config.topology.topics.map(topic=>[topic.id,topic.partitions!==undefined?structuredClone(topic.partitions):placementMode==='demo'&&brokers.length&&topic.replicationFactor!==undefined?demoPartitionPlacement(brokers,topic.partitionCount,topic.replicationFactor,placementStart(topic.id)):[]]));
 return {brokers,partitions,placementMode};
}
// Physical storage state never participates in application road layout keys.
export function applicationTopology(topology:TopologyModel):TopologyModel{
 return {...topology,topics:topology.topics.map(({id,name,partitionCount})=>({id,name,partitionCount}))};
}
