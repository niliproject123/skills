import type {TerminalLayout} from './terminalLayout';
export const apronLength=28;
export const drivewayLength=32;
export const connectionLength=apronLength+drivewayLength;
export function connectionPosition(terminal:TerminalLayout){
 return terminal.wall==='side'
 ? {u:terminal.u+terminal.width+connectionLength,v:terminal.v+terminal.depth/2}
 : {u:terminal.u+terminal.width/2,v:terminal.v+terminal.depth+connectionLength};
}
export function bayPosition(terminal:TerminalLayout){return terminal.wall==='side'?{u:terminal.u+terminal.width,v:terminal.v+terminal.depth/2}:{u:terminal.u+terminal.width/2,v:terminal.v+terminal.depth};}
export function pointAtBay(terminal:TerminalLayout,point:{u:number;v:number}){return terminal.wall==='side'?point.u===terminal.u+terminal.width&&point.v>=terminal.v&&point.v<=terminal.v+terminal.depth:point.v===terminal.v+terminal.depth&&point.u>=terminal.u&&point.u<=terminal.u+terminal.width;}
