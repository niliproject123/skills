// Shared by the HTTP server and browser. No Kafka/provider SDK is required.
import {validateClusterTopology} from './clusterProtocol.mjs';
export class PayloadError extends Error {}
const fail=(path,message)=>{throw new PayloadError(`${path}: ${message}`);};
function object(value,path){if(!value||typeof value!=='object'||Array.isArray(value))fail(path,'expected an object');return value;}
function text(value,path,id=false){if(typeof value!=='string'||!value.trim()||value.length>80||(id&&!/^[A-Za-z][\w.-]*$/.test(value)))fail(path,id?'expected an ID starting with a letter, using letters, digits, dot, underscore or hyphen':'expected nonempty text up to 80 characters');}
function count(value,path,min=0,max=1e12){if(!Number.isSafeInteger(value)||value<min||value>max)fail(path,`expected an integer from ${min} to ${max}`);}
function measurement(value,path,integer=false){if(value===null)return;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>1e12||(integer&&!Number.isSafeInteger(value)))fail(path,'expected a nonnegative finite measurement or null');}
function fields(value,allowed,path){for(const key of Object.keys(value))if(!allowed.includes(key))fail(path,`unknown field ${key}`);}
function entries(value,path,max){if(!Array.isArray(value)||value.length>max)fail(path,`expected an array with at most ${max} entries`);const ids=new Set();for(const entry of value){object(entry,path);text(entry.id,`${path}.id`,true);if(ids.has(entry.id))fail(path,`duplicate ID ${entry.id}`);ids.add(entry.id);}return ids;}
function reference(value,ids,path){if(!ids.has(value))fail(path,`unknown reference ${value}`);}
export function validateMapSnapshot(input,now=Date.now()){
 const snapshot=object(input,'snapshot');fields(snapshot,['version','sequence','cluster','observedAt','topology','metrics','status'],'snapshot');
 if(snapshot.version!==1)fail('version','only version 1 is supported');count(snapshot.sequence,'sequence',1);
 const cluster=object(snapshot.cluster,'cluster');fields(cluster,['id','name','brokers'],'cluster');text(cluster.id,'cluster.id',true);text(cluster.name,'cluster.name');
 const observed=Date.parse(snapshot.observedAt);if(typeof snapshot.observedAt!=='string'||!Number.isFinite(observed)||observed>now+30000||observed<now-86400000)fail('observedAt','expected an ISO timestamp within the last 24 hours and at most 30 seconds in the future');
 const topology=object(snapshot.topology,'topology');fields(topology,['services','topics','producers','consumerGroups'],'topology');
 const services=entries(topology.services,'services',16),topics=entries(topology.topics,'topics',64),producers=entries(topology.producers,'producers',64),groups=entries(topology.consumerGroups,'consumerGroups',64);
 for(const item of topology.services){fields(item,['id','name'],'service');text(item.name,'service.name');}
 for(const item of topology.topics){fields(item,['id','name','partitionCount','replicationFactor','partitions'],'topic');text(item.name,'topic.name');count(item.partitionCount,'partitionCount',1,32);}
 validateClusterTopology(cluster.brokers===undefined?undefined:{brokers:cluster.brokers},topology.topics,fail);
 const pairs=new Set();
 for(const item of topology.producers){fields(item,['id','serviceId','topicId','producerCount'],'producer');reference(item.serviceId,services,'producer.serviceId');reference(item.topicId,topics,'producer.topicId');count(item.producerCount,'producerCount',0,32);const pair=`${item.serviceId}/${item.topicId}`;if(pairs.has(pair))fail('producers','combine duplicate service/topic entries');pairs.add(pair);}
 for(const item of topology.consumerGroups){fields(item,['id','name','serviceId','topicIds','consumerCount'],'consumerGroup');text(item.name,'consumerGroup.name');reference(item.serviceId,services,'consumerGroup.serviceId');if(producers.has(item.id))fail('consumerGroups','producer and group IDs must be distinct');if(!Array.isArray(item.topicIds)||!item.topicIds.length||item.topicIds.length>16||new Set(item.topicIds).size!==item.topicIds.length)fail('topicIds','expected 1–16 distinct topic IDs');for(const id of item.topicIds)reference(id,topics,'consumerGroup.topicIds');count(item.consumerCount,'consumerCount',0,32);}
 const connections=topology.topics.reduce((total,topic)=>{const inputs=topology.producers.filter(p=>p.topicId===topic.id).length,outputs=topology.consumerGroups.filter(g=>g.topicIds.includes(topic.id)).length;return total+(outputs?Math.max(1,inputs)*outputs:inputs);},0);if(connections>128)fail('topology','exceeds 128 rendered connections; send a scoped topology');
 const metrics=object(snapshot.metrics,'metrics');fields(metrics,['topics','consumerGroups'],'metrics');
 for(const [kind,ids] of [['topics',topics],['consumerGroups',groups]]){
  const values=object(metrics[kind],`metrics.${kind}`);for(const id of Object.keys(values))reference(id,ids,`metrics.${kind}`);
  for(const id of ids){const value=object(values[id],`metrics.${kind}.${id}`);text(value.source,`${id}.source`);if(kind==='topics'){fields(value,['messagesPerSecond','averageMessageBytes','source'],id);measurement(value.messagesPerSecond,`${id}.messagesPerSecond`);if(value.averageMessageBytes!==undefined)measurement(value.averageMessageBytes,`${id}.averageMessageBytes`);}else{fields(value,['consumptionRate','lag','source'],id);measurement(value.consumptionRate,`${id}.consumptionRate`);measurement(value.lag,`${id}.lag`,true);}}
 }
 const status=object(snapshot.status,'status');fields(status,['state','message'],'status');if(!['ok','degraded','error'].includes(status.state))fail('status.state','expected ok, degraded or error');if(typeof status.message!=='string'||status.message.length>500)fail('status.message','expected text up to 500 characters');if(status.state!=='ok'&&!status.message.trim())fail('status.message','describe the collection failure');
 return structuredClone(snapshot);
}
