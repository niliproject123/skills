import type {Point} from './scenarioTypes';
type Obstacle={u:number;v:number;width:number;depth:number};
// Visibility grid: every edge is axis-aligned and the distance cost is world length.
export function shortestRoad(start:Point,end:Point,obstacles:Obstacle[],clearance:number,reserved:{from:Point;to:Point;margin:number}[]=[],directions:{start?:Point;end?:Point}={}):Point[]{
 const areas=obstacles.map(area=>({left:area.u-clearance,right:area.u+area.width+clearance,back:area.v-clearance,front:area.v+area.depth+clearance}));
 const columns=[...new Set([start.u,end.u,...areas.flatMap(area=>[area.left,area.right]),...reserved.flatMap(road=>[road.from.u-road.margin,road.from.u+road.margin,road.to.u-road.margin,road.to.u+road.margin])])].sort((a,b)=>a-b);
 const rows=[...new Set([start.v,end.v,...areas.flatMap(area=>[area.back,area.front]),...reserved.flatMap(road=>[road.from.v-road.margin,road.from.v+road.margin,road.to.v-road.margin,road.to.v+road.margin])])].sort((a,b)=>a-b);
 const count=columns.length*rows.length,distances=new Float64Array(count).fill(Infinity),previous=new Int32Array(count).fill(-1);
 const point=(index:number):Point=>({u:columns[index%columns.length],v:rows[Math.floor(index/columns.length)]});
 const identity=(p:Point)=>rows.indexOf(p.v)*columns.length+columns.indexOf(p.u),origin=identity(start),destination=identity(end);
 const blocked=(a:Point,b:Point)=>areas.some(area=>a.u===b.u?a.u>area.left&&a.u<area.right&&Math.max(a.v,b.v)>area.back&&Math.min(a.v,b.v)<area.front:a.v>area.back&&a.v<area.front&&Math.max(a.u,b.u)>area.left&&Math.min(a.u,b.u)<area.right);
 const heap:{index:number;distance:number}[]=[];
 const push=(entry:{index:number;distance:number})=>{heap.push(entry);let index=heap.length-1;while(index){const parent=(index-1)>>1;if(heap[parent].distance<=entry.distance)break;heap[index]=heap[parent];index=parent;}heap[index]=entry;};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let index=0;while(index*2+1<heap.length){let child=index*2+1;if(child+1<heap.length&&heap[child+1].distance<heap[child].distance)child++;if(heap[child].distance>=last.distance)break;heap[index]=heap[child];index=child;}heap[index]=last;}return first;};
 distances[origin]=0;push({index:origin,distance:0});
 while(heap.length){const current=pop();if(current.distance!==distances[current.index])continue;if(current.index===destination)break;
 const column=current.index%columns.length,row=Math.floor(current.index/columns.length),neighbors=[column>0?current.index-1:-1,column+1<columns.length?current.index+1:-1,row>0?current.index-columns.length:-1,row+1<rows.length?current.index+columns.length:-1];
 for(const next of neighbors){if(next<0)continue;const a=point(current.index),b=point(next);
 if(current.index===origin&&directions.start&&(b.u-a.u)*directions.start.u+(b.v-a.v)*directions.start.v<0)continue;
 if(next===destination&&directions.end&&(b.u-a.u)*directions.end.u+(b.v-a.v)*directions.end.v<0)continue;
 if(blocked(a,b))continue;const parallel=reserved.some(road=>a.u===b.u&&road.from.u===road.to.u?Math.abs(a.u-road.from.u)<road.margin&&Math.max(a.v,b.v)>Math.min(road.from.v,road.to.v)&&Math.min(a.v,b.v)<Math.max(road.from.v,road.to.v):a.v===b.v&&road.from.v===road.to.v&&Math.abs(a.v-road.from.v)<road.margin&&Math.max(a.u,b.u)>Math.min(road.from.u,road.to.u)&&Math.min(a.u,b.u)<Math.max(road.from.u,road.to.u));const prior=previous[current.index]>=0?point(previous[current.index]):undefined,turn=prior&&((prior.u===a.u)!==(a.u===b.u)) ? .01 : 0;const distance=current.distance+Math.abs(a.u-b.u)+Math.abs(a.v-b.v)+turn+(parallel?4*(Math.abs(a.u-b.u)+Math.abs(a.v-b.v)):0);if(distance<distances[next]){distances[next]=distance;previous[next]=current.index;push({index:next,distance});}}
 }
 if(!Number.isFinite(distances[destination]))throw new Error('Cannot connect terminal driveways without crossing a building. Move the campus or terminal.');
 const path:Point[]=[];for(let index=destination;index!==-1;index=previous[index])path.push(point(index));path.reverse();
 return path.filter((p,index)=>!index||index===path.length-1||!((path[index-1].u===p.u&&p.u===path[index+1].u)||(path[index-1].v===p.v&&p.v===path[index+1].v)));
}
