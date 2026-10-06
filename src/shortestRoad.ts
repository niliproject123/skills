import {roadEdgeBlocked,roadTurnBlocked,type ReservedRoad} from './roadClearance';
import {searchRoadGrid} from './roadPathSearch';
import type {Point} from './scenarioTypes';
type Obstacle={u:number;v:number;width:number;depth:number};
// Axis-aligned visibility grid; distance dominates spacing and reuse preferences.
export function shortestRoad(start:Point,end:Point,obstacles:Obstacle[],clearance:number,reserved:ReservedRoad[]=[],directions:{start?:Point;end?:Point;endAt?:(point:Point)=>Point|undefined}={},attachmentBlocked?:(from:Point,to:Point)=>boolean,targets?:Point[]):Point[]{
 const ends=targets??[end];
 const cornerRadius=clearance-4;
 const offsets=(road:ReservedRoad)=>road.shared?[0]:[0,road.margin,-road.margin,road.margin+cornerRadius+64,-road.margin-cornerRadius-64,road.margin+(cornerRadius+Math.max(road.bendFrom??0,road.bendTo??0))/4,-road.margin-(cornerRadius+Math.max(road.bendFrom??0,road.bendTo??0))/4];
 const areas=obstacles.map(area=>({left:area.u-clearance,right:area.u+area.width+clearance,back:area.v-clearance,front:area.v+area.depth+clearance}));
 const columns=[...new Set([start.u,...ends.map(point=>point.u),...areas.flatMap(area=>[area.left,area.right]),...reserved.flatMap(road=>offsets(road).flatMap(offset=>[road.from.u+offset,road.to.u+offset]))])].sort((a,b)=>a-b);
 const rows=[...new Set([start.v,...ends.map(point=>point.v),...areas.flatMap(area=>[area.back,area.front]),...reserved.flatMap(road=>offsets(road).flatMap(offset=>[road.from.v+offset,road.to.v+offset]))])].sort((a,b)=>a-b);
 const blocked=(a:Point,b:Point)=>areas.some(area=>a.u===b.u?a.u>area.left&&a.u<area.right&&Math.max(a.v,b.v)>area.back&&Math.min(a.v,b.v)<area.front:a.v>area.back&&a.v<area.front&&Math.max(a.u,b.u)>area.left&&Math.min(a.u,b.u)<area.right)||roadEdgeBlocked(a,b,reserved,cornerRadius)||!!attachmentBlocked?.(a,b);
 const travelCost=(from:Point,to:Point)=>{
  const length=Math.abs(to.u-from.u)+Math.abs(to.v-from.v),vertical=from.u===to.u;
  const parallel=reserved.filter(road=>vertical?road.from.u===road.to.u&&Math.max(from.v,to.v)>Math.min(road.from.v,road.to.v)&&Math.min(from.v,to.v)<Math.max(road.from.v,road.to.v):road.from.v===road.to.v&&Math.max(from.u,to.u)>Math.min(road.from.u,road.to.u)&&Math.min(from.u,to.u)<Math.max(road.from.u,road.to.u));
  if(parallel.some(road=>road.shared&&(vertical?from.u===road.from.u:from.v===road.from.v)))return length*.85;
  return length;
 };
 const turnBlocked=(point:Point)=>{
  // The straight driveway already reserves the dock's physical footprint.
  // Do not impose the extra trunk/bridge turn setback at its outer end.
  if(point.u===start.u&&point.v===start.v&&directions.start)return false;
  if(ends.some(end=>end.u===point.u&&end.v===point.v)&&(directions.endAt?.(point)||directions.end))return false;
  return roadTurnBlocked(point,reserved,cornerRadius);
 };
 return searchRoadGrid({columns,rows,start,ends,blocked,turnBlocked,travelCost,directions});
}
