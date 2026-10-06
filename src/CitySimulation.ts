import {bridgeAcross,bridgePosition} from './bridgeGeometry';
import {pointAtBay} from './terminalConnection';
import {consumerGroups} from './kafkaTopology';
import {cityRoutes,pavedRoutePoints,type TrafficRoute} from './cityLayout';
import {curvedCenterline,offsetCurve,lanePath,sampleLane,type LanePath} from './laneGeometry';
import {project,type Direction} from './isometric';
import type {VehicleKind} from './IsoVehicle';
import {partitionLoads} from './kafkaTopology';
import {terminalById,roadElevation,overpasses,terminals,type TerminalLayout} from './terminalLayout';
export type TrafficUnit={id:string;route:number;index:number;waiting:boolean;kind:VehicleKind;partition:number;trailers:number;laneIndex:number;laneCount:number};
export const makeTrafficUnits=(routes:TrafficRoute[]):TrafficUnit[]=>routes.flatMap((route,routeIndex)=>[false,true].flatMap(waiting=>{
 const expected=waiting?route.queue:route.moving,configured=waiting?route.queueLanes:route.laneTraffic;
 const counts=configured.reduce((sum,count)=>sum+count,0)===expected?configured:Array.from({length:route.lanes},(_,lane)=>Math.floor(expected/route.lanes)+(lane<expected%route.lanes?1:0));
 return counts.flatMap((count,partition)=>Array.from({length:count},(_,laneIndex)=>{const load=partitionLoads[route.topic][partition];return {id:`${routeIndex}-${waiting}-${partition}-${laneIndex}`,route:routeIndex,index:laneIndex*route.lanes+partition,laneIndex,laneCount:count,waiting,kind:load.kind,partition,trailers:load.trailers};}));
}));
export const trafficUnits=makeTrafficUnits(cityRoutes);
export class CitySimulation {
 private paths:LanePath[][];
 constructor(private routes:TrafficRoute[]=cityRoutes){
 this.paths=routes.map(route=>{const origin=terminals.find(terminal=>terminal.producer&&terminal.topics.includes(route.topic)&&pointAtBay(terminal,route.points[0])),receiver=terminalById(route.terminal),center=curvedCenterline(pavedRoutePoints(route),route.lanes*11+18);
 return Array.from({length:route.lanes},(_,partition)=>{
 const points=offsetCurve(center,(partition-(route.lanes-1)/2)*22);
 const gatePoint=(terminal:TerminalLayout)=>{const gate=Math.round(partition*(terminal.instances-1)/Math.max(1,route.lanes-1));return terminal.wall==='front'?{u:terminal.u+(gate+1)*terminal.width/(terminal.instances+1),v:terminal.v+terminal.depth}:{u:terminal.u+terminal.width,v:terminal.v+(gate+1)*terminal.depth/(terminal.instances+1)};};
 if(origin)points.unshift(gatePoint(origin));if(!receiver.producer)points.push(gatePoint(receiver));return lanePath(points);
 });});
 }
 chain(unit:TrafficUnit){
 const path=this.paths[unit.route][unit.partition],chain=[this.pose(unit,this.distance(unit))];let distance=this.distance(unit);
 for(let index=0;index<(unit.kind==='semi'?unit.trailers:0);index++){distance-=index===0?38:46;chain.push(this.pose(unit,distance));}return chain;
 }

 elapsed=0;
 advance(seconds:number){this.elapsed+=seconds;}
 private distance(unit:TrafficUnit){
 const route=this.routes[unit.route],path=this.paths[unit.route][unit.partition],length=path.length;
 const cycle=route.consumeEvery===Infinity?0:this.elapsed/route.consumeEvery-unit.partition/route.lanes,progress=((cycle%1)+1)%1;
 const queueSpacing=Math.max(76,partitionLoads[route.topic].reduce((largest,load)=>Math.max(largest,load.trailers*46+40),58));
 const queueRows=Math.ceil((consumerGroups.find(group=>group.id===route.terminal)?.waiting??0)/route.lanes),queueLength=queueRows*queueSpacing;
 let distance:number;
 if(unit.waiting){const row=((unit.laneIndex-Math.floor(cycle))%queueRows+queueRows)%queueRows;distance=length-(row+1-progress)*queueSpacing;}
 else {const available=Math.max(30,queueLength?length-queueLength-20:path.length);const load=partitionLoads[route.topic][unit.partition];const spacing=unit.kind==='semi'?unit.trailers*46+48:unit.kind==='truck'?70:unit.kind==='van'?52:36,visibleCount=Math.min(unit.laneCount,Math.max(1,Math.floor(available/spacing)));distance=unit.laneIndex>=visibleCount?-10000:((unit.laneIndex/visibleCount+this.elapsed*24*load.frequency/available)%1)*available;}
 return distance;
 }
 position(unit:TrafficUnit,behind=0){
 return this.pose(unit,this.distance(unit)-behind);
 }
 private pose(unit:TrafficUnit,distance:number){
 const route=this.routes[unit.route],path=this.paths[unit.route][unit.partition],point=sampleLane(path,distance);
 const height=roadElevation(route.topic,point.u,point.v,route.id),screen=project(point.u,point.v,height);
 let depth=point.u+point.v;
 for(const bridge of overpasses){if(height>0&&bridge.topic===route.topic&&Math.abs(bridgeAcross(bridge,point))<bridge.lanes*11+13)depth=bridge.depth+1;else if(route.topic!==bridge.topic&&Math.abs(bridgeAcross(bridge,point))<bridge.lanes*11+40&&Math.abs(bridgePosition(bridge,point)-(bridge.start+bridge.ramp+bridge.deck/2))<bridge.deck/2+route.lanes*11+30)depth=bridge.depth-1;}
 const tangentAhead=sampleLane(path,Math.min(path.length,distance+2)),tangentBehind=sampleLane(path,Math.max(0,distance-2));
 return {...screen,u:point.u,v:point.v,pathDistance:distance,heading:Math.atan2(tangentAhead.v-tangentBehind.v,tangentAhead.u-tangentBehind.u),depth,direction:point.direction,visible:distance>=0};
 }
}
