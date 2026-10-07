import {bayPosition,connectionPosition,connectionLength} from './terminalConnection';
import {roadEdgeBlocked,type ReservedRoad} from './roadClearance';
import type {Point,Terminal} from './scenarioTypes';

type Edge={from:Point;to:Point};
type Area=Point&{width:number;depth:number};
const distance=(a:Point,b:Point)=>Math.abs(a.u-b.u)+Math.abs(a.v-b.v);

export function dockJoin(terminal:Terminal,topic:string,lanes:number,planned:Point,edges:Edge[],neighbors:Point[],obstacles:Area[],reserved:ReservedRoad[]):Point{
 const bay=bayPosition(terminal,topic),paved=connectionPosition(terminal,topic),side=terminal.wall==='side',clearance=lanes*11+22;
 const usable=(point:Point)=>{
  if((side?point.v!==bay.v||point.u<=bay.u:point.u!==bay.u||point.v<=bay.v)||distance(bay,point)<connectionLength+8||distance(bay,point)>distance(bay,planned))return false;
  if(roadEdgeBlocked(paved,point,reserved,lanes*11+18))return false;
  return !obstacles.some(area=>area!==terminal&&(side
   ? point.v>area.v-clearance&&point.v<area.v+area.depth+clearance&&Math.max(paved.u,point.u)>area.u-clearance&&Math.min(paved.u,point.u)<area.u+area.width+clearance
   : point.u>area.u-clearance&&point.u<area.u+area.width+clearance&&Math.max(paved.v,point.v)>area.v-clearance&&Math.min(paved.v,point.v)<area.v+area.depth+clearance));
 };
 const contacts:Point[]=[];
 for(const edge of edges){
  if(side&&edge.from.u===edge.to.u&&bay.v>=Math.min(edge.from.v,edge.to.v)&&bay.v<=Math.max(edge.from.v,edge.to.v))contacts.push({u:edge.from.u,v:bay.v});
  else if(!side&&edge.from.v===edge.to.v&&bay.u>=Math.min(edge.from.u,edge.to.u)&&bay.u<=Math.max(edge.from.u,edge.to.u))contacts.push({u:bay.u,v:edge.from.v});
  else for(const point of [edge.from,edge.to])if(side?point.v===bay.v:point.u===bay.u)contacts.push(point);
 }
 const direct=contacts.filter(usable).sort((a,b)=>distance(bay,a)-distance(bay,b));
 if(direct.length)return direct[0];
 const aligned=neighbors.map(point=>side?{u:point.u,v:bay.v}:{u:bay.u,v:point.v}).filter(usable).sort((a,b)=>distance(bay,a)-distance(bay,b));
 return aligned.length?aligned[0]:planned;
}
