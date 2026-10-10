import type {Selection} from './model';
import type {ScenarioConfig} from './scenarioTypes';
import {liveSnapshot} from './liveData';
const number=(value:number|null|undefined,unit='')=>value===null||value===undefined?'Unknown':`${value.toLocaleString(undefined,{maximumFractionDigits:2})}${unit}`;
const total=(values:(number|null|undefined)[])=>values.some(value=>value===null||value===undefined)?null:values.reduce<number>((sum,value)=>sum+value!,0);
export function ObjectValues({configuration,selection}:{configuration:ScenarioConfig;selection:Selection}){
 const live=liveSnapshot,topology=live?.topology??configuration.topology;
 const topicRate=(id:string)=>live?live.metrics.topics[id].messagesPerSecond:configuration.state.topics[id].messagesPerSecond;
 const groupState=(id:string)=>live?live.metrics.consumerGroups[id]:configuration.state.consumerGroups[id];
 const rows:[string,string][]=[];
 if(selection.kind==='service'){
  const producers=topology.producers.filter(item=>item.serviceId===selection.name),groups=topology.consumerGroups.filter(item=>item.serviceId===selection.name),outputs=[...new Set(producers.map(item=>item.topicId))],inputs=[...new Set(groups.flatMap(item=>item.topicIds))];
  rows.push(['Service',topology.services.find(item=>item.id===selection.name)!.name],['Produces',outputs.map(id=>topology.topics.find(item=>item.id===id)!.name).join(', ')||'None'],['Consumes',inputs.map(id=>topology.topics.find(item=>item.id===id)!.name).join(', ')||'None'],['Producer instances',number(total(producers.map(item=>item.producerCount)))],['Consumer instances',number(total(groups.map(item=>item.consumerCount)))],['Output topic throughput',number(total(outputs.map(topicRate)),' msg/s')],['Consumption',number(total(groups.map(item=>groupState(item.id).consumptionRate)),' msg/s')],['Total group lag',number(total(groups.map(item=>groupState(item.id).lag)),' offsets')]);
 }else if(selection.kind==='topic'){
  const topic=topology.topics.find(item=>item.id===selection.name)!,groups=topology.consumerGroups.filter(item=>item.topicIds.includes(topic.id)),producers=topology.producers.filter(item=>item.topicId===topic.id);
  rows.push(['Topic',topic.name],['Partitions',number(topic.partitionCount)],['Throughput',number(topicRate(topic.id),' msg/s')],['Average message size',live?number(live.metrics.topics[topic.id].averageMessageBytes,' bytes'):'Not measured in demo'],['Producer services',producers.map(item=>topology.services.find(service=>service.id===item.serviceId)!.name).join(', ')||'Unknown / external'],['Consumer groups',groups.map(item=>item.name).join(', ')||'None']);
  if(live)rows.push(['Source',live.metrics.topics[topic.id].source]);
 }else if(selection.kind==='terminal'||selection.kind==='gate'){
  const terminalId=selection.kind==='terminal'?selection.id:selection.producer?topology.producers.find(item=>item.serviceId===selection.name&&item.topicId===selection.topic)?.id:topology.consumerGroups.find(item=>item.serviceId===selection.name&&item.topicIds.includes(selection.topic))?.id;
  if(!terminalId)return <p>Select a terminal yard to see its current values.</p>;
  if(selection.producer){const producer=topology.producers.find(item=>item.id===terminalId)!;rows.push(['Output dock',producer.id],['Producer instances',number(producer.producerCount)],['Topic',topology.topics.find(item=>item.id===producer.topicId)!.name],['Topic throughput',number(topicRate(producer.topicId),' msg/s')]);if(live)rows.push(['Source',live.metrics.topics[producer.topicId].source]);}
  else{const group=topology.consumerGroups.find(item=>item.id===terminalId)!,state=groupState(group.id);rows.push(['Consumer group',group.name],['Consumer instances',number(group.consumerCount)],['Subscribed topics',group.topicIds.map(id=>topology.topics.find(item=>item.id===id)!.name).join(', ')],['Consumption',number(state.consumptionRate,' msg/s')],['Lag',number(state.lag,' offsets')]);if(live)rows.push(['Source',live.metrics.consumerGroups[group.id].source]);}
 }
 if(live)rows.push(['Observed',new Date(live.observedAt).toLocaleString()],['Sequence',String(live.sequence)],['Collection',live.status.state+(live.status.message?`: ${live.status.message}`:'')]);
 return <section className="object-values"><h3>Current values</h3><p className="scenario-help">{live?'Reported by your collector. Topic throughput is shared, not attributed to each producer.':'Simulated example values.'}</p><dl>{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>;
}
