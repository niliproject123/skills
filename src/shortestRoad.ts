import {searchRoadGrid} from './roadPathSearch';
import type {Point} from './scenarioTypes';
type Obstacle={u:number;v:number;width:number;depth:number};
// Axis-aligned visibility grid; distance dominates spacing and reuse preferences.
export function shortestRoad(start:Point,end:Point,obstacles:Obstacle[],clearance:number,reserved:{from:Point;to:Point;margin:number;shared?:boolean}[]=[],directions:{start?:Point;end?:Point}={}):Point[]{
 const areas=obstacles.map(area=>({left:area.u-clearance,right:area.u+area.width+clearance,back:area.v-clearance,front:area.v+area.depth+clearance}));
 const columns=[...new Set([start.u,end.u,...areas.flatMap(area=>[area.left,area.right]),...reserved.flatMap(road=>[road.from.u,road.to.u,road.from.u-road.margin,road.from.u+road.margin,road.to.u-road.margin,road.to.u+road.margin])])].sort((a,b)=>a-b);
 const rows=[...new Set([start.v,end.v,...areas.flatMap(area=>[area.back,area.front]),...reserved.flatMap(road=>[road.from.v,road.to.v,road.from.v-road.margin,road.from.v+road.margin,road.to.v-road.margin,road.to.v+road.margin])])].sort((a,b)=>a-b);
 const blocked=(a:Point,b:Point)=>areas.some(area=>a.u===b.u?a.u>area.left&&a.u<area.right&&Math.max(a.v,b.v)>area.back&&Math.min(a.v,b.v)<area.front:a.v>area.back&&a.v<area.front&&Math.max(a.u,b.u)>area.left&&Math.min(a.u,b.u)<area.right);
 const travelCost=(from:Point,to:Point)=>{
  const length=Math.abs(to.u-from.u)+Math.abs(to.v-from.v),vertical=from.u===to.u;
  const parallel=reserved.filter(road=>vertical?road.from.u===road.to.u&&Math.max(from.v,to.v)>Math.min(road.from.v,road.to.v)&&Math.min(from.v,to.v)<Math.max(road.from.v,road.to.v):road.from.v===road.to.v&&Math.max(from.u,to.u)>Math.min(road.from.u,road.to.u)&&Math.min(from.u,to.u)<Math.max(road.from.u,road.to.u));
  if(parallel.some(road=>road.shared&&(vertical?from.u===road.from.u:from.v===road.from.v)))return length*.85;
  const crowded=parallel.some(road=>!road.shared&&(vertical?Math.abs(from.u-road.from.u):Math.abs(from.v-road.from.v))<road.margin);
  // Spacing is a small preference; it must not multiply a direct route's cost.
  return length*(crowded?1.15:1);
 };
 return searchRoadGrid({columns,rows,start,end,blocked,travelCost,directions});
}
