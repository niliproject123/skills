import type {GroundPoint} from './isometric';
import {vertices} from './isometric';
import {yardTurn} from './turnGeometry';
export function IsoRoadTurn({point,side,half,forward,color}:{point:GroundPoint;side:boolean;half:number;forward:number;color:string}){
 const center=side?{u:point.u,v:point.v+36}:{u:point.u+36,v:point.v},radius=Math.max(half+12,50),circle=Array.from({length:48},(_,index)=>{const angle=index*Math.PI/24;return [center.u+Math.cos(angle)*radius,center.v+Math.sin(angle)*radius];});
 return <g aria-label="Road turnaround"><polygon points={vertices(circle)} fill="#586c68" stroke="#e4ca8f" strokeWidth="5"/><polyline points={vertices([point,...yardTurn(point,side,36,forward)].map(p=>[p.u,p.v]))} fill="none" stroke={color} strokeWidth="2" strokeDasharray="8 10"/></g>;
}
