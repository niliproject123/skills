import {renderModel} from './scenarioRuntime';
import type {Route} from './scenarioTypes';
import {terminals} from './terminalLayout';
import {connectionLength,connectionPosition,pointAtBay} from './terminalConnection';
import type {Service,Topic} from './model';
import type {BuildingLayout} from './IsoBuilding';
import type {GroundPoint,Direction} from './isometric';
import type {RoadSegment} from './IsoRoad';
export const cityBuildings=renderModel.cityBuildings;
export type TrafficRoute=Route;
export const cityRoutes=renderModel.cityRoutes;
export function pavedRoutePoints(route:TrafficRoute):GroundPoint[]{
 const points=route.points.map(point=>({...point})),producer=terminals.find(terminal=>terminal.producer&&terminal.topics.includes(route.topic)&&pointAtBay(terminal,points[0])),receiver=terminals.find(terminal=>terminal.id===route.terminal);
 if(!receiver)throw new Error(`Missing terminal ${route.terminal}`);
 if(producer)points[0]=connectionPosition(producer);
 if(!receiver.producer)points[points.length-1]=connectionPosition(receiver);
 return points.filter((point,index)=>index===0||point.u!==points[index-1].u||point.v!==points[index-1].v);
}
export const roadSegments=(topic:Topic):RoadSegment[]=>cityRoutes.filter(route=>route.topic===topic).flatMap(route=>{
 const origin=route.points[0];
 const producer=terminals.find(terminal=>terminal.producer&&terminal.topics.includes(topic)&&pointAtBay(terminal,origin));
 return route.points.slice(1).map((to,index)=>({from:index===0&&producer?connectionPosition(producer):route.points[index],to:index===route.points.length-2&&!terminals.find(terminal=>terminal.id===route.terminal)!.producer?connectionPosition(terminals.find(terminal=>terminal.id===route.terminal)!):to,lanes:route.lanes,join:index<route.points.length-2}));
});
export const routeLength=(points:GroundPoint[])=>points.slice(1).reduce((length,point,index)=>length+Math.abs(point.u-points[index].u)+Math.abs(point.v-points[index].v),0);
export function onRoute(points:GroundPoint[],distance:number):GroundPoint&{direction:Direction} {
 for(let index=1;index<points.length;index++){
 const from=points[index-1],to=points[index],length=Math.abs(to.u-from.u)+Math.abs(to.v-from.v);
 if(distance<=length||index===points.length-1){const fraction=Math.min(1,Math.max(0,distance/length));return {u:from.u+(to.u-from.u)*fraction,v:from.v+(to.v-from.v)*fraction,direction:to.u>from.u?'east':to.u<from.u?'west':to.v>from.v?'south':'north'};}
 distance-=length;
 }throw new Error('Traffic route requires at least two ground points');
}
