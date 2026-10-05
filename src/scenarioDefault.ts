import type {ScenarioConfig} from './scenarioTypes';
export const defaultScenario:ScenarioConfig={
 version:1,metadata:{id:'kafka-city-demo',name:'Kafka City demo'},
 topology:{
 services:['Orders','Payment','Analytics','Notification','Inventory','Shipping','Fraud'].map(name=>({id:name,name})),
 topics:[{id:'orders',name:'orders',partitionCount:4},{id:'payments',name:'payments',partitionCount:2}],
 producers:[{id:'orders-dispatch',serviceId:'Orders',topicId:'orders',producerCount:4},{id:'payment-shipping',serviceId:'Payment',topicId:'payments',producerCount:2},{id:'orders-receipts',serviceId:'Orders',topicId:'payments',producerCount:1}],
 consumerGroups:[{id:'inventory-orders',name:'inventory-orders',serviceId:'Inventory',topicIds:['orders'],consumerCount:2},{id:'shipping-orders',name:'shipping-orders',serviceId:'Shipping',topicIds:['orders'],consumerCount:2},{id:'fraud-payments',name:'fraud-payments',serviceId:'Fraud',topicIds:['payments'],consumerCount:2},{id:'payment-orders',name:'payment-orders',serviceId:'Payment',topicIds:['orders'],consumerCount:3},{id:'analytics-realtime',name:'analytics-orders',serviceId:'Analytics',topicIds:['orders'],consumerCount:2},{id:'analytics-audit',name:'analytics-audit',serviceId:'Analytics',topicIds:['orders'],consumerCount:1},{id:'notification-delivery',name:'notification-delivery',serviceId:'Notification',topicIds:['payments'],consumerCount:2}]
 },
 state:{topics:{orders:{messagesPerSecond:10000},payments:{messagesPerSecond:3000}},consumerGroups:{'inventory-orders':{consumptionRate:10000,lag:0},'shipping-orders':{consumptionRate:8000,lag:4000},'fraud-payments':{consumptionRate:2800,lag:6000},'payment-orders':{consumptionRate:10000,lag:20},'analytics-realtime':{consumptionRate:4500,lag:10000},'analytics-audit':{consumptionRate:10000,lag:0},'notification-delivery':{consumptionRate:1500,lag:28000}}},
 layout:{
 services:{Inventory:{u:-540,v:100,width:145,depth:110},Shipping:{u:500,v:830,width:155,depth:115},Fraud:{u:1220,v:-90,width:145,depth:110},Orders:{u:-90,v:240,width:130,depth:110},Payment:{u:440,v:100,width:150,depth:110},Analytics:{u:865,v:290,width:150,depth:110},Notification:{u:785,v:-410,width:160,depth:120}},
 terminals:{'orders-dispatch':{u:75,v:200,width:45,depth:170,wall:'side'},'payment-shipping':{u:640,v:105,width:45,depth:90,wall:'side'},'orders-receipts':{u:75,v:110,width:45,depth:70,wall:'side'},'payment-orders':{u:470,v:245,width:150,depth:35,wall:'front'},'analytics-realtime':{u:885,v:495,width:150,depth:35,wall:'front'},'analytics-audit':{u:790,v:420,width:65,depth:30,wall:'front'},'notification-delivery':{u:720,v:-255,width:160,depth:35,wall:'front'}},
 topics:{},routes:{},overpasses:[],

 },
 visualization:{
 vehicles:{car:{messagesPerVehicle:50},van:{messagesPerVehicle:250},truck:{messagesPerVehicle:1000},semi:{messagesPerVehicle:2500},trailer:{messagesPerTrailer:2500}},
 thresholds:{car:100,van:500,truck:2000,semi:5000},maxTrailers:4,maxVehiclesPerLane:12,maxVehiclesPerTopic:50,maxQueueVehicles:20,maxVehiclesTotal:200,messagesPerQueueVehicle:2000,trafficWindowSeconds:2,
 topicColors:{orders:'#de7952',payments:'#798fcd'},serviceStyles:{Inventory:{color:'#d7a84d',palette:['#f4d878','#d7a84d','#a47b37'],art:'Orders'},Shipping:{color:'#64aba0',palette:['#a0d8c5','#64aba0','#3e827b'],art:'Analytics'},Fraud:{color:'#cf7c86',palette:['#f0a6a1','#cf7c86','#a25a71'],art:'Payment'},Orders:{color:'#ee9849',palette:['#ffc460','#ed9140','#c66937'],art:'Orders'},Payment:{color:'#579bd4',palette:['#80d4e7','#369fc4','#297aa0'],art:'Payment'},Analytics:{color:'#73af79',palette:['#b9df76','#72b755','#4b9149'],art:'Analytics'},Notification:{color:'#a48aca',palette:['#d3a4f1','#a674cd','#7954a4'],art:'Notification'}}
 }
};
