import {routes} from './layout';
import type {Selection,Topic} from './model';
export function TopicRoad({topic,selected,onSelect}:{topic:Topic;selected:Selection|null;onSelect:(value:Selection)=>void}) {
 const active=!selected || selected.kind==='gate'&&selected.topic===topic || selected.kind==='topic'&&selected.name===topic || selected.kind==='service'&&(selected.name==='Payment'||topic==='orders'&&['Orders','Analytics'].includes(selected.name)||topic==='payments'&&selected.name==='Notification');
 return <g opacity={active?1:.25} className="road" role="button" tabIndex={0} aria-label={`${topic} topic`} onClick={()=>onSelect({kind:'topic',name:topic})} onKeyDown={event=>{if(event.key==='Enter')onSelect({kind:'topic',name:topic});}}>
 {routes.filter(route=>route.topic===topic).map(route=>{const points=route.points.map(point=>point.join(',')).join(' ');return <g key={route.destination}><polyline points={points} fill="none" stroke={selected&&active?'#f7ce72':'#dce6cf'} strokeWidth={route.lanes*12+12} strokeLinejoin="round"/><polyline points={points} fill="none" stroke="#74888a" strokeWidth={route.lanes*12+2} strokeLinejoin="round"/>{Array.from({length:route.lanes-1},(_,index)=><polyline key={index} points={points} transform={`translate(0,${(index-(route.lanes-2)/2)*12})`} fill="none" stroke="#e7edde" strokeWidth="1.5" strokeDasharray="9 10"/>)}</g>;})}
 <g transform={topic==='orders'?'translate(450,435)':'translate(880,225)'}><path d="M0 0v40" stroke="#748369" strokeWidth="5"/><rect x="-48" y="-15" width="110" height="28" rx="5" fill="#fff8df" stroke="#98ae8a" strokeWidth="2"/><text x="7" y="4" textAnchor="middle" fill="#40594c" fontWeight="800" fontSize="13">{topic.toUpperCase()}</text></g>
 </g>;
}
