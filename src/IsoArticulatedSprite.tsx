import {tint} from './scenarioEncoding';
import {project,vertices} from './isometric';
import {topicTheme} from './topicTheme';
import {IsoRoundedBox} from './IsoRoundedBox';
export const articulatedAngles=32;
export function IsoArticulatedSprite({kind,angle,topic,waiting,accent}:{kind:'car'|'van'|'truck'|'tractor'|'trailer';angle:number;topic:string;waiting:boolean;accent?:string}){
 const theta=angle*Math.PI*2/articulatedAngles,cos=Math.cos(theta),sin=Math.sin(theta),theme=accent?{accent,front:tint(accent,-.2),side:tint(accent,-.35)}:topicTheme[topic];
 const turn=(long:number,across:number,height=0)=>[long*cos-across*sin,long*sin+across*cos,height];
 const box=(start:number,length:number,width:number,height:number,base:number,roof:string)=>{
 return <IsoRoundedBox u={start} v={-width/2} width={length} depth={width} height={height} base={base} angle={theta} cornerSteps={4} radius={Math.min(7,width*.42,length*.3)} roof={roof} front={tint(roof,-.18)} side={tint(roof,-.32)}/>;
 };
 const length=kind==='car'?16:kind==='van'?28:kind==='tractor'?26:40,width=kind==='car'?9:17,height=kind==='car'?6:kind==='van'?15:kind==='tractor'?14:20;
 return <g><polygon points={vertices([turn(-length/2+3,-width/2+3),turn(length/2+3,-width/2+3),turn(length/2+3,width/2+3),turn(-length/2+3,width/2+3)])} fill="#344a32" opacity=".25"/>{[-length/2+5,length/2-5].map((long,index)=>{const [u,v]=turn(long,6.5),point=project(u,v,3);return <ellipse key={index} cx={point.x} cy={point.y} rx="3" ry="4" fill="#343a37"/>;})}{box(-length/2,kind==='truck'?length-11:length,width,height,3,tint(theme.accent,.1))}{kind==='trailer'?box(-16,32,5,1,23,'#b5bcb7'):kind==='tractor'?box(0,9,13,3,17,'#a9d7dc'):null}{kind==='car'&&box(-4,9,8,5,9,'#9dccd0')}{kind==='van'&&box(8,4,13,1,19,'#9dccd0')}{kind==='truck'&&box(10,10,15,9,3,theme.accent)}{kind==='tractor'&&box(9,4,19,3,3,'#eee3cb')}{box(-length/2+4,kind==='truck'?length-19:length-8,2,1,height+4,'#a0aaa5')}{[-length/2+6,length/2-6].map((long,index)=>{const [u,v]=turn(long,width/2),point=project(u,v,3);return <g key={`wheel-${index}`}><ellipse cx={point.x} cy={point.y} rx="3.8" ry="4.8" fill="#343a37"/><ellipse cx={point.x} cy={point.y} rx="1.7" ry="2.2" fill="#dfd7c4"/></g>;})}{waiting&&box(-length/2+2,3,11,1,height+4,'#f4c04c')}</g>;
}
