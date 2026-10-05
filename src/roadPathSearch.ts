import type {Point} from './scenarioTypes';

type Entry={state:number;cost:number};
type RoadGrid={
 columns:number[];rows:number[];start:Point;end:Point;
 blocked:(from:Point,to:Point)=>boolean;
 travelCost:(from:Point,to:Point)=>number;
 directions:{start?:Point;end?:Point};
};

// Arrival heading is part of the search state: a cheaper arrival from the wrong
// direction cannot discard a path that can actually enter the receiving driveway.
export function searchRoadGrid({columns,rows,start,end,blocked,travelCost,directions}:RoadGrid):Point[]{
 const count=columns.length*rows.length,headings=4;
 const costs=new Float64Array(count*headings).fill(Infinity);
 const previous=new Int32Array(count*headings).fill(-1);
 const point=(cell:number):Point=>({u:columns[cell%columns.length],v:rows[Math.floor(cell/columns.length)]});
 const identity=(position:Point)=>rows.indexOf(position.v)*columns.length+columns.indexOf(position.u);
 const origin=identity(start),destination=identity(end),heap:Entry[]=[];
 const vectors=[{u:-1,v:0},{u:1,v:0},{u:0,v:-1},{u:0,v:1}];
 const opposite=[1,0,3,2];
 const allowed=(from:Point,to:Point,direction:Point|undefined)=>!direction||(to.u-from.u)*direction.u+(to.v-from.v)*direction.v>=0;
 const push=(entry:Entry)=>{heap.push(entry);let index=heap.length-1;while(index){const parent=(index-1)>>1;if(heap[parent].cost<=entry.cost)break;heap[index]=heap[parent];index=parent;}heap[index]=entry;};
 const pop=()=>{const first=heap[0],last=heap.pop()!;if(heap.length){let index=0;while(index*2+1<heap.length){let child=index*2+1;if(child+1<heap.length&&heap[child+1].cost<heap[child].cost)child++;if(heap[child].cost>=last.cost)break;heap[index]=heap[child];index=child;}heap[index]=last;}return first;};
 // These are departure headings, not four physical edges of the road.
 for(let heading=0;heading<headings;heading++){const state=origin*headings+heading;costs[state]=0;push({state,cost:0});}
 let arrival=-1;
 while(heap.length){
  const current=pop();if(current.cost!==costs[current.state])continue;
  const cell=Math.floor(current.state/headings),heading=current.state%headings;
  if(cell===destination){arrival=current.state;break;}
  const from=point(cell),column=cell%columns.length,row=Math.floor(cell/columns.length);
  for(let nextHeading=0;nextHeading<headings;nextHeading++){
   if(cell!==origin&&nextHeading===opposite[heading])continue;
   const vector=vectors[nextHeading],nextColumn=column+vector.u,nextRow=row+vector.v;
   if(nextColumn<0||nextColumn>=columns.length||nextRow<0||nextRow>=rows.length)continue;
   const nextCell=nextRow*columns.length+nextColumn,to=point(nextCell);
   if(cell===origin&&!allowed(from,to,directions.start))continue;
   if(nextCell===destination&&!allowed(from,to,directions.end))continue;
   if(blocked(from,to))continue;
   const turn=cell!==origin&&nextHeading!==heading?48:0;
   const cost=current.cost+travelCost(from,to)+turn,state=nextCell*headings+nextHeading;
   if(cost>=costs[state])continue;
   costs[state]=cost;previous[state]=current.state;push({state,cost});
  }
 }
 if(arrival<0)throw new Error('Cannot connect terminal driveways without crossing a building or reversing into a dock. Move the campus or terminal.');
 const path:Point[]=[];
 for(let state=arrival;state!==-1;state=previous[state])path.push(point(Math.floor(state/headings)));
 path.reverse();
 return path.filter((position,index)=>!index||index===path.length-1||!((path[index-1].u===position.u&&position.u===path[index+1].u)||(path[index-1].v===position.v&&position.v===path[index+1].v)));
}
