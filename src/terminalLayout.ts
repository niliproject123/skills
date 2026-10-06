import {bridgeAcross,bridgePosition,bridgeHeight,bridgeEnd} from './bridgeGeometry';
import {renderModel} from './scenarioRuntime';
import type {Terminal} from './scenarioTypes';
import type {GroundPoint} from './isometric';
import {consumerGroups,producers} from './kafkaTopology';
import type {Service,Topic} from './model';
export type TerminalLayout=GroundPoint&{id:string;width:number;depth:number;wall:'front'|'side';producer:boolean;service:Service;topics:Topic[];instances:number};
export const terminals:Terminal[]=renderModel.terminals;
export function terminalById(id:string){const terminal=terminals.find(terminal=>terminal.id===id);if(!terminal)throw new Error(`Terminal layout missing for ${id}`);return terminal;}
export const overpasses=renderModel.overpasses;
export function roadElevation(topic:Topic,u:number,v:number,_routeId?:string){for(const bridge of overpasses){const point={u,v},along=bridgePosition(bridge,point);if(topic===bridge.topic&&Math.abs(bridgeAcross(bridge,point))<=bridge.lanes*11+13&&along>=bridge.start&&along<=bridgeEnd(bridge))return bridgeHeight(bridge,along);}return 0;}
