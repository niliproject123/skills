import type {ScenarioConfig} from './scenarioTypes';
export type EditorProps={config:ScenarioConfig;edit:(change:(draft:ScenarioConfig)=>void)=>void};
export function Field({label,value,onChange,type='number',step='any'}:{label:string;value:string|number;onChange:(value:string)=>void;type?:string;step?:string}){return <label className="scenario-field"><span>{label}</span><input aria-label={label} type={type} min={type==='range'?0:undefined} max={type==='range'?1:undefined} value={value} step={step} onChange={event=>onChange(event.target.value)}/></label>;}
export function Choice({label,value,options,onChange}:{label:string;value:string;options:{id:string;name:string}[];onChange:(value:string)=>void}){return <label className="scenario-field"><span>{label}</span><select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>{options.map(option=><option key={option.id} value={option.id}>{option.name}</option>)}</select></label>;}
export function nextId(prefix:string,ids:string[]){let index=1;while(ids.includes(`${prefix}-${index}`))index++;return `${prefix}-${index}`;}
export function cleanReferences(config:ScenarioConfig){
 const services=new Set(config.topology.services.map(service=>service.id)),topics=new Set(config.topology.topics.map(topic=>topic.id));
 config.topology.producers=config.topology.producers.filter(producer=>services.has(producer.serviceId)&&topics.has(producer.topicId));
 config.topology.consumerGroups=config.topology.consumerGroups.filter(group=>services.has(group.serviceId));
 config.topology.consumerGroups.forEach(group=>group.topicIds=group.topicIds.filter(id=>topics.has(id)));config.topology.consumerGroups=config.topology.consumerGroups.filter(group=>group.topicIds.length);
 if(config.layout.labels){const objects=new Set([...services,...topics,...config.topology.producers.map(item=>item.id),...config.topology.consumerGroups.map(item=>item.id)]);for(const id of Object.keys(config.layout.labels))if(!objects.has(id)&&!(id.startsWith('service-')&&services.has(id.slice(8)))&&!(id.startsWith('topic-')&&topics.has(id.slice(6)))&&!(id.startsWith('terminal-')&&objects.has(id.slice(9))))delete config.layout.labels[id];}
 const groups=new Set(config.topology.consumerGroups.map(group=>group.id)),producers=new Set(config.topology.producers.map(producer=>producer.id));
 for(const [record,ids] of [[config.state.topics,topics],[config.state.consumerGroups,groups],[config.layout.services,services],[config.visualization.serviceStyles,services],[config.visualization.topicColors,topics],[config.layout.topics,topics],[config.layout.terminals,new Set([...groups,...producers])]] as const)for(const key of Object.keys(record))if(!ids.has(key))delete (record as Record<string,unknown>)[key];
 for(const key of Object.keys(config.layout.routes)){const [producer,group]=key.split('/');if(!producers.has(producer)||!groups.has(group))delete config.layout.routes[key];}
 for(const topic of Object.values(config.layout.topics))if(topic.branches)for(const id of Object.keys(topic.branches))if(!groups.has(id))delete topic.branches[id];
 config.layout.overpasses=config.layout.overpasses.filter(bridge=>topics.has(bridge.topic));
}
