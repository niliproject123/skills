import {topicTheme} from './topicTheme';
import type {Topic} from './model';
import {roadCurves,roadRibbon,roadBranches} from './roadMesh';
import {offsetCurve} from './laneGeometry';
import {vertices,type GroundPoint} from './isometric';
export type RoadSegment={from:GroundPoint;to:GroundPoint;lanes:number;join?:boolean};
export function IsoRoad({segments,onClick,active=true,label,topic='orders'}:{segments:RoadSegment[];onClick?:()=>void;active?:boolean;label:string;topic?:Topic}) {
 const curves=roadCurves(segments),branches=roadBranches(segments);
 return <g opacity={active?1:.28} role={onClick?'button':undefined} tabIndex={onClick?0:undefined} aria-label={label} onClick={onClick} onKeyDown={event=>{if(event.key==='Enter')onClick?.();}} className="road">
 {curves.map((curve,index)=><IsoRoadCorner key={`curb-${index}`} points={roadRibbon(curve.points,curve.lanes*11+2.5)} curb/>)}
 {branches.map((points,index)=><IsoRoadBranch key={`branch-curb-${index}`} points={points} curb/>)}
 {curves.map((curve,index)=><IsoRoadCorner key={index} points={roadRibbon(curve.points,curve.lanes*11)}/>)}
 {branches.map((points,index)=><IsoRoadBranch key={`branch-${index}`} points={points}/>)}
 {curves.flatMap((curve,index)=>[-1,1].map(side=><polyline key={`accent-${index}-${side}`} points={vertices(offsetCurve(curve.points,side*(curve.lanes*11-3)).map(point=>[point.u,point.v]))} fill="none" stroke={topicTheme[topic].accent} strokeWidth="4"/>))}
 {curves.flatMap((curve,routeIndex)=>Array.from({length:curve.lanes-1},(_,lane)=><polyline key={`${routeIndex}-${lane}`} points={vertices(offsetCurve(curve.points,(lane+1-curve.lanes/2)*22).map(point=>[point.u,point.v]))} fill="none" stroke={topicTheme[topic].accent} strokeWidth="2" strokeDasharray="10 10"/>))}

 </g>;
}

export function IsoRoadCorner({points,curb=false}:{points:number[][];curb?:boolean}){return <polygon points={vertices(points)} fill={curb?'#e4ca8f':'#586c68'} strokeLinejoin="round"/>;}
export function IsoRoadBranch({points,curb=false}:{points:number[][];curb?:boolean}){return <polygon points={vertices(points)} fill="#586c68" stroke={curb?'#e4ca8f':undefined} strokeWidth={curb?5:undefined} strokeLinejoin="round"/>;}
