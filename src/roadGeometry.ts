import type {GroundPoint} from './isometric';

// Butt ends stop at the receiving wall. Only interior bends receive a join.
export function roadFootprint(from:GroundPoint,to:GroundPoint,lanes:number):number[][] {
 const half=lanes*11;
 return from.v===to.v
 ? [[Math.min(from.u,to.u),from.v-half],[Math.max(from.u,to.u),from.v-half],[Math.max(from.u,to.u),from.v+half],[Math.min(from.u,to.u),from.v+half]]
 : [[from.u-half,Math.min(from.v,to.v)],[from.u+half,Math.min(from.v,to.v)],[from.u+half,Math.max(from.v,to.v)],[from.u-half,Math.max(from.v,to.v)]];
}
export function roadJoint(point:GroundPoint,lanes:number):number[][] {
 return Array.from({length:32},(_,index)=>{const angle=index*Math.PI/16;return [point.u+Math.cos(angle)*lanes*11,point.v+Math.sin(angle)*lanes*11];});
}
