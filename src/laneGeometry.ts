import type {GroundPoint,Direction} from './isometric';
export type LanePath={points:GroundPoint[];distances:number[];length:number};
const gap=(a:GroundPoint,b:GroundPoint)=>Math.hypot(b.u-a.u,b.v-a.v);
const blend=(a:GroundPoint,b:GroundPoint,t:number)=>({u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
export function curvedCenterline(points:GroundPoint[],radius:number):GroundPoint[]{
 if(points.length<2)throw new Error('A lane path needs two distinct points');
 const result:GroundPoint[]=[points[0]];
 for(let index=1;index<points.length-1;index++){
 const before=points[index-1],corner=points[index],after=points[index+1],incoming=gap(before,corner),outgoing=gap(corner,after);
 if(!incoming||!outgoing)throw new Error('A lane path contains duplicate waypoints');
 const cross=(corner.u-before.u)*(after.v-corner.v)-(corner.v-before.v)*(after.u-corner.u);
 if(Math.abs(cross)<.001){result.push(corner);continue;}
 const reach=Math.min(radius,incoming*.45,outgoing*.45),start=blend(corner,before,reach/incoming),end=blend(corner,after,reach/outgoing);
 result.push(start);
 const samples=Math.max(12,Math.ceil(reach/2));
 for(let step=1;step<=samples;step++){const t=step/samples;result.push(blend(blend(start,corner,t),blend(corner,end,t),t));}
 }
 result.push(points[points.length-1]);return result;
}
export function offsetCurve(points:GroundPoint[],offset:number):GroundPoint[]{return points.map((point,index)=>{
 const before=points[Math.max(0,index-1)],after=points[Math.min(points.length-1,index+1)],length=gap(before,after);
 if(!length)throw new Error('Cannot offset a zero-length road tangent');
 return {u:point.u-(after.v-before.v)*offset/length,v:point.v+(after.u-before.u)*offset/length};
});}
export function lanePath(points:GroundPoint[]):LanePath{
 const distances=[0];for(let index=1;index<points.length;index++){const length=gap(points[index-1],points[index]);if(length<=0)throw new Error('A lane contains a zero-length section');distances.push(distances[index-1]+length);}
 return {points,distances,length:distances.at(-1)!};
}
export function sampleLane(path:LanePath,distance:number){
 let low=1,high=path.points.length-1;const position=Math.max(0,Math.min(path.length,distance));
 while(low<high){const middle=(low+high)>>1;if(path.distances[middle]<position)low=middle+1;else high=middle;}
 const before=path.points[low-1],after=path.points[low],point=blend(before,after,(position-path.distances[low-1])/(path.distances[low]-path.distances[low-1]));
 const du=after.u-before.u,dv=after.v-before.v,direction:Direction=Math.abs(du)>=Math.abs(dv)?du>=0?'east':'west':dv>=0?'south':'north';
 return {...point,direction};
}
// Solve each following axle against the previous axle, on the same lane.
export function linkedDistance(path:LanePath,leadingDistance:number,separation:number){
 if(leadingDistance<0)return leadingDistance-separation;
 const leading=sampleLane(path,leadingDistance);let near=leadingDistance,far=Math.max(0,leadingDistance-separation);
 while(gap(sampleLane(path,far),leading)<separation){
 if(far===0)return -separation;
 near=far;far=Math.max(0,far-separation/2);
 }
 for(let step=0;step<18;step++){const middle=(near+far)/2,point=sampleLane(path,middle);if(gap(point,leading)<separation)near=middle;else far=middle;}
 return (near+far)/2;
}
