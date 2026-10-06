import type {LayoutConfiguration,Point,Route,Terminal} from './scenarioTypes';
import {computeLayout} from './autoLayout';
import {bayPosition,connectionLength} from './terminalConnection';
import {shortestRoad} from './shortestRoad';

type Edge={from:Point;to:Point};
const key=(point:Point)=>`${point.u}/${point.v}`;
const distance=(a:Point,b:Point)=>Math.abs(a.u-b.u)+Math.abs(a.v-b.v);
const onEdge=(point:Point,edge:Edge)=>edge.from.u===edge.to.u?point.u===edge.from.u&&point.v>=Math.min(edge.from.v,edge.to.v)&&point.v<=Math.max(edge.from.v,edge.to.v):point.v===edge.from.v&&point.u>=Math.min(edge.from.u,edge.to.u)&&point.u<=Math.max(edge.from.u,edge.to.u);
const outward=(terminal:Terminal)=>terminal.wall==='front'?{u:0,v:1}:{u:1,v:0};

export function planTopicNetwork(config:LayoutConfiguration,terminals:Terminal[],topic:string,previousRoutes:Route[]){
 const sources=terminals.filter(terminal=>terminal.producer&&terminal.topics.includes(topic));
 const receivers=terminals.filter(terminal=>!terminal.producer&&terminal.topics.includes(topic));
 const result=new Map<string,Point[]>();if(!sources.length||!receivers.length)return result;
 const lanes=config.topology.topics.find(item=>item.id===topic)!.partitionCount,clearance=lanes*11+22;
 const participants=[...sources,...receivers],ports=new Map<string,Point>();
 for(const terminal of participants){const bay=bayPosition(terminal),direction=outward(terminal),setback=connectionLength+clearance+116;ports.set(terminal.id,{u:bay.u+direction.u*setback,v:bay.v+direction.v*setback});}
 const obstacles=[...Object.values(computeLayout(config.topology,config.layout)).map(building=>({...building,width:building.width??150,depth:building.depth??110})),...terminals];
 const reserved=previousRoutes.flatMap(route=>route.points.slice(1).map((to,index)=>({from:route.points[index],to,margin:route.lanes*11+lanes*11+35})));
 const edges:Edge[]=[],root=participants[0],rootPoint=ports.get(root.id)!;
 for(const terminal of participants.slice(1)){
  const port=ports.get(terminal.id)!;
  const candidates=edges.length?edges.map(edge=>edge.from.u===edge.to.u?{u:edge.from.u,v:Math.max(Math.min(edge.from.v,edge.to.v),Math.min(Math.max(edge.from.v,edge.to.v),port.v))}:{u:Math.max(Math.min(edge.from.u,edge.to.u),Math.min(Math.max(edge.from.u,edge.to.u),port.u)),v:edge.from.v}):[rootPoint];
  const target=candidates.sort((a,b)=>distance(port,a)-distance(port,b))[0];
  if(key(port)===key(target))continue;
  const targetTerminal=participants.find(item=>key(ports.get(item.id)!)===key(target)),direction=targetTerminal?outward(targetTerminal):undefined;
  const path=shortestRoad(port,target,obstacles,clearance,reserved,{start:outward(terminal),end:direction?{u:-direction.u,v:-direction.v}:undefined});
  // Attach at the first contact with the tree, never leave it and reconnect.
  const existingEdges=edges.slice();let joined=false;
  for(let index=1;index<path.length&&!joined;index++){
   const from=path[index-1],to=path[index],segment={from,to},contacts:Point[]=[];
   for(const edge of existingEdges){
    if(edge.from.u===edge.to.u&&from.v===to.v){const point={u:edge.from.u,v:from.v};if(onEdge(point,edge)&&onEdge(point,segment))contacts.push(point);}
    else if(edge.from.v===edge.to.v&&from.u===to.u){const point={u:from.u,v:edge.from.v};if(onEdge(point,edge)&&onEdge(point,segment))contacts.push(point);}
    else for(const point of [edge.from,edge.to,from,to])if(onEdge(point,edge)&&onEdge(point,segment))contacts.push(point);
   }
   const contact=contacts.sort((a,b)=>distance(from,a)-distance(from,b))[0],end=contact??to;
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
  result.set(`${source.id}/${receiver.id}`,[bayPosition(source),...compact,bayPosition(receiver)]);
 }
 return result;
}
