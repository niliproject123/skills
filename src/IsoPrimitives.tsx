import {vertices,project,screenPosition,type GroundPoint} from './isometric';
import {IsoRoundedBox} from './IsoRoundedBox';
export function IsoBox({u=0,v=0,width,depth,height,base=0,roof,front,side}:{u?:number;v?:number;width:number;depth:number;height:number;base?:number;roof:string;front:string;side:string}) {
 const top=base+height;
 return <g><polygon points={vertices([[u,v+depth,base],[u+width,v+depth,base],[u+width,v+depth,top],[u,v+depth,top]])} fill={front}/><polygon points={vertices([[u+width,v,base],[u+width,v+depth,base],[u+width,v+depth,top],[u+width,v,top]])} fill={side}/><polygon points={vertices([[u,v,top],[u+width,v,top],[u+width,v+depth,top],[u,v+depth,top]])} fill={roof}/></g>;
}
export function IsoTree({u,v,size=1}:{u:number;v:number;size?:number}) {
 return <g transform={`${screenPosition({u,v})} scale(${size})`}><ellipse cy="6" rx="34" ry="17" fill="#4b783d" opacity=".15"/><IsoRoundedBox u={-5} v={-5} width={10} depth={10} height={35} radius={4} roof="#c99758" front="#a87644" side="#896039"/><g transform="translate(0,-39)"><ellipse cx="5" cy="4" rx="33" ry="29" fill="#4c934e"/><ellipse cx="-10" cy="-6" rx="26" ry="28" fill="#78b951"/><ellipse cx="9" cy="-17" rx="25" ry="27" fill="#8ec956"/><ellipse cx="-10" cy="-24" rx="18" ry="17" fill="#b0db72"/><ellipse cx="-16" cy="-28" rx="8" ry="5" fill="#d1eb99" opacity=".65"/></g></g>;
}
export function IsoRoadSign({u,v,label,small=false}:{u:number;v:number;label:string;small?:boolean}) {
 const width=small?80:112;
 return <g transform={screenPosition({u,v})}><IsoBox u={-2} v={-2} width={4} depth={4} height={49} roof="#b3935c" front="#87623a" side="#6d4e31"/><g transform="matrix(1 .5 0 1 0 -54)"><rect x={-width/2} y="-17" width={width} height="27" rx="4" fill="#fff2c4" stroke="#8b683f" strokeWidth="2"/><text x="0" y="1" textAnchor="middle" fontSize={small?10:12} fontWeight="900" fill="#574d34" letterSpacing="1">{label}</text></g></g>;
}
export function IsoLamp(point:GroundPoint) {
 return <g transform={screenPosition(point)}><IsoBox u={-2} v={-2} width={4} depth={4} height={48} roof="#77846a" front="#647358" side="#49543f"/><IsoBox u={-7} v={-7} width={14} depth={14} height={6} base={48} roof="#fff6be" front="#e9b968" side="#c99a51"/></g>;
}
export function IsoShrub(point:GroundPoint) {const screen=project(point.u,point.v);return <g transform={`translate(${screen.x},${screen.y})`}><IsoRoundedBox width={30} depth={20} height={15} radius={10} roof="#c2d85a" front="#86ab40" side="#668d38"/></g>;}
