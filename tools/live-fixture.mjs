// Explicit synthetic observations, not data collected from a Kafka cluster.
export function exampleSnapshot(sequence=1){return {
 version:1,sequence,cluster:{id:'local-kafka-check',name:'Synthetic Kafka integration check'},observedAt:new Date().toISOString(),
 topology:{services:[{id:'checkout',name:'Checkout'},{id:'billing',name:'Billing'}],topics:[{id:'orders',name:'orders',partitionCount:2}],producers:[{id:'checkout-orders',serviceId:'checkout',topicId:'orders',producerCount:1}],consumerGroups:[{id:'billing-orders',name:'billing-orders',serviceId:'billing',topicIds:['orders'],consumerCount:2}]},
 metrics:{topics:{orders:{messagesPerSecond:180,averageMessageBytes:512,source:'synthetic-check'}},consumerGroups:{'billing-orders':{consumptionRate:160,lag:120,source:'synthetic-check'}}},status:{state:'ok',message:''}
};}
