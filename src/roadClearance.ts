import type {Point,Route,Terminal} from './scenarioTypes';
import {bayPosition,connectionPosition,pointAtBay,dockApproachLength} from './terminalConnection';

export type ReservedRoad={from:Point;to:Point;margin:number;shared?:boolean;driveway?:boolean;bendFrom?:number;bendTo?:number};
export const roadGap=28;
const intervalOverlap=(a:number,b:number,c:number,d:number)=>Math.max(a,b)>Math.min(c,d)&&Math.min(a,b)<Math.max(c,d);
const cornerBuffer=(road:ReservedRoad,cornerRadius:number)=>road.margin+(cornerRadius+Math.max(road.bendFrom??0,road.bendTo??0))/4;

export function roadReservations(routes:Route[],terminals:Terminal[],topic:string,lanes:number,topics:{id:string;partitionCount:number}[]):ReservedRoad[]{
 const result:ReservedRoad[]=[];
 for(const route of routes){
  const points=route.points.map(point=>({...point}));
  const producer=terminals.find(terminal=>terminal.producer&&terminal.topics.includes(route.topic)&&pointAtBay(terminal,points[0]));
  const receiver=terminals.find(terminal=>terminal.id===route.terminal);
  if(producer)points[0]=connectionPosition(producer,route.topic);
  if(receiver&&!receiver.producer)points[points.length-1]=connectionPosition(receiver,route.topic);
  const bend=(index:number)=>{if(index===0||index===points.length-1)return 0;const a=points[index-1],b=points[index],c=points[index+1];return (b.u-a.u)*(c.v-b.v)!==(b.v-a.v)*(c.u-b.u)?route.lanes*11+18:0;};
  points.slice(1).forEach((to,index)=>result.push({from:points[index],to,margin:route.lanes*11+lanes*11+roadGap,shared:route.topic===topic,driveway:(index===0&&!!producer)||(index===points.length-2&&!!receiver&&!receiver.producer),bendFrom:bend(index),bendTo:bend(index+1)}));
 }
 // Reserve future docks before the first topic is routed. Otherwise an early
 // trunk can occupy a later topic's fixed driveway and trap its entrance.
 for(const terminal of terminals)for(const otherTopic of terminal.topics){
  if(otherTopic===topic)continue;
  const definition=topics.find(item=>item.id===otherTopic);if(!definition)throw new Error(`Missing topic ${otherTopic} while reserving driveway ${terminal.id}.`);
  const width=definition.partitionCount,from=connectionPosition(terminal,otherTopic),bay=bayPosition(terminal,otherTopic),length=dockApproachLength(width);
  const to=terminal.wall==='front'?{u:bay.u,v:bay.v+length}:{u:bay.u+length,v:bay.v};
  result.push({from,to,margin:width*11+lanes*11+roadGap,driveway:true});
 }
 const unique=new Map<string,ReservedRoad>();
 for(const road of result){const a=`${road.from.u}/${road.from.v}`,b=`${road.to.u}/${road.to.v}`,key=a<b?`${a}/${b}/${road.margin}/${road.shared}/${road.driveway}`:`${b}/${a}/${road.margin}/${road.shared}/${road.driveway}`;const existing=unique.get(key);if(!existing)unique.set(key,road);else{const forward=existing.from.u===road.from.u&&existing.from.v===road.from.v;existing.bendFrom=Math.max(existing.bendFrom??0,(forward?road.bendFrom:road.bendTo)??0);existing.bendTo=Math.max(existing.bendTo??0,(forward?road.bendTo:road.bendFrom)??0);}}
 return [...unique.values()];
}

export function roadEdgeBlocked(from:Point,to:Point,roads:ReservedRoad[],cornerRadius:number){
 const vertical=from.u===to.u;
 return roads.some(road=>{
  if(road.shared)return false;
  const otherVertical=road.from.u===road.to.u;
  if(road.driveway){const left=Math.min(road.from.u,road.to.u)-road.margin,right=Math.max(road.from.u,road.to.u)+road.margin,back=Math.min(road.from.v,road.to.v)-road.margin,front=Math.max(road.from.v,road.to.v)+road.margin;if(vertical?from.u>left&&from.u<right&&intervalOverlap(from.v,to.v,back,front):from.v>back&&from.v<front&&intervalOverlap(from.u,to.u,left,right))return true;}
  if(vertical===otherVertical){
   const separation=vertical?Math.abs(from.u-road.from.u):Math.abs(from.v-road.from.v);
   const overlaps=vertical?intervalOverlap(from.v,to.v,Math.min(road.from.v,road.to.v)-road.margin,Math.max(road.from.v,road.to.v)+road.margin):intervalOverlap(from.u,to.u,Math.min(road.from.u,road.to.u)-road.margin,Math.max(road.from.u,road.to.u)+road.margin);
   if(separation<road.margin&&overlaps)return true;
  }
  // A rounded corner occupies space beyond the two unrounded straight edges.
  return [road.bendFrom?road.from:null,road.bendTo?road.to:null].some(point=>{if(!point)return false;const radius=cornerBuffer(road,cornerRadius);return vertical?Math.abs(from.u-point.u)<radius&&intervalOverlap(from.v,to.v,point.v-radius,point.v+radius):Math.abs(from.v-point.v)<radius&&intervalOverlap(from.u,to.u,point.u-radius,point.u+radius);});
 });
}

export function roadTurnBlocked(point:Point,roads:ReservedRoad[],cornerRadius:number){
 return roads.some(road=>{
  if(road.shared)return false;
  // Leave room for the turning ribbon and a bridge ramp at perpendicular passes.
  const radius=road.margin+cornerRadius+64;
  const left=Math.min(road.from.u,road.to.u)-radius,right=Math.max(road.from.u,road.to.u)+radius;
  const back=Math.min(road.from.v,road.to.v)-radius,front=Math.max(road.from.v,road.to.v)+radius;
  return point.u>left&&point.u<right&&point.v>back&&point.v<front;
 });
}
