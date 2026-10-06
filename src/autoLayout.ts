import type {TopologyModel,LayoutModel,Placement} from './scenarioTypes';
export function serviceRole(topology:TopologyModel,id:string){const produces=topology.producers.filter(item=>item.serviceId===id).length,consumes=topology.consumerGroups.filter(item=>item.serviceId===id).length;return produces&&consumes?'processor':produces?'source':'sink';}
export function computeLayout(topology:TopologyModel,overrides:LayoutModel):Record<string,Placement>{
 const neighbors=new Map(topology.services.map(service=>[service.id,new Set<string>()]));
 for(const topic of topology.topics){const participants=[...new Set([...topology.producers.filter(p=>p.topicId===topic.id).map(p=>p.serviceId),...topology.consumerGroups.filter(g=>g.topicIds.includes(topic.id)).map(g=>g.serviceId)])];for(const id of participants)for(const other of participants)if(id!==other)neighbors.get(id)!.add(other);}
 const positions:Record<string,Placement>={},visited=new Set<string>(),campusFootprints=new Map<string,{width:number;depth:number}>();let district=0;
 for(const service of topology.services){if(visited.has(service.id))continue;const cluster:string[]=[],pending=[service.id];while(pending.length){const id=pending.shift()!;if(visited.has(id))continue;visited.add(id);cluster.push(id);pending.push(...neighbors.get(id)!);}
 const roles=(['source','processor','sink'] as const).filter(role=>cluster.some(id=>serviceRole(topology,id)===role));
 const footprint=(id:string)=>{
  const building=overrides.services[id],width=building?.width??150,depth=building?.depth??110;
  const producers=topology.producers.filter(item=>item.serviceId===id),groups=topology.consumerGroups.filter(item=>item.serviceId===id);
  const laneCount=Math.max(1,...topology.topics.filter(topic=>producers.some(item=>item.topicId===topic.id)||groups.some(group=>group.topicIds.includes(topic.id))).map(topic=>topic.partitionCount));
  const driveway=60+laneCount*11+22+116;
  const bayWidth=Math.max(150,...groups.map(group=>Math.max((group.consumerCount+1)*34,group.topicIds.length>1?group.topicIds.reduce((sum,id)=>sum+topology.topics.find(topic=>topic.id===id)!.partitionCount*22,0)+(group.topicIds.length-1)*Math.max(96,28+(laneCount*11+18)/2)+24:0)));
  const area={width:Math.max(width+90+driveway,groups.length>1?bayWidth*2+180:bayWidth)+110,depth:Math.max(depth+100+35+Math.max(0,Math.ceil(groups.length/2)-1)*475+driveway,producers.reduce((total,item)=>total+(item.producerCount+1)*34+160,depth))+110};campusFootprints.set(id,area);return area;
 };
 const campusWidth=Math.max(...cluster.map(id=>footprint(id).width)),campusDepth=Math.max(...cluster.map(id=>footprint(id).depth));
 const columnsFor=(role:string)=>cluster.filter(id=>serviceRole(topology,id)===role).length>3?2:1;
 const rows={source:0,processor:0,sink:0};
 for(const id of cluster){const role=serviceRole(topology,id),row=rows[role]++,column=roles.indexOf(role);const roleStart=roles.slice(0,column).reduce((total,role)=>total+columnsFor(role)*campusWidth,0),columns=columnsFor(role);positions[id]=overrides.services[id]??{u:roleStart+row%columns*campusWidth,v:district+Math.floor(row/columns)*campusDepth,width:150,depth:110};}
 district+=Math.max(...roles.map(role=>Math.ceil(rows[role]/columnsFor(role))),1)*campusDepth+180;
 }
 // Keep manual campuses fixed; separate automatic campuses from their footprints.
 for(const service of topology.services){if(overrides.services[service.id])continue;const placement=positions[service.id];for(let attempt=0;attempt<topology.services.length*2;attempt++){const collision=Object.entries(positions).find(([id,other])=>id!==service.id&&placement.u<other.u+campusFootprints.get(id)!.width&&placement.u+campusFootprints.get(service.id)!.width>other.u&&placement.v<other.v+campusFootprints.get(id)!.depth&&placement.v+campusFootprints.get(service.id)!.depth>other.v);if(!collision)break;placement.v=collision[1].v+campusFootprints.get(collision[0])!.depth;}const own=campusFootprints.get(service.id)!;if(Object.entries(positions).some(([id,other])=>id!==service.id&&placement.u<other.u+campusFootprints.get(id)!.width&&placement.u+own.width>other.u&&placement.v<other.v+campusFootprints.get(id)!.depth&&placement.v+own.depth>other.v))throw new Error(`Cannot place ${service.name} with enough room for its docks and driveways. Move the manual campuses.`);}
 return positions;
}
