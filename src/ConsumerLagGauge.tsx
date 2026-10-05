import {groupById} from './kafkaTopology';
import {project,vertices} from './isometric';
import type {TerminalLayout} from './terminalLayout';
export function ConsumerLagGauge({terminal}:{terminal:TerminalLayout}){
 const group=groupById(terminal.id);
 const level=group.lag/(group.lag+10000),color=level<.2?'#73b76e':level<.6?'#efb74e':'#db6554';
 const u=terminal.width/2,v=terminal.depth/2,center=project(u,v,95);
 return <g aria-label={`${group.name} lag ${group.lag}`}>
 {[-18,18].map(offset=><polyline key={offset} points={vertices([[u+offset,v,55],[u+offset,v,90]])} stroke="#738777" strokeWidth="5"/>)}
 <g transform={`translate(${center.x},${center.y})`}><rect x="-36" y="-22" width="72" height="38" rx="10" fill="#ead8af" stroke="#8a987c" strokeWidth="3"/>
 <rect x="-29" y="-15" width="58" height="11" rx="5" fill="#485950"/><rect x="-28" y="-14" width={Math.max(2,56*level)} height="9" rx="4" fill={color}/>
 <text y="9" textAnchor="middle" fill={color} fontSize="12" fontWeight="800">{group.lag.toLocaleString('en-US')}</text></g>
 </g>;
}
