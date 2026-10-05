import {along,routes} from './layout';
export class SimulationEngine {
 elapsed=0;
 advance(seconds:number) { this.elapsed+=seconds; }
 position(routeIndex:number,index:number,queued:boolean) {
 const route=routes[routeIndex];
 const cycle=this.elapsed/route.interval;
 const phase=cycle%1;
 const fraction=queued ? 1-((index+1-phase)*0.027) : ((index/(route.topic==='orders'?28:12)+this.elapsed*0.037)%1)*(route.queue?1-route.queue*0.027:1);
 const point=along(route.points,fraction);
 const lane=index%route.lanes;
 const offset=(lane-(route.lanes-1)/2)*12;
 const radians=point.angle*Math.PI/180;
 return {...point,x:point.x-Math.sin(radians)*offset,y:point.y+Math.cos(radians)*offset,type:queued?(index+Math.floor(cycle))%4:index%4};
 }
}
