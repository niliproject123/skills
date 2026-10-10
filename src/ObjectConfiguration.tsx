import {useEffect,useState} from 'react';
import {storageSelection,type Selection} from './model';
import {ClusterInspector} from './ClusterInspector';
import type {ScenarioConfig} from './scenarioTypes';
import {ServiceSettings} from './ServiceSettings';
import {TopicSettings} from './TopicSettings';
import {GroupSettings} from './GroupSettings';
import {Field,Choice,cleanReferences} from './ScenarioFields';
import {addGroup,addTopic} from './scenarioActions';
import {ObjectValues} from './ObjectValues';
import {liveSnapshot} from './liveData';

type Item={kind:'service'|'topic'|'producer'|'group';id:string;title:string;selection:Selection};
const identity=(item:Item)=>`${item.kind}/${item.id}`;
function selectedItem(selection:Exclude<Selection,{kind:'partition'|'broker'}>,config:ScenarioConfig):Item{
 if(selection.kind==='service'){const service=config.topology.services.find(item=>item.id===selection.name);if(!service)throw new Error('The selected service no longer exists.');return {kind:'service',id:service.id,title:service.name,selection};}
 if(selection.kind==='topic'){const topic=config.topology.topics.find(item=>item.id===selection.name);if(!topic)throw new Error('The selected topic no longer exists.');return {kind:'topic',id:topic.id,title:topic.name,selection};}
 const matches=selection.producer?config.topology.producers.filter(item=>item.serviceId===selection.name&&item.topicId===selection.topic):config.topology.consumerGroups.filter(item=>item.serviceId===selection.name&&item.topicIds.includes(selection.topic));
 const id=selection.kind==='terminal'?selection.id:matches.length===1?matches[0].id:undefined;
 if(!id)throw new Error('This gate belongs to multiple groups. Select a receiving yard to choose its group.');
 return {kind:selection.producer?'producer':'group',id,title:id,selection};
}

export function ObjectConfiguration({configuration,selected,onSelect,onApply}:{configuration:ScenarioConfig;selected:Selection|null;onSelect:(selection:Selection|null)=>void;onApply:(config:ScenarioConfig)=>Promise<void>}){
 const [items,setItems]=useState<Item[]>([]),[activeId,setActiveId]=useState(''),[draft,setDraft]=useState(()=>structuredClone(configuration)),[error,setError]=useState(''),[message,setMessage]=useState('');
 const open=(item:Item)=>{setItems(previous=>previous.some(existing=>identity(existing)===identity(item))?previous:[...previous,item]);setActiveId(identity(item));};
 useEffect(()=>{if(selected&&!storageSelection(selected))try{open(selectedItem(selected,configuration));setError('');}catch(reason){setError(String(reason));console.error(reason);}},[selected]);
 useEffect(()=>{
  setDraft(structuredClone(configuration));setMessage('');
  const exists=(item:Item)=>item.kind==='service'?configuration.topology.services.some(value=>value.id===item.id):item.kind==='topic'?configuration.topology.topics.some(value=>value.id===item.id):item.kind==='producer'?configuration.topology.producers.some(value=>value.id===item.id):configuration.topology.consumerGroups.some(value=>value.id===item.id);
  setItems(previous=>previous.filter(exists));
 },[configuration]);
 const active=items.find(item=>identity(item)===activeId&&(item.kind==='service'?configuration.topology.services.some(value=>value.id===item.id):item.kind==='topic'?configuration.topology.topics.some(value=>value.id===item.id):item.kind==='producer'?configuration.topology.producers.some(value=>value.id===item.id):configuration.topology.consumerGroups.some(value=>value.id===item.id)));
 useEffect(()=>{if(!storageSelection(selected)&&items.length&&!active){const next=items.at(-1)!;setActiveId(identity(next));onSelect(next.selection);}},[items,activeId]);
 const edit=(change:(config:ScenarioConfig)=>void)=>{try{const next=structuredClone(draft);change(next);setDraft(next);setError('');setMessage('Draft changed. Apply to update the city.');}catch(reason){setError(String(reason));console.error(reason);}};
 const close=(item:Item)=>{const remaining=items.filter(existing=>identity(existing)!==identity(item));setItems(remaining);if(identity(item)===activeId){const next=remaining.at(-1);setActiveId(next?identity(next):'');onSelect(next?.selection??null);}};
 const newGroup=(service:string,topic?:string)=>edit(next=>{const topicId=topic??next.topology.topics[0]?.id;if(!topicId)throw new Error('Create a topic before adding a consumer group.');const id=addGroup(next,service,topicId);open({kind:'group',id,title:id,selection:{kind:'terminal',id,name:service,topic:topicId,producer:false}});});
 const producer=active?.kind==='producer'?draft.topology.producers.find(item=>item.id===active.id):undefined;
 if(storageSelection(selected))return <ClusterInspector configuration={configuration} selection={selected} onSelect={onSelect}/>;
 if(!items.length&&!error)return null;
 return <section className="object-configuration" aria-label="Item inspector"><div className="scenario-heading"><h2>Inspect item</h2><button aria-label="Close item tabs" onClick={()=>{setItems([]);setError('');onSelect(null);}}>×</button></div>
 <div className="object-tabs" role="tablist" aria-label="Selected city items">{items.map(item=><div key={identity(item)}><button role="tab" aria-selected={identity(item)===activeId} aria-controls="object-settings" id={`tab-${item.kind}-${item.id}`} onClick={()=>{setActiveId(identity(item));onSelect(item.selection);}}>{item.title}</button><button aria-label={`Close ${item.title} tab`} onClick={()=>close(item)}>×</button></div>)}</div>
 <div className="scenario-content" id="object-settings" role="tabpanel" aria-labelledby={active?`tab-${active.kind}-${active.id}`:undefined}>
 {active&&<ObjectValues configuration={configuration} selection={active.selection}/>}
 {!liveSnapshot&&<details key={activeId}><summary>Test configuration</summary>
 {active?.kind==='service'&&<ServiceSettings key={activeId} focused config={draft} edit={edit} selectedId={active.id} onGroup={service=>newGroup(service)} onTopic={service=>edit(next=>{const id=addTopic(next);open({kind:'topic',id,title:id,selection:{kind:'topic',name:id}});next.topology.producers.push({id:`${service}-${id}-producer`,serviceId:service,topicId:id,producerCount:1});})}/>}
 {active?.kind==='topic'&&<TopicSettings key={activeId} focused config={draft} edit={edit} selectedId={active.id} onGroup={topic=>{const service=draft.topology.services[0]?.id;if(!service){setError('Create a service before adding a consumer group.');return;}newGroup(service,topic);}}/>}
 {active?.kind==='group'&&<GroupSettings key={activeId} focused config={draft} edit={edit} selectedId={active.id}/>}
 {active?.kind==='producer'&&(producer?<section><h3>Output dock · {producer.id}</h3><Choice label="Service" value={producer.serviceId} options={draft.topology.services} onChange={value=>edit(next=>{next.topology.producers.find(item=>item.id===producer.id)!.serviceId=value;delete next.layout.terminals[producer.id];})}/><Choice label="Topic" value={producer.topicId} options={draft.topology.topics} onChange={value=>edit(next=>{next.topology.producers.find(item=>item.id===producer.id)!.topicId=value;for(const key of Object.keys(next.layout.routes))if(key.startsWith(producer.id+'/'))delete next.layout.routes[key];})}/><Field label="Output bays" value={producer.producerCount} onChange={value=>edit(next=>{next.topology.producers.find(item=>item.id===producer.id)!.producerCount=Number(value);})}/><button onClick={()=>edit(next=>{next.topology.producers=next.topology.producers.filter(item=>item.id!==producer.id);cleanReferences(next);})}>Delete output dock</button></section>:<p role="status">This output dock was removed.</p>)}
 <footer className="scenario-actions"><button onClick={async()=>{try{await onApply(draft);setError('');setMessage('Item configuration applied.');}catch(reason){setError(String(reason));console.error(reason);}}}>Apply</button><button onClick={()=>{setDraft(structuredClone(configuration));setError('');setMessage('Draft reset.');}}>Reset draft</button></footer></details>}
 </div>{error&&<div className="scenario-error" role="alert">{error}</div>}{message&&<p className="scenario-message" role="status">{message}</p>}</section>;
}
