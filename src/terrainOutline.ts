import type {Point} from './scenarioTypes';
// Beveled hull encloses the complete infrastructure without a rectangular map edge.
export function terrainOutline(points:Point[]):number[][]{
 const ordered=points.map(point=>[point.u,point.v]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const cross=(a:number[],b:number[],c:number[])=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const half=(values:number[][])=>{const result:number[][]=[];for(const point of values){while(result.length>1&&cross(result.at(-2)!,result.at(-1)!,point)<=0)result.pop();result.push(point);}return result.slice(0,-1);};
 const hull=[...half(ordered),...half(ordered.slice().reverse())];
 return hull.flatMap((point,index)=>{const before=hull[(index+hull.length-1)%hull.length],after=hull[(index+1)%hull.length];const toward=(other:number[])=>{const distance=Math.hypot(other[0]-point[0],other[1]-point[1]),fraction=Math.min(.18,35/distance);return [point[0]+(other[0]-point[0])*fraction,point[1]+(other[1]-point[1])*fraction];};return [toward(before),toward(after)];});
}
