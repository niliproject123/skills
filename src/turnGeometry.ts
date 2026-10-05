import type {GroundPoint} from './isometric';
export function yardTurn(start:GroundPoint,side:boolean,radius=36,forward=-1):GroundPoint[]{
 const points:GroundPoint[]=[];
 for(let index=1;index<=48;index++){const angle=Math.PI+index*Math.PI*2/48,along=-forward*radius*Math.sin(angle),across=radius+radius*Math.cos(angle);points.push(side?{u:start.u+along,v:start.v+across}:{u:start.u+across,v:start.v+along});}
 return points;
}
