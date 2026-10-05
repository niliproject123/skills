import {shortestRoad} from './shortestRoad';
import type {LayoutConfiguration,Terminal,Point,Route,Bridge} from './scenarioTypes';
import {bayPosition,connectionLength} from './terminalConnection';
import {computeLayout} from './autoLayout';
export function topicTrunkRoute(config:LayoutConfiguration,terminals:Terminal[],topic:string,producer:Terminal|undefined,receiver:Terminal,_topicIndex:number):Point[]{
 const start=producer?bayPosition(producer):{u:receiver.u-260,v:receiver.v+receiver.depth+260},end=bayPosition(receiver),lanes=config.topology.topics.find(item=>item.id===topic)!.partitionCount,clearance=lanes*11+22;
 const driveway=(terminal:Terminal|undefined,point:Point)=>terminal?.wall==='front'?{u:point.u,v:point.v+connectionLength+clearance+20}:{u:point.u+connectionLength+clearance+20,v:point.v};
 const exit=driveway(producer,start),entrance=driveway(receiver,end);
 if(receiver.producer)return [start,exit,{u:exit.u+180,v:exit.v}];
 const obstacles=[...Object.values(computeLayout(config.topology,config.layout)).map(building=>({...building,width:building.width??150,depth:building.depth??110})),...terminals];
 return [start,...shortestRoad(exit,entrance,obstacles,clearance),end];
}

export function automaticOverpasses(config:LayoutConfiguration,routes:Route[]):Omit<Bridge,'depth'|'lanes'>[]{
 const bridges=config.layout.overpasses.map(bridge=>({...bridge}));
 const segments=routes.flatMap(route=>route.points.slice(1).map((to,index)=>({route,from:route.points[index],to})));
 for(const vertical of segments){if(vertical.from.u!==vertical.to.u||config.layout.routes[vertical.route.id]||config.layout.topics[vertical.route.topic])continue;
 for(const horizontal of segments){if(horizontal.route.topic===vertical.route.topic||horizontal.from.v!==horizontal.to.v)continue;const u=vertical.from.u,v=horizontal.from.v;if(u<=Math.min(horizontal.from.u,horizontal.to.u)||u>=Math.max(horizontal.from.u,horizontal.to.u)||v<=Math.min(vertical.from.v,vertical.to.v)||v>=Math.max(vertical.from.v,vertical.to.v))continue;
 const deck=horizontal.route.lanes*22+18,ramp=55,start=v-deck/2-ramp,end=v+deck/2+ramp;
 if(start-Math.min(vertical.from.v,vertical.to.v)<70||Math.max(vertical.from.v,vertical.to.v)-end<70)continue;
 if(bridges.some(bridge=>Math.abs(bridge.u-u)<vertical.route.lanes*22+30&&Math.abs(bridge.v-v)<bridge.deck/2+bridge.ramp+deck/2+ramp))continue;
 bridges.push({id:`auto-bridge-${bridges.length+1}`,topic:vertical.route.topic,u,v,start,ramp,deck,height:48});
 }}return bridges;
}
