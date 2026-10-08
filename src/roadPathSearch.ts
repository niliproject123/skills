import type {Point} from './scenarioTypes';
import {RoadLayoutConflict} from './roadLayoutConflict';

type Entry={state:number;cost:number;priority:number};
type RoadGrid={
 columns:number[];rows:number[];start:Point;ends:Point[];
 blocked:(from:Point,to:Point)=>boolean;
 turnBlocked:(point:Point)=>boolean;
 travelCost:(from:Point,to:Point)=>number;
 directions:{start?:Point;end?:Point;endAt?:(point:Point)=>Point|undefined};
};

// Arrival heading is part of the search state: a cheaper arrival from the wrong
// direction cannot discard a path that can actually enter the receiving driveway.
export function searchRoadGrid({columns,rows,start,ends,blocked,turnBlocked,travelCost,directions}:RoadGrid):Point[]{
 const count=columns.length*rows.length,headings=4;
 const costs=new Float64Array(count*headings).fill(Infinity);
 const previous=new Int32Array(count*headings).fill(-1);
 const point=(cell:number):Point=>({u:columns[cell%columns.length],v:rows[Math.floor(cell/columns.length)]});
 const identity=(position:Point)=>rows.indexOf(position.v)*columns.length+columns.indexOf(position.u);
 const origin=identity(start),destinations=new Set(ends.map(identity)),heap:Entry[]=[];
 const vectors=[{u:-1,v:0},{u:1,v:0},{u:0,v:-1},{u:0,v:1}];
 const opposite=[1,0,3,2];
 const allowed=(from:Point,to:Point,direction:Point|undefined)=>!direction||(to.u-from.u)*direction.u+(to.v-from.v)*direction.v>=0;
 const push=(entry:Entry)=>{heap.push(entry);let index=heap.length-1;while(index){const parent=(index-1)>>1;if(heap[parent].priority<=entry.priority)break;heap[index]=heap[parent];index=parent;}heap[index]=entry;};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let index=0;while(index*2+1<heap.length){let child=index*2+1;if(child+1<heap.length&&heap[child+1].priority<heap[child].priority)child++;if(heap[child].priority>=last.priority)break;heap[index]=heap[child];index=child;}heap[index]=last;}return first;};
 const remaining=(position:Point)=>Math.min(...ends.map(end=>Math.abs(position.u-end.u)+Math.abs(position.v-end.v)))*.85;
 // These are departure headings, not four physical edges of the road.
 for(let heading=0;heading<headings;heading++){const state=origin*headings+heading;costs[state]=0;push({state,cost:0,priority:remaining(start)});}
 let arrival=-1;
 while(heap.length){
  const current=pop();if(current.cost!==costs[current.state])continue;
  const cell=Math.floor(current.state/headings),heading=current.state%headings;
  if(destinations.has(cell)){arrival=current.state;break;}
  const from=point(cell),column=cell%columns.length,row=Math.floor(cell/columns.length);
  for(let nextHeading=0;nextHeading<headings;nextHeading++){
   if(cell!==origin&&nextHeading===opposite[heading])continue;
   const vector=vectors[nextHeading],nextColumn=column+vector.u,nextRow=row+vector.v;
   if(nextColumn<0||nextColumn>=columns.length||nextRow<0||nextRow>=rows.length)continue;
   const nextCell=nextRow*columns.length+nextColumn,to=point(nextCell);
   if(cell===origin&&!allowed(from,to,directions.start))continue;
   const arrivalDirection=directions.endAt?directions.endAt(to):directions.end;
   if(destinations.has(nextCell)&&!allowed(from,to,arrivalDirection))continue;
   if(blocked(from,to))continue;
   const turns=cell===origin?directions.start!==undefined&&directions.start.u*vector.v!==directions.start.v*vector.u:nextHeading!==heading;
   if(turns&&turnBlocked(from))continue;
   if(destinations.has(nextCell)&&arrivalDirection&&arrivalDirection.u*vector.v!==arrivalDirection.v*vector.u&&turnBlocked(to))continue;
   const turn=cell!==origin&&nextHeading!==heading?48:0;
   const cost=current.cost+travelCost(from,to)+turn,state=nextCell*headings+nextHeading;
   if(cost>=costs[state])continue;
   costs[state]=cost;previous[state]=current.state;push({state,cost,priority:cost+remaining(to)});
  }
 }
 if(arrival<0)throw new RoadLayoutConflict('Cannot connect terminal driveways while maintaining road-width and bend clearance. Move the campus or terminal farther from neighboring topic roads.');
 const path:Point[]=[];
 for(let state=arrival;state!==-1;state=previous[state])path.push(point(Math.floor(state/headings)));
 path.reverse();
 return path.filter((position,index)=>!index||index===path.length-1||!((path[index-1].u===position.u&&position.u===path[index+1].u)||(path[index-1].v===position.v&&position.v===path[index+1].v)));
}
