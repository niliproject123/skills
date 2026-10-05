import type {TopologyModel,LayoutModel,Placement} from './scenarioTypes';
export function serviceRole(topology:TopologyModel,id:string){const produces=topology.producers.filter(item=>item.serviceId===id).length,consumes=topology.consumerGroups.filter(item=>item.serviceId===id).length;return produces&&consumes?'processor':produces?'source':'sink';}
export function computeLayout(topology:TopologyModel,overrides:LayoutModel):Record<string,Placement>{
 const neighbors=new Map(topology.services.map(service=>[service.id,new Set<string>()]));
 for(const topic of topology.topics){const participants=[...new Set([...topology.producers.filter(p=>p.topicId===topic.id).map(p=>p.serviceId),...topology.consumerGroups.filter(g=>g.topicIds.includes(topic.id)).map(g=>g.serviceId)])];for(const id of participants)for(const other of participants)if(id!==other)neighbors.get(id)!.add(other);}
 const positions:Record<string,Placement>={},visited=new Set<string>();let district=0;
 for(const service of topology.services){if(visited.has(service.id))continue;const cluster:string[]=[],pending=[service.id];while(pending.length){const id=pending.shift()!;if(visited.has(id))continue;visited.add(id);cluster.push(id);pending.push(...neighbors.get(id)!);}
 const roles=(['source','processor','sink'] as const).filter(role=>cluster.some(id=>serviceRole(topology,id)===role));
 const rows={source:0,processor:0,sink:0};
 for(const id of cluster){const role=serviceRole(topology,id),row=rows[role]++,column=roles.indexOf(role);positions[id]=overrides.services[id]??{u:column*570+(row%2)*80,v:district+row*510,width:150,depth:110};}
 district+=Math.max(...Object.values(rows),1)*510+180;
 }
 // Keep manual campuses fixed; separate automatic campuses from their footprints.
 for(const service of topology.services){if(overrides.services[service.id])continue;const placement=positions[service.id];for(let attempt=0;attempt<topology.services.length*2;attempt++){const collision=Object.entries(positions).find(([id,other])=>id!==service.id&&Math.abs(placement.u-other.u)<320&&Math.abs(placement.v-other.v)<330);if(!collision)break;placement.v=collision[1].v+510;}}
 return positions;
}
