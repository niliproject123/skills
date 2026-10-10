import type {ScenarioConfig} from './scenarioTypes';
export function presetTopology(config:ScenarioConfig,name:string){
 const group=(id:string)=>{const found=config.topology.consumerGroups.find(item=>item.id===id);if(!found)throw new Error(`Preset requires consumer group ${id}`);return found;};
 if(name==='Normal'){group('analytics-realtime').topicIds=['orders','payments','inventory','fulfilments'];group('shipping-inventory').consumerCount=3;}
 if(name==='Hot partition'){config.topology.topics.find(topic=>topic.id==='orders')!.partitionCount=6;group('analytics-realtime').consumerCount=3;}
 if(name==='Consumer lag'){group('notification-delivery').topicIds=['payments','fulfilments'];group('shipping-orders').consumerCount=1;}
 if(name==='Recovering consumer'){group('notification-delivery').topicIds=['payments','fulfilments'];group('notification-delivery').consumerCount=4;group('shipping-orders').consumerCount=4;}
 if(name==='High throughput'){for(const topic of config.topology.topics)topic.partitionCount=topic.id==='orders'?8:4;for(const producer of config.topology.producers)producer.producerCount=4;for(const consumer of config.topology.consumerGroups)consumer.consumerCount=4;}
 if(name==='Many groups'){for(const topic of ['payments','inventory','fulfilments']){const id=`analytics-${topic}-archive`;config.topology.consumerGroups.push({id,name:id,serviceId:'Analytics',topicIds:[topic],consumerCount:2});config.state.consumerGroups[id]={consumptionRate:config.state.topics[topic].messagesPerSecond,lag:0};}}
 for(const topic of config.topology.topics)if(topic.partitions&&topic.partitions.length!==topic.partitionCount)delete topic.partitions;
 if(name!=='Demo'){config.layout.terminals={};config.layout.routes={};config.layout.topics={};config.layout.overpasses=[];}
 // Presets that enlarge or add receiving yards must allocate new campuses.
 if(['Consumer lag','Recovering consumer','High throughput','Many groups'].includes(name))config.layout.services={};
}
