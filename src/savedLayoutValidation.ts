import type {ScenarioConfig} from './scenarioTypes';
import type {computeLayout} from './mapLayout';

export function checkSavedLayout(value:unknown,config:ScenarioConfig):asserts value is ReturnType<typeof computeLayout>{
 const fail=()=>{throw new Error('Saved city geometry is invalid. Recalculate the layout before loading it.');};
 const record=(item:unknown):item is Record<string,any>=>!!item&&typeof item==='object'&&!Array.isArray(item);
 const point=(item:unknown)=>record(item)&&Number.isFinite(item.u)&&Number.isFinite(item.v);
 if(!record(value)||!record(value.buildings)||!Array.isArray(value.terminals)||!Array.isArray(value.routes)||!Array.isArray(value.overpasses))return fail();
 const serviceIds=new Set(config.topology.services.map(service=>service.id));
 if(Object.keys(value.buildings).length!==serviceIds.size)return fail();
 for(const [id,building] of Object.entries(value.buildings))if(!serviceIds.has(id)||!point(building)||!record(building)||!(building.width>0)||!(building.depth>0))return fail();
 const terminalIds=new Set([...config.topology.producers,...config.topology.consumerGroups].map(terminal=>terminal.id));
 if(value.terminals.length!==terminalIds.size)return fail();
 for(const terminal of value.terminals){if(!record(terminal)||!terminalIds.delete(terminal.id)||!point(terminal)||!serviceIds.has(terminal.service)||!(terminal.width>0)||!(terminal.depth>0)||!['front','side'].includes(terminal.wall)||!Array.isArray(terminal.topics))return fail();for(const id of terminal.topics)if(!config.topology.topics.some(topic=>topic.id===id))return fail();}
 const expected=new Set<string>();
 for(const topic of config.topology.topics){const sources=config.topology.producers.filter(source=>source.topicId===topic.id),groups=config.topology.consumerGroups.filter(group=>group.topicIds.includes(topic.id));if(groups.length)for(const group of groups)for(const source of sources.length?sources:[undefined])expected.add(`${source?.id??'external'}/${group.id}`);else for(const source of sources)expected.add(`${source.id}/outgoing`);}
 if(value.routes.length!==expected.size)return fail();
 for(const route of value.routes){if(!record(route)||!expected.delete(route.id)||!Array.isArray(route.points)||route.points.length<2||!config.topology.topics.some(topic=>topic.id===route.topic&&topic.partitionCount===route.lanes))return fail();for(let index=0;index<route.points.length;index++){const current=route.points[index],previous=route.points[index-1];if(!point(current)||previous&&(previous.u!==current.u&&previous.v!==current.v))return fail();}}
 for(const bridge of value.overpasses)if(!record(bridge)||!point(bridge)||!config.topology.topics.some(topic=>topic.id===bridge.topic)||!['u','v'].includes(bridge.axis??'v')||![bridge.height,bridge.start,bridge.ramp,bridge.deck].every(Number.isFinite)||bridge.height<=0||bridge.ramp<=0||bridge.deck<=0)return fail();
}
