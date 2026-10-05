import {useEffect,useRef} from 'react';
import {routes} from './layout';
import {SimulationEngine} from './SimulationEngine';
import {ServiceBuilding} from './ServiceBuilding';
import {TopicRoad} from './TopicRoad';
import {services,type Selection,type Service} from './model';
export function World({paused,speed,selected,onSelect,camera}:{paused:boolean;speed:number;selected:Selection|null;onSelect:(value:Selection)=>void;camera:{x:number;y:number;zoom:number}}) {
 const vehicles=useRef<SVGGElement>(null),engine=useRef(new SimulationEngine());
 useEffect(()=>{let frame:number,last=performance.now();function animate(now:number){if(!paused)engine.current.advance(Math.min((now-last)/1000,.1)*speed);last=now;
 vehicles.current?.querySelectorAll<SVGGElement>('[data-vehicle]').forEach(element=>{const position=engine.current.position(Number(element.dataset.route),Number(element.dataset.index),element.dataset.queued==='true');element.setAttribute('transform',`translate(${position.x},${position.y}) rotate(${position.angle})`);element.querySelector('rect')?.setAttribute('width',String([12,18,24,33][position.type]));});frame=requestAnimationFrame(animate);}frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);},[paused,speed]);
 const relevant=(index:number)=>!selected||selected.kind==='topic'&&selected.name===routes[index].topic||selected.kind==='gate'&&selected.topic===routes[index].topic||selected.kind==='service'&&(selected.name===routes[index].destination||selected.name==='Payment'||selected.name==='Orders'&&routes[index].topic==='orders');
 return <g transform={`translate(${camera.x},${camera.y}) translate(650,420) scale(${camera.zoom}) translate(-650,-420)`}>
 <defs><filter id="shade"><feComponentTransfer><feFuncR type="linear" slope=".82"/><feFuncG type="linear" slope=".82"/><feFuncB type="linear" slope=".82"/></feComponentTransfer></filter><pattern id="grass" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M12 20l3-4m24 30 3-3" stroke="#95b88b" opacity=".25"/></pattern></defs>
 <path d="M55 340 570 50 1260 375 760 805Z" fill="#b9d0a4" stroke="#a3bf90" strokeWidth="12" strokeLinejoin="round"/><path d="M55 340 570 50 1260 375 760 805Z" fill="url(#grass)"/>
 <path d="M340 260 580 155 730 235M510 660 680 715" stroke="#e2d9b3" strokeWidth="17" fill="none" strokeLinecap="round"/>
 {Array.from({length:32},(_,index)=>{const x=130+(index*157%1060),y=180+(index*83%530);if((y>330&&y<540)||(x>850&&y<320))return null;return <g key={index} transform={`translate(${x},${y})`}><ellipse cy="19" rx="20" ry="9" fill="#608e61" opacity=".16"/><path d="M0 0v20" stroke="#8e7954" strokeWidth="5"/><ellipse cy="-7" rx="17" ry="23" fill={index%2?'#7fa76d':'#679966'}/><ellipse cx="-6" cy="-12" rx="9" ry="15" fill="#91b87e"/></g>;})}
 <TopicRoad topic="orders" selected={selected} onSelect={onSelect}/><TopicRoad topic="payments" selected={selected} onSelect={onSelect}/>
 <g ref={vehicles}>{routes.flatMap((route,routeIndex)=>[false,true].flatMap(queued=>Array.from({length:queued?route.queue:route.topic==='orders'?28:12},(_,index)=><g key={`${routeIndex}-${queued}-${index}`} data-vehicle data-route={routeIndex} data-index={index} data-queued={queued} opacity={relevant(routeIndex)?1:.25} pointerEvents="none"><ellipse cx="2" cy="4" rx="14" ry="6" fill="#263e37" opacity=".15"/><rect x="-12" y="-5" width="20" height="10" rx="3" fill={queued?'#f7c86c':['#fff0c1','#d9edef','#de8e58','#eee9db'][index%4]} stroke="#536e6b" strokeWidth="1"/><path d="M-6-4v8" stroke="#819ea5" strokeWidth="3"/><path d="M-7-6h4m-4 12h4m14-12h4m-4 12h4" stroke="#3b4c47" strokeWidth="2"/></g>)))}</g>
 {(Object.keys(services) as Service[]).sort((a,b)=>a.localeCompare(b)).map(name=><ServiceBuilding key={name} name={name} selected={selected} onSelect={onSelect}/>)}
 <g transform="translate(325,590)"><rect width="95" height="42" rx="8" fill="#faf4df"/><text x="47" y="17" textAnchor="middle" fontSize="10" fill="#59705d">TRAFFIC VOLUME</text><path d="M18 32a29 18 0 0 1 58 0" stroke="#a7be89" strokeWidth="5" fill="none"/><path d="M47 34 70 24" stroke="#cf8552" strokeWidth="3"/></g>
 </g>;
}
