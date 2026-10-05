import {curvedCenterline,offsetCurve} from './laneGeometry';
import type {GroundPoint} from './isometric';
import type {RoadSegment} from './IsoRoad';
import {cityRoutes,roadSegments} from './cityLayout';
const cached=new Map<string,{source:unknown;curves:ReturnType<typeof roadCurves>;branches:number[][][]}>();
export function topicRoadGeometry(topic:string){
 const source=cityRoutes.find(route=>route.topic===topic),existing=cached.get(topic);if(existing&&existing.source===source)return existing;
 const segments=roadSegments(topic),geometry={source,curves:roadCurves(segments),branches:roadBranches(segments)};cached.set(topic,geometry);return geometry;
}
export function roadCurves(segments:RoadSegment[]){
 const routes:{points:GroundPoint[];lanes:number}[]=[];
 for(const segment of segments){if(segment.from.u===segment.to.u&&segment.from.v===segment.to.v)continue;const previous=routes.at(-1);if(previous&&previous.points.at(-1)!.u===segment.from.u&&previous.points.at(-1)!.v===segment.from.v&&previous.lanes===segment.lanes)previous.points.push(segment.to);else routes.push({points:[segment.from,segment.to],lanes:segment.lanes});}
 return routes.map(route=>({...route,points:curvedCenterline(route.points,route.lanes*11+18)}));
}
export function roadRibbon(points:GroundPoint[],halfWidth:number):number[][]{
 return [...offsetCurve(points,halfWidth),...offsetCurve(points,-halfWidth).reverse()].map(point=>[point.u,point.v]);
}
// A T/cross branch has one shared paved polygon, built from its actual arms.
export function roadBranches(segments:RoadSegment[]):number[][][]{
 const nodes=new Map<string,GroundPoint>();segments.forEach(segment=>{nodes.set(`${segment.from.u}/${segment.from.v}`,segment.from);nodes.set(`${segment.to.u}/${segment.to.v}`,segment.to);});
 const polygons:number[][][]=[];
 for(const node of nodes.values()){
 const arms=new Map<string,GroundPoint>();let half=0;
 for(const segment of segments){const horizontal=segment.from.v===segment.to.v;
 if(horizontal?node.v!==segment.from.v||node.u<Math.min(segment.from.u,segment.to.u)||node.u>Math.max(segment.from.u,segment.to.u):node.u!==segment.from.u||node.v<Math.min(segment.from.v,segment.to.v)||node.v>Math.max(segment.from.v,segment.to.v))continue;
 half=Math.max(half,segment.lanes*11);
 for(const endpoint of [segment.from,segment.to]){const du=Math.sign(endpoint.u-node.u),dv=Math.sign(endpoint.v-node.v);if(du||dv)arms.set(`${du}/${dv}`,{u:du,v:dv});}
 }
 if(arms.size<3)continue;
 const points=[...arms.values()].flatMap(arm=>[-1,1].map(side=>[node.u+arm.u*half-arm.v*half*side,node.v+arm.v*half+arm.u*half*side])).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const hull=(ordered:number[][])=>{const result:number[][]=[];for(const point of ordered){while(result.length>1&&cross(result.at(-2)!,result.at(-1)!,point)<=0)result.pop();result.push(point);}return result.slice(0,-1);};
 polygons.push([...hull(points),...hull(points.slice().reverse())]);
 }
 return polygons;
}
