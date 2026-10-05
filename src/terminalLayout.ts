import {renderModel} from './scenarioRuntime';
import type {Terminal} from './scenarioTypes';
import type {GroundPoint} from './isometric';
import {consumerGroups,producers} from './kafkaTopology';
import type {Service,Topic} from './model';
export type TerminalLayout=GroundPoint&{id:string;width:number;depth:number;wall:'front'|'side';producer:boolean;service:Service;topics:Topic[];instances:number};
export const terminals:Terminal[]=renderModel.terminals;
export function terminalById(id:string){const terminal=terminals.find(terminal=>terminal.id===id);if(!terminal)throw new Error(`Terminal layout missing for ${id}`);return terminal;}
export const overpasses=renderModel.overpasses;
export function roadElevation(topic:Topic,u:number,v:number,routeId?:string){for(const bridge of overpasses){const end=bridge.start+bridge.ramp*2+bridge.deck;if((!routeId||!bridge.routeId||bridge.routeId===routeId||renderModel.cityRoutes.find(route=>route.id===routeId)?.points.some((point,index,points)=>index>0&&point.u===bridge.u&&points[index-1].u===bridge.u&&v>=Math.min(point.v,points[index-1].v)&&v<=Math.max(point.v,points[index-1].v)))&&topic===bridge.topic&&Math.abs(u-bridge.u)<=bridge.lanes*11+13&&v>=bridge.start&&v<=end)return Math.max(0,Math.min(1,(v-bridge.start)/bridge.ramp,(end-v)/bridge.ramp))*bridge.height;}return 0;}
