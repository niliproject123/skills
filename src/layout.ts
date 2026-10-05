import type {Service,Topic} from './model';
export type Point = [number,number];
export const buildings: Record<Service,Point> = {Orders:[190,360],Payment:[755,360],Analytics:[1010,640],Notification:[1000,125]};
export type Route = {topic:Topic; destination:Service; points:Point[]; lanes:number; queue:number; interval:number};
export const routes:Route[] = [
 {topic:'orders',destination:'Payment',points:[[245,433],[520,490],[660,475],[790,433]],lanes:4,queue:0,interval:1},
 {topic:'orders',destination:'Analytics',points:[[245,433],[520,490],[660,570],[905,725],[1035,713]],lanes:4,queue:5,interval:2.5},
 {topic:'payments',destination:'Notification',points:[[855,433],[935,365],[1005,285],[1020,198]],lanes:2,queue:14,interval:5}
];
export function along(points:Point[],fraction:number):{x:number;y:number;angle:number} {
 const lengths=points.slice(1).map((point,index)=>Math.hypot(point[0]-points[index][0],point[1]-points[index][1]));
 let distance=Math.max(0,Math.min(1,fraction))*lengths.reduce((a,b)=>a+b,0);
 for(let index=0;index<lengths.length;index++) { if(distance<=lengths[index] || index===lengths.length-1) {
 const start=points[index],end=points[index+1],portion=distance/lengths[index];
 return {x:start[0]+(end[0]-start[0])*portion,y:start[1]+(end[1]-start[1])*portion,angle:Math.atan2(end[1]-start[1],end[0]-start[0])*180/Math.PI};
 } distance-=lengths[index]; } throw new Error('Route must have at least two points');
}
