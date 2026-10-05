import {tint} from './scenarioEncoding';
import type {Topic} from './model';
import {topicTheme} from './topicTheme';
import {IsoRoundedBox} from './IsoRoundedBox';
import {orient,project,vertices,type Direction} from './isometric';
export type VehicleKind = 'car'|'van'|'truck'|'semi';
export const vehicleLengths:Record<VehicleKind,number>={car:16,van:28,truck:40,semi:56};
function Body({start,length,width,height,base=3,direction,roof,front,side}:{start:number;length:number;width:number;height:number;base?:number;direction:Direction;roof:string;front:string;side:string}) {
 const corners=[orient(start,-width/2,direction),orient(start+length,width/2,direction)];
 return <IsoRoundedBox u={Math.min(corners[0][0],corners[1][0])} v={Math.min(corners[0][1],corners[1][1])} width={Math.abs(corners[1][0]-corners[0][0])} depth={Math.abs(corners[1][1]-corners[0][1])} height={height} base={base} radius={3} roof={roof} front={front} side={side}/>;
}
function Sprite({kind,direction='east',waiting=false,topic='orders',accent}:{kind:VehicleKind;direction?:Direction;waiting?:boolean;topic?:Topic;accent?:string}) {
 const length=vehicleLengths[kind],width=kind==='car'?8:15;
 const theme=accent?{accent,front:tint(accent,-.2),side:tint(accent,-.35)}:topicTheme[topic],colors=[tint(theme.accent,.15),theme.front,theme.side];
 const shadow=[[-length/2,-width/2],[length/2,-width/2],[length/2,width/2],[-length/2,width/2]].map(([long,across])=>[...orient(long+4,across+4,direction),0]);
 const visibleAcross=direction==='east'||direction==='north'?width/2:-width/2;
 return <g className="iso-vehicle"><polygon points={vertices(shadow)} fill="#344a32" opacity=".25"/>
 {[-length/2+5,length/2-5].map((long,index)=>{const point=orient(long,visibleAcross,direction),screen=project(...point,3);return <g key={index} transform={`translate(${screen.x},${screen.y})`}><ellipse rx="3.3" ry="4.3" fill="#343a37"/><ellipse rx="1.3" ry="2" fill="#bebba3"/></g>;})}
 {kind==='semi'?<><Body start={-length/2} length={length-16} width={width} height={18} direction={direction} roof={colors[0]} front={colors[1]} side={colors[2]}/><Body start={length/2-11} length={11} width={width} height={9} direction={direction} roof={theme.accent} front={theme.front} side={theme.side}/></>:kind==='truck'?<><Body start={-length/2} length={length-12} width={width} height={19} direction={direction} roof={colors[0]} front={colors[1]} side={colors[2]}/><Body start={length/2-11} length={11} width={width-2} height={10} direction={direction} roof={theme.accent} front={theme.front} side={theme.side}/></>:<><Body start={-length/2} length={length} width={width} height={kind==='van'?15:5} direction={direction} roof={colors[0]} front={colors[1]} side={colors[2]}/>{kind==='car'&&<Body start={-5} length={10} width={8} height={5} base={8} direction={direction} roof="#b5e2df" front="#527e85" side="#395e68"/>}</>}
 {kind==='car'&&<Body start={-length/2} length={3} width={width} height={1} base={8} direction={direction} roof="#b8bdb7" front="#8c9690" side="#6e7874"/>}
 {kind==='van'&&<Body start={-length/2+3} length={length-6} width={4} height={1} base={18} direction={direction} roof="#b8bdb7" front="#8c9690" side="#6e7874"/>}
 {(kind==='truck'||kind==='semi')&&<Body start={-length/2+4} length={length-22} width={5} height={1} base={kind==='truck'?22:21} direction={direction} roof="#b8bdb7" front="#8c9690" side="#6e7874"/>}
 {waiting&&<Body start={-length/2+3} length={4} width={width-2} height={1} base={kind==='car'?9:kind==='van'?19:kind==='truck'?23:22} direction={direction} roof="#f4c04c" front="#c89936" side="#a58030"/>}
 {kind!=='car'&&<Body start={length/2-8} length={4} width={width-2} height={1} base={kind==='truck'?14:kind==='van'?19:13} direction={direction} roof="#a9d7dc" front="#608c98" side="#426b7a"/>}
 </g>;
}
export const IsoCar=(props:{direction?:Direction;waiting?:boolean;topic?:Topic})=><Sprite kind="car" {...props}/>;
export const IsoVan=(props:{direction?:Direction;waiting?:boolean;topic?:Topic})=><Sprite kind="van" {...props}/>;
export const IsoTruck=(props:{direction?:Direction;waiting?:boolean;topic?:Topic})=><Sprite kind="truck" {...props}/>;
export const IsoSemi=(props:{direction?:Direction;waiting?:boolean;topic?:Topic})=><Sprite kind="semi" {...props}/>;
export function IsoVehicle({kind,...props}:{kind:VehicleKind;direction?:Direction;waiting?:boolean;topic?:Topic;accent?:string}){return <Sprite kind={kind} {...props}/>;}
export function IsoTrailer({direction,waiting=false,topic='orders'}:{direction:Direction;waiting?:boolean;topic?:Topic}){
 const theme=topicTheme[topic],colors=[tint(theme.accent,.15),theme.front,theme.side];
 return <g><Body start={15} length={8} width={3} height={3} direction={direction} roof="#687e72" front="#53695e" side="#43574e"/><Body start={-15} length={30} width={13} height={18} direction={direction} roof={colors[0]} front={colors[1]} side={colors[2]}/><Body start={-11} length={22} width={5} height={1} base={21} direction={direction} roof="#b8bdb7" front="#8c9690" side="#6e7874"/>{waiting&&<Body start={-11} length={4} width={11} height={1} base={22} direction={direction} roof='#f4c04c' front='#c89936' side='#a58030'/>}{[-9,9].map((long,index)=>{const point=orient(long,direction==='east'||direction==='north'?6.5:-6.5,direction),screen=project(...point,3);return <ellipse key={index} cx={screen.x} cy={screen.y} rx="3" ry="4" fill="#35413b"/>;})}</g>;
}

export function IsoTractor({direction,waiting=false,topic}:{direction:Direction;waiting?:boolean;topic:Topic}){
 const theme=topicTheme[topic];return <g><Body start={-9} length={18} width={13} height={10} direction={direction} roof={theme.accent} front={theme.front} side={theme.side}/><Body start={-2} length={7} width={11} height={1} base={13} direction={direction} roof="#a9d7dc" front="#608c98" side="#426b7a"/>{[-5,5].map((long,index)=>{const [u,v]=orient(long,6.5,direction),point=project(u,v,3);return <ellipse key={index} cx={point.x} cy={point.y} rx="3" ry="4" fill="#343a37"/>;})}{waiting&&<Body start={-8} length={3} width={11} height={1} base={14} direction={direction} roof="#f4c04c" front="#c89936" side="#a58030"/>}</g>;
}
