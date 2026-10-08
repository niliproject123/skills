import {roadReservations} from './roadClearance';
import {planBridges} from './bridgePlanning';
import {shortestRoad} from './shortestRoad';
import {RoadLayoutConflict} from './roadLayoutConflict';
import type {LayoutConfiguration,Terminal,Point,Route,Bridge} from './scenarioTypes';
import {bayPosition,dockApproachLength} from './terminalConnection';
import {computeLayout} from './autoLayout';
export function topicTrunkRoute(config:LayoutConfiguration,terminals:Terminal[],topic:string,producer:Terminal|undefined,receiver:Terminal,_topicIndex:number,existingRoutes:Route[]=[]):Point[]{
 const start=producer?bayPosition(producer,topic):{u:receiver.u-260,v:receiver.v+receiver.depth+260},end=bayPosition(receiver,topic),lanes=config.topology.topics.find(item=>item.id===topic)!.partitionCount,clearance=lanes*11+22;
 const driveway=(terminal:Terminal|undefined,point:Point)=>terminal?.wall==='front'?{u:point.u,v:point.v+dockApproachLength(lanes)}:{u:point.u+dockApproachLength(lanes),v:point.v};
 const exit=driveway(producer,start),entrance=driveway(receiver,end);
 if(receiver.producer)return [start,exit,{u:exit.u+180,v:exit.v}];
 const obstacles=[...Object.values(computeLayout(config.topology,config.layout)).map(building=>({...building,width:building.width??150,depth:building.depth??110})),...terminals];
 try {return [start,...shortestRoad(exit,entrance,obstacles,clearance,roadReservations(existingRoutes,terminals,topic,lanes,config.topology.topics),{start:producer?.wall==='front'?{u:0,v:1}:{u:1,v:0},end:receiver.wall==='front'?{u:0,v:-1}:{u:-1,v:0}}),end];}catch(error){if(!(error instanceof RoadLayoutConflict))throw error;throw new RoadLayoutConflict(`Cannot route ${topic}: ${producer?.id??'external'} to ${receiver.id}, driveway (${exit.u}, ${exit.v}) to (${entrance.u}, ${entrance.v}). ${error.message}`);}
}

export function automaticOverpasses(config:LayoutConfiguration,routes:Route[],terminals:Terminal[]):Omit<Bridge,'depth'|'lanes'>[]{
 return planBridges(config,routes,terminals);
}
