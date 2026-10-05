import {IsoRoadTurn} from './IsoRoadTurn';
import {terminals,overpasses} from './terminalLayout';
import {connectionPosition} from './terminalConnection';
import {roadJunctions} from './junctionGeometry';
import {topicTheme} from './topicTheme';
import type {Topic} from './model';
import {roadCurves,roadRibbon,roadBranches} from './roadMesh';
import {offsetCurve} from './laneGeometry';
import {vertices,type GroundPoint} from './isometric';
export type RoadSegment={from:GroundPoint;to:GroundPoint;lanes:number;join?:boolean};
export function IsoRoad({segments,onClick,active=true,label,topic='orders'}:{segments:RoadSegment[];onClick?:()=>void;active?:boolean;label:string;topic?:Topic}) {
 const curves=roadCurves(segments),branches=roadBranches(segments),junctions=roadJunctions(segments),mask=`junction-markings-${topic}`;
 const ends=curves.flatMap(curve=>[curve.points[0],curve.points.at(-1)!].map(point=>({point,curve}))).filter(({point})=>!terminals.some(terminal=>{const connection=connectionPosition(terminal);return Math.hypot(point.u-connection.u,point.v-connection.v)<3;})&&!overpasses.some(bridge=>Math.abs(point.u-bridge.u)<3&&[bridge.start,bridge.start+bridge.ramp*2+bridge.deck].some(v=>Math.abs(point.v-v)<3))&&segments.filter(segment=>Math.hypot(segment.from.u-point.u,segment.from.v-point.v)<3||Math.hypot(segment.to.u-point.u,segment.to.v-point.v)<3).length===1);
 return <g opacity={active?1:.28} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} aria-label={label} onClick={onClick} onKeyDown={event=>{if(event.key==='Enter')onClick?.();}} className="road">
 {curves.map((curve,index)=><IsoRoadCorner key={`curb-${index}`} points={roadRibbon(curve.points,curve.lanes*11+2.5)} curb/>)}
 {branches.map((points,index)=><IsoRoadBranch key={`branch-curb-${index}`} points={points} curb/>)}
 {curves.map((curve,index)=><IsoRoadCorner key={index} points={roadRibbon(curve.points,curve.lanes*11)}/>)}
 {branches.map((points,index)=><IsoRoadBranch key={`branch-${index}`} points={points}/>)}
 <defs><mask id={mask} maskUnits="userSpaceOnUse" x="-20000" y="-20000" width="40000" height="40000"><rect x="-20000" y="-20000" width="40000" height="40000" fill="white"/>{junctions.map((junction,index)=><polygon key={index} points={vertices(junction.polygon)} fill="black"/>)}</mask></defs>
 <g mask={`url(#${mask})`}>
 {curves.flatMap((curve,index)=>[-1,1].map(side=><polyline key={`accent-${index}-${side}`} points={vertices(offsetCurve(curve.points,side*(curve.lanes*11-3)).map(point=>[point.u,point.v]))} fill="none" stroke={topicTheme[topic].accent} strokeWidth="4"/>))}
 {curves.flatMap((curve,routeIndex)=>Array.from({length:curve.lanes-1},(_,lane)=><polyline key={`${routeIndex}-${lane}`} points={vertices(offsetCurve(curve.points,(lane+1-curve.lanes/2)*22).map(point=>[point.u,point.v]))} fill="none" stroke={topicTheme[topic].accent} strokeWidth="2" strokeDasharray="10 10"/>))}
 </g>
 {ends.map(({point,curve},index)=>{const first=point===curve.points[0],neighbor=first?curve.points[1]:curve.points.at(-2)!,side=Math.abs(point.u-neighbor.u)>Math.abs(point.v-neighbor.v),forward=Math.sign(side?point.u-neighbor.u:point.v-neighbor.v);return <IsoRoadTurn key={`turn-${index}`} point={point} side={side} forward={forward} half={curve.lanes*11} color={topicTheme[topic].accent}/>;})}
 {junctions.map((junction,index)=><IsoJunction key={index} point={junction.point} half={junction.half}/>)}
 </g>;
}

export function IsoRoadCorner({points,curb=false}:{points:number[][];curb?:boolean}){return <polygon points={vertices(points)} fill={curb?'#e4ca8f':'#586c68'} strokeLinejoin="round"/>;}
export function IsoRoadBranch({points,curb=false}:{points:number[][];curb?:boolean}){return <polygon points={vertices(points)} fill="#586c68" stroke={curb?'#e4ca8f':undefined} strokeWidth={curb?5:undefined} strokeLinejoin="round"/>;}

export function IsoJunction({point,half}:{point:GroundPoint;half:number}){return <g aria-label="Road junction"><polygon points={vertices([[point.u-half+4,point.v-half+4],[point.u+half-4,point.v-half+4],[point.u+half-4,point.v+half-4],[point.u-half+4,point.v+half-4]])} fill="#586c68"/></g>;}
