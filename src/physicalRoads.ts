import type {Point,Route,Terminal} from './scenarioTypes';
import {connectionPosition,pointAtBay} from './terminalConnection';
import {roadNetwork} from './roadNetwork';

export type PhysicalRoadRun={topic:string;lanes:number;from:Point;to:Point};
const key=(point:Point)=>`${point.u}/${point.v}`;

// Bridge candidates stop at every physical junction and corner, even when a
// logical producer/group route continues straight through that junction.
export function physicalRoadRuns(routes:Route[],terminals:Terminal[]):PhysicalRoadRun[]{
 const result:PhysicalRoadRun[]=[];
 for(const topic of new Set(routes.map(route=>route.topic))){
  const pieces=routes.filter(route=>route.topic===topic).flatMap(route=>{
   const points=route.points.map(point=>({...point}));
   const producer=terminals.find(terminal=>terminal.producer&&terminal.topics.includes(topic)&&pointAtBay(terminal,points[0]));
   const receiver=terminals.find(terminal=>terminal.id===route.terminal);
   if(producer)points[0]=connectionPosition(producer);
   if(receiver&&!receiver.producer)points[points.length-1]=connectionPosition(receiver);
   return points.slice(1).flatMap((to,index)=>{const from=points[index];if(from.u!==to.u&&from.v!==to.v)throw new Error(`Road ${route.id} has a diagonal dock connection. Correct its driveway waypoints before planning bridges.`);return key(to)===key(from)?[]:[{from,to,lanes:route.lanes}];});
  });
  const edges=roadNetwork(pieces),nodes=new Map<string,number[]>(),visited=new Set<number>();
  edges.forEach((edge,index)=>{for(const point of [edge.from,edge.to])nodes.set(key(point),[...(nodes.get(key(point))??[]),index]);});
  const continuing=(point:Point)=>{const arms=nodes.get(key(point))!;return arms.length===2&&edges[arms[0]].lanes===edges[arms[1]].lanes&&(edges[arms[0]].from.u===edges[arms[0]].to.u)===(edges[arms[1]].from.u===edges[arms[1]].to.u);};
  const trace=(first:number,start:Point)=>{
   let index=first,point=start;
   while(!visited.has(index)){visited.add(index);const edge=edges[index];point=key(edge.from)===key(point)?edge.to:edge.from;if(!continuing(point))break;const next=nodes.get(key(point))!.find(candidate=>!visited.has(candidate));if(next===undefined)break;index=next;}
   result.push({topic,lanes:edges[first].lanes,from:start,to:point});
  };
  edges.forEach((edge,index)=>{if(visited.has(index))return;if(!continuing(edge.from))trace(index,edge.from);else if(!continuing(edge.to))trace(index,edge.to);});
  edges.forEach((edge,index)=>{if(!visited.has(index))trace(index,edge.from);});
 }
 return result;
}
