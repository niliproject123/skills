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
 const columnRoads=new Map<number,ReservedRoad[]>(),rowRoads=new Map<number,ReservedRoad[]>();
 const nearbyRoads=(coordinate:number,vertical:boolean)=>{
  const cache=vertical?columnRoads:rowRoads;let roads=cache.get(coordinate);if(roads)return roads;
  roads=reserved.filter(road=>{const radius=road.margin+Math.max(cornerRadius+64,(cornerRadius+Math.max(road.bendFrom??0,road.bendTo??0))/4),first=vertical?road.from.u:road.from.v,last=vertical?road.to.u:road.to.v;return coordinate>=Math.min(first,last)-radius&&coordinate<=Math.max(first,last)+radius;});cache.set(coordinate,roads);return roads;
 };
 const columnAreas=new Map<number,typeof areas>(),rowAreas=new Map<number,typeof areas>();
 const nearbyAreas=(coordinate:number,vertical:boolean)=>{const cache=vertical?columnAreas:rowAreas;let found=cache.get(coordinate);if(!found){found=areas.filter(area=>vertical?coordinate>area.left&&coordinate<area.right:coordinate>area.back&&coordinate<area.front);cache.set(coordinate,found);}return found;};
 const blocked=(a:Point,b:Point)=>nearbyAreas(a.u===b.u?a.u:a.v,a.u===b.u).some(area=>a.u===b.u?Math.max(a.v,b.v)>area.back&&Math.min(a.v,b.v)<area.front:Math.max(a.u,b.u)>area.left&&Math.min(a.u,b.u)<area.right)||roadEdgeBlocked(a,b,nearbyRoads(a.u===b.u?a.u:a.v,a.u===b.u),cornerRadius)||!!attachmentBlocked?.(a,b);
 const travelCost=(from:Point,to:Point)=>{
  const length=Math.abs(to.u-from.u)+Math.abs(to.v-from.v),vertical=from.u===to.u;
  if(nearbyRoads(vertical?from.u:from.v,vertical).some(road=>road.shared&&(vertical?road.from.u===road.to.u&&from.u===road.from.u&&Math.max(from.v,to.v)>Math.min(road.from.v,road.to.v)&&Math.min(from.v,to.v)<Math.max(road.from.v,road.to.v):road.from.v===road.to.v&&from.v===road.from.v&&Math.max(from.u,to.u)>Math.min(road.from.u,road.to.u)&&Math.min(from.u,to.u)<Math.max(road.from.u,road.to.u))))return length*.85;
  return length;
 };
 const turnBlocked=(point:Point)=>{
  // The straight driveway already reserves the dock's physical footprint.
  // Do not impose the extra trunk/bridge turn setback at its outer end.
  if(point.u===start.u&&point.v===start.v&&directions.start)return false;
  if(ends.some(end=>end.u===point.u&&end.v===point.v)&&(directions.endAt?.(point)||directions.end))return false;
  return roadTurnBlocked(point,nearbyRoads(point.u,true),cornerRadius);
 };
 return searchRoadGrid({columns,rows,start,ends,blocked,turnBlocked,travelCost,directions});
}
