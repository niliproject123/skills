import {useEffect,useRef} from 'react';
import {IsoBuilding} from './IsoBuilding';
import {IsoRoad} from './IsoRoad';
import {IsoVehicle,type VehicleKind} from './IsoVehicle';
import {CityTerrain,GardenProps,decoration} from './CityTerrain';
import {IsoTree} from './IsoPrimitives';
import {cityBuildings,cityRoutes,roadSegments} from './cityLayout';
import {CitySimulation,trafficUnits} from './CitySimulation';
import {services,type Service,type Topic,type Selection} from './model';
import {vertices,type Direction} from './isometric';
const directions:Direction[]=['east','west','south','north'];
const kinds:VehicleKind[]=['car','van','truck','semi'];
function linked(topic:Topic,selected:Selection|null){return !selected||selected.kind==='topic'&&selected.name===topic||selected.kind==='gate'&&selected.topic===topic||selected.kind==='service'&&[...services[selected.name].produces,...services[selected.name].consumes].includes(topic);}
export function CityWorld({paused,speed,selected,onSelect,camera}:{paused:boolean;speed:number;selected:Selection|null;onSelect:(selection:Selection)=>void;camera:{x:number;y:number;zoom:number}}){
 const layer=useRef<SVGGElement>(null),simulation=useRef(new CitySimulation());
 useEffect(()=>{
 const units=trafficUnits.map(unit=>{const element=layer.current?.querySelector<SVGGElement>(`[data-unit="${unit.id}"]`);if(!element)throw new Error(`Missing vehicle sprite ${unit.id}`);const sprite=element.querySelector('use');if(!sprite)throw new Error(`Missing sprite reference ${unit.id}`);return {unit,element,sprite};});
 const stationary=Array.from(layer.current!.children).filter(element=>!element.hasAttribute('data-unit'));
 let frame=0,last=performance.now();
 function animate(now:number){if(!paused)simulation.current.advance(Math.min(.08,(now-last)/1000)*speed);last=now;
 const ordered:{element:Element;depth:number}[]=stationary.map(element=>({element,depth:Number(element.getAttribute('data-depth'))}));
 for(const {unit,element,sprite} of units){const point=simulation.current.position(unit);element.setAttribute('transform',`translate(${point.x},${point.y})`);sprite.setAttribute('href',`#${unit.kind}-${point.direction}-${unit.waiting?'waiting':'moving'}`);ordered.push({element,depth:point.depth});}
 ordered.sort((a,b)=>a.depth-b.depth);let previous:Element|null=null;
 for(const item of ordered){const expected:Element|null=previous?previous.nextElementSibling:layer.current!.firstElementChild;if(expected!==item.element)layer.current!.insertBefore(item.element,expected);previous=item.element;}
 frame=requestAnimationFrame(animate);
 }frame=requestAnimationFrame(animate);return()=>cancelAnimationFrame(frame);
 },[paused,speed]);
 return <g transform={`translate(${camera.x},${camera.y}) translate(750,500) scale(${camera.zoom}) translate(-750,-500)`}><g transform="translate(350,110) scale(.8)">
 <defs>{kinds.flatMap(kind=>directions.flatMap(direction=>[false,true].map(waiting=><g key={`${kind}-${direction}-${waiting}`} id={`${kind}-${direction}-${waiting?'waiting':'moving'}`}><IsoVehicle kind={kind} direction={direction} waiting={waiting}/></g>)))}</defs>
 <CityTerrain/>
 <IsoRoad label="orders topic" segments={roadSegments('orders')} active={linked('orders',selected)} onClick={()=>onSelect({kind:'topic',name:'orders'})}/>
 <IsoRoad topic="payments" label="payments topic" segments={roadSegments('payments')} active={linked('payments',selected)} onClick={()=>onSelect({kind:'topic',name:'payments'})}/>
 {/* Short loading drives fan out from topic lanes into physical bays. */}
 {(Object.entries(cityBuildings) as [Service,typeof cityBuildings.Orders][]).map(([name,building])=><g key={name} opacity={!selected||selected.name===name?1:.75}>{Array.from({length:services[name].consumers},(_,index)=>{const u=building.u+(index+1)*building.width/(services[name].consumers+1),v=building.v+building.depth;return <polygon key={`in-${index}`} points={vertices([[u-15,v],[u+15,v],[u+15,v+35],[u-15,v+35]])} fill="#baa786" stroke="#f3d99f" strokeWidth="1"/>;})}{Array.from({length:services[name].producers},(_,index)=>{const u=building.u+building.width,v=building.v+(index+1)*building.depth/(services[name].producers+1);return <polygon key={`out-${index}`} points={vertices([[u,v-14],[u+35,v-14],[u+35,v+14],[u,v+14]])} fill="#baa786" stroke="#f3d99f" strokeWidth="1"/>;})}</g>)}
 <g ref={layer}>
 {decoration.map((tree,index)=><g key={`tree-${index}`} data-depth={tree.u+tree.v+18}><IsoTree {...tree}/></g>)}
 {(Object.keys(cityBuildings) as Service[]).map(name=>{const building=cityBuildings[name];return <g key={name} data-depth={building.u+building.v+building.width/2+building.depth}><IsoBuilding name={name} layout={building} selected={selected} onSelect={onSelect}/></g>;})}
 {trafficUnits.map(unit=><g key={unit.id} data-unit={unit.id} data-queued={unit.waiting} opacity={linked(cityRoutes[unit.route].topic,selected)?1:.25} pointerEvents="none"><use href={`#${unit.kind}-east-${unit.waiting?'waiting':'moving'}`}/></g>)}
 </g><GardenProps/>
 </g></g>;
}
