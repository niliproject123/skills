import type {Selection,StorageSelection} from './model';
import type {ScenarioConfig} from './scenarioTypes';
import {renderModel} from './scenarioRuntime';
import {liveSnapshot} from './liveData';
export function ClusterInspector({configuration,selection,onSelect}:{configuration:ScenarioConfig;selection:StorageSelection;onSelect:(selection:Selection|null)=>void}){
 const cluster=renderModel.cluster,brokerName=(id:string)=>cluster.brokers.find(broker=>broker.id===id)?.name??id,rows:[string,string][]=[];
 let title='';
 if(selection.kind==='partition'){
  const topic=configuration.topology.topics.find(topic=>topic.id===selection.name),partition=cluster.partitions[selection.name]?.find(partition=>partition.partitionId===selection.partitionId);
  title=`${topic?.name??selection.name} / P${selection.partitionId}`;
  rows.push(['Leader',partition?.leaderBrokerId?brokerName(partition.leaderBrokerId):'Unknown / no elected leader'],['Replica set',partition?partition.replicaBrokerIds.map(brokerName).join(', '):'Unknown'],['ISR',partition?.inSyncReplicaBrokerIds?.map(brokerName).join(', ')??'Unknown'],['Replication factor',partition?String(partition.replicaBrokerIds.length):topic?.replicationFactor?`${topic.replicationFactor} (configured; placement unknown)`:'Unknown']);
 }else{
  const broker=cluster.brokers.find(broker=>broker.id===selection.name),partitions=Object.values(cluster.partitions).flat().filter(partition=>partition.replicaBrokerIds.includes(selection.name));
  title=broker?.name??selection.name;
  rows.push(['Broker ID',selection.name],['Rack',broker?.rack??'Not supplied'],['Availability zone',broker?.zone??'Not supplied'],['Hosted replicas',String(partitions.length)],['Leaders',String(partitions.filter(partition=>partition.leaderBrokerId===selection.name).length)]);
  const total=configuration.topology.topics.reduce((sum,topic)=>sum+topic.partitionCount,0),reported=Object.values(cluster.partitions).flat().length;
  if(reported<total)rows.push(['Placement coverage',`${reported} of ${total} partitions; counts cover known placements`]);
 }
 if(liveSnapshot)rows.push(['Observed',new Date(liveSnapshot.observedAt).toLocaleString()],['Sequence',String(liveSnapshot.sequence)]);
 return <section className="object-configuration cluster-inspector" aria-label="Cluster item inspector"><div className="scenario-heading"><h2>{title}</h2><button aria-label="Close cluster inspector" onClick={()=>onSelect(null)}>×</button></div><div className="scenario-content"><section className="object-values"><p className="scenario-help">{liveSnapshot?'Reported Kafka placement.':'Simulated example placement.'} Flag = leader; unflagged = follower; dim = outside ISR.</p><dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Empty set'}</dd></div>)}</dl></section>{selection.kind==='partition'&&<button onClick={()=>onSelect({kind:'topic',name:selection.name})}>Select whole topic</button>}</div></section>;
}
