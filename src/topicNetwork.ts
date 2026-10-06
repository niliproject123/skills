import {roadReservations,roadTurnBlocked} from './roadClearance';
import type {LayoutConfiguration,Point,Route,Terminal} from './scenarioTypes';
import {computeLayout} from './autoLayout';
import {bayPosition,dockApproachLength} from './terminalConnection';
import {shortestRoad} from './shortestRoad';

type Edge={from:Point;to:Point};
const key=(point:Point)=>`${point.u}/${point.v}`;
const distance=(a:Point,b:Point)=>Math.abs(a.u-b.u)+Math.abs(a.v-b.v);
const onEdge=(point:Point,edge:Edge)=>edge.from.u===edge.to.u?point.u===edge.from.u&&point.v>=Math.min(edge.from.v,edge.to.v)&&point.v<=Math.max(edge.from.v,edge.to.v):point.v===edge.from.v&&point.u>=Math.min(edge.from.u,edge.to.u)&&point.u<=Math.max(edge.from.u,edge.to.u);
const intersections=(from:Point,to:Point,edges:Edge[])=>{
 const segment={from,to},contacts:{point:Point;parallel:boolean}[]=[];
 for(const edge of edges){
  if(edge.from.u===edge.to.u&&from.v===to.v){const point={u:edge.from.u,v:from.v};if(onEdge(point,edge)&&onEdge(point,segment))contacts.push({point,parallel:false});}
  else if(edge.from.v===edge.to.v&&from.u===to.u){const point={u:from.u,v:edge.from.v};if(onEdge(point,edge)&&onEdge(point,segment))contacts.push({point,parallel:false});}
  else for(const point of [edge.from,edge.to,from,to])if(onEdge(point,edge)&&onEdge(point,segment))contacts.push({point,parallel:true});
 }
 return contacts;
};
const outward=(terminal:Terminal)=>terminal.wall==='front'?{u:0,v:1}:{u:1,v:0};

export function planTopicNetwork(config:LayoutConfiguration,terminals:Terminal[],topic:string,previousRoutes:Route[]){
 const sources=terminals.filter(terminal=>terminal.producer&&terminal.topics.includes(topic));
 const receivers=terminals.filter(terminal=>!terminal.producer&&terminal.topics.includes(topic));
 const result=new Map<string,Point[]>();if(!sources.length||!receivers.length)return result;
 const lanes=config.topology.topics.find(item=>item.id===topic)!.partitionCount,clearance=lanes*11+22;
 const participants=[...sources,...receivers],ports=new Map<string,Point>();
 for(const terminal of participants){const bay=bayPosition(terminal,topic),direction=outward(terminal),setback=dockApproachLength(lanes);ports.set(terminal.id,{u:bay.u+direction.u*setback,v:bay.v+direction.v*setback});}
 const isDockPort=(point:Point)=>participants.some(terminal=>key(ports.get(terminal.id)!)===key(point));
 const obstacles=[...Object.values(computeLayout(config.topology,config.layout)).map(building=>({...building,width:building.width??150,depth:building.depth??110})),...terminals];
 const reserved=roadReservations(previousRoutes,terminals,topic,lanes,config.topology.topics);
 const edges:Edge[]=[],root=participants[0],rootPoint=ports.get(root.id)!;
 // Connect nearby ports before distant branches can enclose their approaches.
 for(const terminal of participants.slice(1).sort((a,b)=>distance(ports.get(a.id)!,rootPoint)-distance(ports.get(b.id)!,rootPoint))){
  const port=ports.get(terminal.id)!;
  const nearest=edges.length?edges.map(edge=>edge.from.u===edge.to.u?{u:edge.from.u,v:Math.max(Math.min(edge.from.v,edge.to.v),Math.min(Math.max(edge.from.v,edge.to.v),port.v))}:{u:Math.max(Math.min(edge.from.u,edge.to.u),Math.min(Math.max(edge.from.u,edge.to.u),port.u)),v:edge.from.v}):[rootPoint];
  const candidates=edges.length?[...nearest,...edges.flatMap(edge=>[edge.from,edge.to,{u:(edge.from.u+edge.to.u)/2,v:(edge.from.v+edge.to.v)/2}])].filter(point=>isDockPort(point)||!roadTurnBlocked(point,reserved,lanes*11+18)):nearest;
  const target=candidates.sort((a,b)=>distance(port,a)-distance(port,b))[0];
  if(!target)throw new Error(`Cannot attach ${terminal.id} to topic ${topic}: no branch position has enough clearance from neighboring roads. Move the campuses farther apart.`);
  if(key(port)===key(target))continue;
  const arrivalDirection=(point:Point)=>{const terminal=participants.find(item=>key(ports.get(item.id)!)===key(point));if(!terminal)return undefined;const direction=outward(terminal);return {u:-direction.u,v:-direction.v};};
  const sharedEdges=edges.map(edge=>({...edge,margin:0,shared:true}));
  const unsafeAttachment=(from:Point,to:Point)=>intersections(from,to,edges).some(contact=>!contact.parallel&&!isDockPort(contact.point)&&roadTurnBlocked(contact.point,reserved,lanes*11+18));
  let path:Point[];
  try{path=shortestRoad(port,target,obstacles,clearance,[...reserved,...sharedEdges],{start:outward(terminal),endAt:arrivalDirection},unsafeAttachment,[...new Map(candidates.map(point=>[key(point),point])).values()]);}catch(reason){throw new Error(`Cannot attach ${terminal.id} to topic ${topic}: ${String(reason)}`);}
  // Attach at the first contact with the tree, never leave it and reconnect.
  const existingEdges=edges.slice();let joined=false;
  for(let index=1;index<path.length&&!joined;index++){
   const from=path[index-1],to=path[index],contacts=intersections(from,to,existingEdges).sort((a,b)=>distance(from,a.point)-distance(from,b.point));
   const contact=contacts[0],end=contact?.point??to;
   if(contact&&!contact.parallel&&!isDockPort(contact.point)&&roadTurnBlocked(contact.point,reserved,lanes*11+18))throw new Error(`Cannot join ${terminal.id} to topic ${topic}: the selected branch violates road clearance.`);
   if(distance(from,end)>0)edges.push({from,to:end});
   if(contact)joined=true;
  }
 }
 // Split shared edges at every attachment before finding producer/group paths.
 const nodes=[...ports.values(),...edges.flatMap(edge=>[edge.from,edge.to])],graph=new Map<string,Point[]>();
 for(const edge of edges){const cuts=[...new Map(nodes.filter(point=>onEdge(point,edge)).map(point=>[key(point),point])).values()].sort((a,b)=>distance(edge.from,a)-distance(edge.from,b));for(let index=1;index<cuts.length;index++){const a=cuts[index-1],b=cuts[index];graph.set(key(a),[...(graph.get(key(a))??[]),b]);graph.set(key(b),[...(graph.get(key(b))??[]),a]);}}
 for(const source of sources)for(const receiver of receivers){
  const start=ports.get(source.id)!,end=ports.get(receiver.id)!,pending=[start],previous=new Map<string,Point|null>([[key(start),null]]);
  for(let index=0;index<pending.length&&!previous.has(key(end));index++)for(const neighbor of graph.get(key(pending[index]))??[])if(!previous.has(key(neighbor))){previous.set(key(neighbor),pending[index]);pending.push(neighbor);}
  if(!previous.has(key(end)))throw new Error(`Topic ${topic} has no shared road from ${source.id} to ${receiver.id}.`);
  const path:Point[]=[];for(let point:Point|null=end;point;point=previous.get(key(point))!)path.push(point);path.reverse();
  const compact=path.filter((point,index)=>!index||index===path.length-1||!((path[index-1].u===point.u&&point.u===path[index+1].u)||(path[index-1].v===point.v&&point.v===path[index+1].v)));
  result.set(`${source.id}/${receiver.id}`,[bayPosition(source,topic),...compact,bayPosition(receiver,topic)]);
 }
 return result;
}
