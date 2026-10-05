import type {GroundPoint} from './isometric';
import type {RoadSegment} from './IsoRoad';
export function roadJunctions(segments:RoadSegment[]){
 const nodes=new Map<string,{point:GroundPoint;arms:Set<string>;half:number}>();
 for(const segment of segments)for(const [point,other] of [[segment.from,segment.to],[segment.to,segment.from]]){const key=`${point.u}/${point.v}`,node=nodes.get(key)??{point,arms:new Set<string>(),half:0};node.arms.add(`${Math.sign(other.u-point.u)}/${Math.sign(other.v-point.v)}`);node.half=Math.max(node.half,segment.lanes*11+7);nodes.set(key,node);}
 return [...nodes.values()].filter(node=>node.arms.size>=3).map(node=>({...node,polygon:[[node.point.u-node.half,node.point.v-node.half],[node.point.u+node.half,node.point.v-node.half],[node.point.u+node.half,node.point.v+node.half],[node.point.u-node.half,node.point.v+node.half]]}));
}
