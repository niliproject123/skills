// Shared strict validation for stored scenarios and reported Kafka placement.
export function validateClusterTopology(cluster,topics,fail){
 const object=(value,path)=>{if(!value||typeof value!=='object'||Array.isArray(value))fail(path,'expected an object');};
 const fields=(value,allowed,path)=>{for(const key of Object.keys(value))if(!allowed.includes(key))fail(path,`unknown field ${key}`);};
 const text=(value,path,id=false)=>{if(typeof value!=='string'||!value.trim()||value.length>80||(id&&!/^[A-Za-z][\w.-]*$/.test(value)))fail(path,'expected nonempty text up to 80 characters'+(id?' using a stable letter-prefixed ID':''));};
 const integer=(value,path,min,max)=>{if(!Number.isSafeInteger(value)||value<min||value>max)fail(path,`expected an integer from ${min} to ${max}`);};
 if(cluster!==undefined){object(cluster,'cluster');if(!Array.isArray(cluster.brokers)||cluster.brokers.length>64)fail('cluster.brokers','expected at most 64 brokers');if(cluster.placementMode!==undefined&&!['demo','reported'].includes(cluster.placementMode))fail('cluster.placementMode','expected demo or reported');}
 const brokers=cluster?.brokers??[],brokerIds=new Set();
 for(const broker of brokers){object(broker,'broker');fields(broker,['id','name','rack','zone'],'broker');text(broker.id,'broker.id',true);text(broker.name,'broker.name');if(brokerIds.has(broker.id))fail('broker.id',`duplicate broker ${broker.id}`);brokerIds.add(broker.id);for(const key of ['rack','zone'])if(broker[key]!==undefined)text(broker[key],`broker.${key}`);}
 const references=(values,path)=>{if(!Array.isArray(values)||values.length>32||new Set(values).size!==values.length)fail(path,'expected at most 32 distinct broker IDs');for(const id of values)if(!brokerIds.has(id))fail(path,`unknown broker ${String(id)}`);};
 for(const topic of topics){
  const path=`topic ${topic.id}`;
  if(topic.replicationFactor!==undefined)integer(topic.replicationFactor,`${path}.replicationFactor`,1,32);
  if(topic.partitions===undefined)continue;
  if(!Array.isArray(topic.partitions)||topic.partitions.length>topic.partitionCount)fail(`${path}.partitions`,'expected at most partitionCount placement records');
  const seen=new Set();
  for(const partition of topic.partitions){
   object(partition,`${path}.partition`);fields(partition,['partitionId','leaderBrokerId','replicaBrokerIds','inSyncReplicaBrokerIds'],`${path}.partition`);
   integer(partition.partitionId,`${path}.partitionId`,0,topic.partitionCount-1);if(seen.has(partition.partitionId))fail(path,`duplicate partition P${partition.partitionId}`);seen.add(partition.partitionId);
   const name=`${path}/P${partition.partitionId}`;references(partition.replicaBrokerIds,`${name}.replicaBrokerIds`);
   if(!partition.replicaBrokerIds.length)fail(name,'an explicit placement must contain at least one replica');
   if(partition.leaderBrokerId!==null&&!partition.replicaBrokerIds.includes(partition.leaderBrokerId))fail(`${name}.leaderBrokerId`,'expected a member of the replica set or null (unknown/no elected leader)');
   if(partition.inSyncReplicaBrokerIds!==null){references(partition.inSyncReplicaBrokerIds,`${name}.inSyncReplicaBrokerIds`);for(const id of partition.inSyncReplicaBrokerIds)if(!partition.replicaBrokerIds.includes(id))fail(name,`ISR broker ${id} is not a replica`);}
  }
 }
}
