import {IsoRoundedBox} from './IsoRoundedBox';
import {IsoGate} from './IsoBuilding';
import {vertices,screenPosition} from './isometric';
import {topicTheme} from './topicTheme';
import {services} from './model';
import type {TerminalLayout} from './terminalLayout';
export function IsoTerminal({terminal}:{terminal:TerminalLayout}){
 const {width,depth,instances,wall,service,producer}=terminal;
 const bayLength=wall==='front'?width:depth;
 const color=services[service].color,topicColor=topicTheme[terminal.topics[0]].accent;
 return <g transform={screenPosition(terminal)}>
 {!producer&&<g transform={wall==='side'?`translate(${width-depth},${(width-depth)/2}) scale(-1,1)`:undefined}>{[0,bayLength].map(u=><IsoRoundedBox key={u} u={u-5} v={depth+5} width={5} depth={23} height={7} radius={2} roof="#f1dfb3" front="#cfbd91" side="#a79573"/>)}{Array.from({length:instances},(_,index)=>{const u=(index+1)*bayLength/(instances+1);return <g key={index}><polyline points={vertices([[u-14,depth+8],[u-14,depth+26]])} fill="none" stroke="#f6e7b9" strokeWidth="2" strokeDasharray="8 5"/><polygon points={vertices([[u,depth+20],[u-6,depth+30],[u+6,depth+30]])} fill="#d9e8d1"/></g>;})}<IsoRoundedBox u={-8} v={depth+8} width={20} depth={20} height={26} radius={4} roof="#b5daca" front="#7ba493" side="#537d73"/></g>}
 <polygon points={vertices([[8,8],[width+18,8],[width+18,depth+18],[8,depth+18]])} fill="#435b3b" opacity=".15"/>
 <IsoRoundedBox u={-8} v={-8} width={width+16} depth={depth+16} height={5} radius={9} roof="#eed8a4" front="#c1ab7a" side="#a59067"/>
 <IsoRoundedBox width={width} depth={depth} height={47} radius={7} roof={color} front={color} side="#77918d"/>
 <IsoRoundedBox u={-4} v={-4} width={width+8} depth={depth+8} height={8} base={47} radius={10} roof={producer?'#ffd47e':'#bce6cb'} front="#ead3a2" side="#bda982"/>
 <polyline points={vertices(wall==='front'?[[0,depth,56],[width,depth,56]]:[[width,0,56],[width,depth,56]])} fill="none" stroke={topicColor} strokeWidth="4"/>
 <g transform={wall==='front'?`translate(${-depth},${depth/2})`:`translate(${width},${width/2})`}>{Array.from({length:instances},(_,index)=>{const position=(index+1)*(wall==='front'?width:depth)/(instances+1);return <IsoGate key={index} position={position} wall={wall} producer={producer} topic={terminal.topics[0]} name={service} onSelect={()=>{}}/>;})}</g>
 {producer&&<g transform={wall==='front'?`translate(${width-depth},${(depth-width)/2}) scale(-1,1)`:undefined}>{Array.from({length:instances},(_,index)=>{const v=(index+1)*(wall==='side'?depth:width)/(instances+1);return <g key={index}><polygon points={vertices([[width+3,v-12],[width+27,v-12],[width+27,v+12],[width+3,v+12]])} fill="#a89671"/>{[-7,0,7].map(offset=><polyline key={offset} points={vertices([[width+6,v+offset-4],[width+12,v+offset],[width+6,v+offset+4]])} fill="none" stroke="#ffdb75" strokeWidth="2"/>)}</g>;})}</g>}
 </g>;
}
