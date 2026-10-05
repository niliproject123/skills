import type {RoadSegment} from './IsoRoad';
// Split and deduplicate shared straight stretches before rounding graph corners.
export function roadNetwork(segments:RoadSegment[]):RoadSegment[]{
 const points=segments.flatMap(segment=>[segment.from,segment.to]);
 for(const a of segments)for(const b of segments)if(a.from.u===a.to.u&&b.from.v===b.to.v&&a.from.u>Math.min(b.from.u,b.to.u)&&a.from.u<Math.max(b.from.u,b.to.u)&&b.from.v>Math.min(a.from.v,a.to.v)&&b.from.v<Math.max(a.from.v,a.to.v))points.push({u:a.from.u,v:b.from.v});
 const edges=new Map<string,RoadSegment>();
 for(const segment of segments){const vertical=segment.from.u===segment.to.u;
 const axis=(point:{u:number;v:number})=>vertical?point.v:point.u,low=Math.min(axis(segment.from),axis(segment.to)),high=Math.max(axis(segment.from),axis(segment.to));
 const cuts=[...new Set(points.filter(point=>(vertical?point.u===segment.from.u:point.v===segment.from.v)&&axis(point)>=low&&axis(point)<=high).map(axis))].sort((a,b)=>a-b);
 for(let index=1;index<cuts.length;index++){const from=vertical?{u:segment.from.u,v:cuts[index-1]}:{u:cuts[index-1],v:segment.from.v},to=vertical?{u:segment.from.u,v:cuts[index]}:{u:cuts[index],v:segment.from.v};const key=`${from.u}/${from.v}/${to.u}/${to.v}`;const prior=edges.get(key);if(!prior||prior.lanes<segment.lanes)edges.set(key,{...segment,from,to});}
 }return [...edges.values()];
}
