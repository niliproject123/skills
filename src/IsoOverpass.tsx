import {topicTheme} from './topicTheme';
import type {Bridge} from './scenarioTypes';
import {IsoRoundedBox} from './IsoRoundedBox';
import {vertices,project} from './isometric';
export function IsoOverpass({bridge,part='all'}:{bridge:Bridge;part?:'all'|'structure'|'deck'}){const u=bridge.u,half=bridge.lanes*11,end=bridge.start+bridge.ramp*2+bridge.deck,levels=[bridge.start,bridge.start+bridge.ramp,bridge.start+bridge.ramp+bridge.deck,end],elevation=(position:number)=>Math.max(0,Math.min(1,(position-bridge.start)/bridge.ramp,(end-position)/bridge.ramp))*bridge.height;return <g>
 {part!=='deck'&&<>
 <polygon points={vertices([[u-half-6,bridge.start+20],[u+half+15,bridge.start+20],[u+half+15,end],[u-half-6,end]])} fill="#344b3b" opacity=".22"/>
 {[bridge.start+bridge.ramp*.72,end-bridge.ramp*.72].flatMap(v=>[-half-5,half+5].map(offset=><IsoRoundedBox key={`${v}-${offset}`} u={u+offset-4} v={v-5} width={8} depth={10} height={elevation(v)-6} radius={3} roof="#c8c4a7" front="#aaa98e" side="#8a907c"/>))}
 </>}
 {part!=='structure'&&levels.slice(1).map((end,index)=>{const start=levels[index],a=elevation(start),b=elevation(end);return <g key={end}><polygon points={vertices([[u-half,start,a-8],[u+half,start,a-8],[u+half,end,b-8],[u-half,end,b-8]])} fill="#a79670"/><polygon points={vertices([[u+half,start,a-8],[u+half,end,b-8],[u+half,end,b],[u+half,start,a]])} fill="#c7ba91"/><polygon points={vertices([[u-half,start,a],[u+half,start,a],[u+half,end,b],[u-half,end,b]])} fill="#586c68"/>{[-half-1,half+1].map(offset=>{const from=project(u+offset,start,a+5),to=project(u+offset,end,b+5);return <path key={offset} d={`M${from.x} ${from.y}L${to.x} ${to.y}`} stroke={topicTheme[bridge.topic].accent} strokeWidth="2"/>;})}{Array.from({length:bridge.lanes-1},(_,lane)=><polyline key={lane} points={vertices([[u+(lane+1-bridge.lanes/2)*22,start,a+1],[u+(lane+1-bridge.lanes/2)*22,end,b+1]])} fill="none" stroke={topicTheme[bridge.topic].accent} strokeWidth="2" strokeDasharray="9 9"/>)}</g>;})}
 </g>;}
