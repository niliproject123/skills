import {vertices} from './isometric';
type Props={u?:number;v?:number;width:number;depth:number;height:number;base?:number;roof:string;front:string;side:string;radius?:number};
function blend(first:string,second:string,amount:number){
 const channels=[1,3,5].map(start=>Math.round(parseInt(first.slice(start,start+2),16)*(1-amount)+parseInt(second.slice(start,start+2),16)*amount));
 return `rgb(${channels.join(',')})`;
}
// Round in ground coordinates before projection, so edges keep the fixed camera.
export function IsoRoundedBox({u=0,v=0,width,depth,height,base=0,roof,front,side,radius=12}:Props){
 const rounding=Math.min(radius,width/2,depth/2),top=base+height;
 const corners=[[u+width-rounding,v+rounding,-90],[u+width-rounding,v+depth-rounding,0],[u+rounding,v+depth-rounding,90],[u+rounding,v+rounding,180]];
 const outline=corners.flatMap(([centerU,centerV,start])=>Array.from({length:9},(_,index)=>{const angle=(start+index*90/8)*Math.PI/180;return [centerU+Math.cos(angle)*rounding,centerV+Math.sin(angle)*rounding];}));
 return <g>{outline.map((from,index)=>{
 const to=outline[(index+1)%outline.length],normalU=to[1]-from[1],normalV=from[0]-to[0];
 if(normalU+normalV<=.001)return null;
 const shade=blend(side,front,Math.max(0,normalV)/(Math.abs(normalU)+Math.abs(normalV)));
 return <polygon key={index} points={vertices([[...from,base],[...to,base],[...to,top],[...from,top]])} fill={shade} stroke={shade} strokeWidth=".55" strokeLinejoin="round"/>;
 })}<polygon points={vertices(outline.map(point=>[...point,top]))} fill={roof} stroke={roof} strokeWidth=".6" strokeLinejoin="round"/></g>;
}
