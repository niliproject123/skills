import {topics} from './model';
import {vertices,screenPosition} from './isometric';
import {topicTheme} from './topicTheme';
import {apronLength,connectionLength} from './terminalConnection';
import type {TerminalLayout} from './terminalLayout';

export function IsoTerminalConnection({terminal,topic=terminal.topics[0]}:{terminal:TerminalLayout;topic?:string}){
 const {width,depth,producer,instances}=terminal;
 const lanes=topics[topic].partitions,roadHalf=lanes*11;
 const side=terminal.wall==='side',center=(side?depth/2:width/2)+(terminal.topicOffsets?.[topic]??0),face=side?width:depth;
 const apronHalf=terminal.topics.length>1?roadHalf+8:(side?depth:width)/2+6;
 const point=(along:number,across:number)=>side?[face+along,center+across]:[center+across,face+along];
 const outline=[point(0,-apronHalf),point(apronLength,-apronHalf),point(connectionLength-12,-roadHalf),point(connectionLength+6,-roadHalf-5),point(connectionLength+6,roadHalf+5),point(connectionLength-12,roadHalf),point(apronLength,apronHalf),point(0,apronHalf)];
 return <g transform={screenPosition(terminal)}>
 <polygon points={vertices(outline)} fill="#a7aaa0" stroke="#ded2b3" strokeWidth="3" strokeLinejoin="round"/>
 <polygon points={vertices([point(0,-apronHalf),point(apronLength,-apronHalf),point(apronLength,apronHalf),point(0,apronHalf)])} fill="#d5c6a6"/>
 <polyline points={vertices([point(apronLength,-apronHalf),point(connectionLength-12,-roadHalf),point(connectionLength+6,-roadHalf-5)])} fill="none" stroke="#efe3c4" strokeWidth="3" strokeLinejoin="round"/>
 <polyline points={vertices([point(apronLength,apronHalf),point(connectionLength-12,roadHalf),point(connectionLength+6,roadHalf+5)])} fill="none" stroke="#efe3c4" strokeWidth="3" strokeLinejoin="round"/>
 {Array.from({length:instances},(_,index)=>{const across=(index+1)*(side?depth:width)/(instances+1)-center;return <g key={index}><polyline points={vertices([point(5,across-12),point(apronLength-4,across-12)])} fill="none" stroke={producer?'#f7df9b':'#f4e6c7'} strokeWidth="2"/><polygon points={vertices([point(12,across-3),point(12,across+3),point(producer?18:6,across)])} fill={topicTheme[topic].accent}/></g>;})}
 <polyline points={vertices([point(connectionLength-9,-roadHalf+4),point(connectionLength-9,roadHalf-4)])} fill="none" stroke="#eee3c8" strokeWidth="2" strokeDasharray="5 5"/>
 </g>;
}
