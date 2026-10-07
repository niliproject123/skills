import {automaticColor} from './scenarioEncoding';
import type {ScenarioConfig} from './scenarioTypes';

export function largeCityPreset(config:ScenarioConfig){
 const names=['Orders','Payments','Inventory','Shipping','Notifications','Customers','Catalog','Pricing','Search','Recommendations','Billing','Fraud','Support','Analytics','Audit'];
 config.topology={services:names.map(name=>({id:name,name})),topics:[],producers:[],consumerGroups:[]};
 config.state={topics:{},consumerGroups:{}};
 config.layout={services:{},terminals:{},topics:{},routes:{},overpasses:[]};
 config.visualization.topicColors={};config.visualization.serviceStyles={};
 names.forEach((name,index)=>{
  config.layout.services[name]={u:(index%5)*560,v:Math.floor(index/5)*780,width:150,depth:110};
  config.visualization.serviceStyles[name]={color:automaticColor(name),art:(['Orders','Payment','Analytics','Notification','Office'] as const)[index%5]};
 });
 // Neighbor links form a connected 5×3 example topology. Thirteen links carry
 // a second event stream, producing exactly 35 distinct topics.
 const links:{from:number;to:number}[]=[];
 names.forEach((_,index)=>{if(index%5<4)links.push({from:index,to:index+1});if(index<10)links.push({from:index,to:index+5});});
 const outputSlots=new Map<string,number>();
 for(let index=0;index<35;index++){
  const link=links[index%links.length],source=names[link.from],destination=names[link.to];
  const topic=`${source.toLowerCase()}-${destination.toLowerCase()}-${index<links.length?'events':'updates'}`,producer=`${topic}-output`;
  const rate=[80,400,1400,3600][index%4],slot=outputSlots.get(source)??0;
  config.topology.topics.push({id:topic,name:topic,partitionCount:1});
  config.topology.producers.push({id:producer,serviceId:source,topicId:topic,producerCount:1});
  config.state.topics[topic]={messagesPerSecond:rate};config.visualization.topicColors[topic]=automaticColor(topic);
  const building=config.layout.services[source];
  config.layout.terminals[producer]={u:building.u+200,v:building.v+slot*128,width:45,depth:68,wall:'side'};
  outputSlots.set(source,slot+1);
  const groupId=`${destination.toLowerCase()}-receiving`;
  let group=config.topology.consumerGroups.find(item=>item.id===groupId);
  if(!group){group={id:groupId,name:`${destination} receiving`,serviceId:destination,topicIds:[],consumerCount:2};config.topology.consumerGroups.push(group);config.state.consumerGroups[groupId]={consumptionRate:0,lag:link.to%4===0?12000:0};const campus=config.layout.services[destination];config.layout.terminals[groupId]={u:campus.u+40,v:campus.v+500,depth:35,wall:'front'};}
  group.topicIds.push(topic);config.state.consumerGroups[groupId].consumptionRate+=rate;
 }
 config.visualization.maxVehiclesTotal=200;config.visualization.maxVehiclesPerTopic=6;config.visualization.maxQueueVehicles=8;
}
