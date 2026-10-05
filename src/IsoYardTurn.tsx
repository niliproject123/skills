import {topics} from './model';
import type {TerminalLayout} from './terminalLayout';
import {connectionPosition} from './terminalConnection';
import {yardTurn} from './turnGeometry';
import {vertices} from './isometric';
import {topicTheme} from './topicTheme';
export function IsoYardTurn({terminal}:{terminal:TerminalLayout}){
 const start=connectionPosition(terminal),count=topics[terminal.topics[0]].partitions,paths=Array.from({length:count},(_,lane)=>{const offset=(lane-(count-1)/2)*22,entry=terminal.wall==='side'?{u:start.u,v:start.v-offset}:{u:start.u+offset,v:start.v};return [entry,...yardTurn(entry,terminal.wall==='side')];});
 const line=(points:typeof paths[number])=>vertices(points.map(point=>[point.u,point.v]));
 return <g aria-label="Receiving yard turning loops">{paths.map((points,index)=><polyline key={`curb-${index}`} points={line(points)} fill="none" stroke="#ded2b3" strokeWidth="24" strokeLinejoin="round"/>)}{paths.map((points,index)=><polyline key={`yard-${index}`} points={line(points)} fill="none" stroke="#a7aaa0" strokeWidth="20" strokeLinejoin="round"/>)}{paths.map((points,index)=><polyline key={`line-${index}`} points={line(points)} fill="none" stroke={topicTheme[terminal.topics[0]].accent} strokeWidth="2" strokeDasharray="7 9"/>)}</g>;

}
