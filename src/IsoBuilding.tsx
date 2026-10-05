import {roofFeatures} from './buildingFeatures';
import {IsoRoundedBox as IsoBox} from './IsoRoundedBox';
import {vertices,screenPosition,type GroundPoint} from './isometric';
import {services,type Service,type Selection,type Topic} from './model';
export type BuildingLayout = GroundPoint & {width:number;depth:number};
export function IsoGate({position,wall,producer,topic,name,onSelect}:{position:number;wall:'front'|'side';producer:boolean;topic:Topic;name:Service;onSelect:(value:Selection)=>void}) {
 const transform=wall==='front'?`matrix(1 .5 0 1 ${position} ${position/2})`:`matrix(-1 .5 0 1 ${-position} ${position/2})`;
 return <g transform={transform} className="gate" role="button" tabIndex={0} aria-label={`${name} ${producer?'producer':'consumer'} gate ${position}`} onClick={event=>{event.stopPropagation();onSelect({kind:'gate',name,topic,producer});}} onKeyDown={event=>{if(event.key==='Enter'){event.stopPropagation();onSelect({kind:'gate',name,topic,producer});}}}>
 <title>{`${name} · ${producer?'Shipping':'Receiving'} · ${topic}`}</title>
 <path d="M-14 0V-27Q-14-38-3-38H3Q14-38 14-27V0" fill="#825f48" stroke="#ffe6ae" strokeWidth="5" strokeLinejoin="round"/><path d="M-10 0V-26Q-10-32-3-32H3Q10-32 10-26V0" fill="#263b3e"/><path d="M-10-26-5-24V0H-10Z" fill="#101f27"/><path d="M-9-29Q0-36 9-29L5-26H-5Z" fill="#5c7473"/><rect x="-17" y="-43" width="34" height="9" rx="4.5" fill={producer?'#ffc961':'#b9ead4'}/><path d="M-11-39h5m6 0h5" stroke="#647b62" strokeWidth="3" strokeLinecap="round"/>
 <path d={producer?'M0-24v14m-5-5 5 5 5-5':'M0-10v-14m-5 5 5-5 5 5'} fill="none" stroke={producer?'#ffcb6c':'#b9ecdf'} strokeWidth="2"/><rect x="-17" y="-4" width="4" height="7" fill="#e7bb59"/><rect x="13" y="-4" width="4" height="7" fill="#e7bb59"/>
 </g>;
}
export function IsoBuilding({name,layout,onSelect,selected=null,gateCount,mainOnly=false}:{name:Service;layout:BuildingLayout;onSelect:(value:Selection)=>void;selected?:Selection|null;gateCount?:number;mainOnly?:boolean}) {
 const service=services[name],{width,depth}=layout,height=service.art==='Notification'?112:100;
 const palettes=service.palette,roofDetails=roofFeatures(width,depth,service.art);
 const relevant=!selected||selected.name===name||selected.kind==='topic'&&[...service.produces,...service.consumes].includes(selected.name)||selected.kind==='gate'&&[...service.produces,...service.consumes].includes(selected.topic);
 const consumers=mainOnly?0:gateCount===undefined?service.consumers:gateCount,producers=mainOnly||gateCount?0:service.producers;
 const frontPositions=Array.from({length:consumers},(_,index)=>(index+1)*width/(consumers+1));
 const sidePositions=Array.from({length:producers},(_,index)=>(index+1)*depth/(producers+1));
 return <g transform={screenPosition(layout)} opacity={relevant?1:.3} role="button" tabIndex={0} aria-label={`${name} Service`} className="building" onClick={()=>onSelect({kind:'service',name})} onKeyDown={event=>{if(event.key==='Enter')onSelect({kind:'service',name});}}>
 <polygon points={vertices([[20,15],[width+35,15],[width+35,depth+35],[20,depth+35]])} fill="#3e6039" opacity=".18"/>
 <IsoBox u={-9} v={-9} width={width+18} depth={depth+18} height={7} roof="#f0d9ac" front="#c5ac7e" side="#ab956e"/>
 {frontPositions.map((position,index)=><polygon key={`apron-${index}`} points={vertices([[position-18,depth],[position+18,depth],[position+18,depth+26],[position-18,depth+26]])} fill="#d9c49b" stroke="#f4e2bf" strokeWidth="1"/>)}
 {sidePositions.map((position,index)=><polygon key={`ship-${index}`} points={vertices([[width,position-15],[width+25,position-15],[width+25,position+15],[width,position+15]])} fill="#dcc498" stroke="#f3dfba" strokeWidth="1"/>)}
 <IsoBox width={width} depth={depth} height={height} radius={19} roof={palettes[0]} front={palettes[1]} side={palettes[2]}/>
 <IsoBox u={-5} v={-5} width={width+10} depth={depth+10} height={9} base={height} roof="#fff1cb" front="#e1c999" side="#c5ae81"/>
 <IsoBox u={9} v={9} width={width-18} depth={depth-18} height={9} base={height+9} roof={palettes[0]} front={palettes[1]} side={palettes[2]}/>
 <IsoBox {...roofDetails.cap} roof={service.art==='Analytics'?'#c9eece':palettes[0]} front={service.art==='Analytics'?'#64ad97':palettes[1]} side={service.art==='Analytics'?'#468b80':palettes[2]}/>
 {service.art==='Analytics'&&[0,1,2].map(index=><polygon key={index} points={vertices([[width*.29+index*19,depth*.26,height+40],[width*.29+index*19+15,depth*.26,height+40],[width*.29+index*19+15,depth*.68,height+40],[width*.29+index*19,depth*.68,height+40]])} fill="#7dc3b3" stroke="#ddf0b5" strokeWidth="2"/>)}
 {service.art==='Orders'&&<g><IsoBox {...roofDetails.chimney[0]} roof="#f8dfa1" front="#bd8042" side="#9b6339"/><IsoBox {...roofDetails.chimney[1]} roof="#ffe6ae" front="#d79b51" side="#ab733d"/></g>}
 {service.art==='Payment'&&<g transform={`matrix(1 .5 0 1 ${width*.55-depth*.44} ${(width*.55+depth*.44)/2-height-42})`}><circle cy="-15" r="19" fill="#b78530"/><circle cx="-3" cy="-17" r="19" fill="#ffe082" stroke="#e6b24e" strokeWidth="3"/><path d="M-11-18-5-11 6-25" stroke="#b37d2e" strokeWidth="4" fill="none" strokeLinecap="round"/></g>}
 <g transform={`matrix(1 .5 0 1 ${-depth} ${depth/2})`}><path d={`M8-62H${width-8}`} stroke="#ffefc2" strokeWidth="6"/>{Array.from({length:3},(_,index)=><g key={index} transform={`translate(${18+index*(width-36)/2},-85)`}><rect width="17" height="17" rx="7" fill="#203f54"/><path d="M2 3h13v5H2Z" fill="#ade8e3"/></g>)}<rect x={width/2-43} y="-60" width="86" height="16" rx="3" fill="#fff0c7"/><text x={width/2} y="-48" textAnchor="middle" fontSize="8" fontWeight="900" fill="#4d5944">{mainOnly?'':consumers?'RECEIVING':'ORDER DISPATCH'}</text>{frontPositions.map(position=><IsoGate key={position} position={position} wall="front" producer={false} topic={service.consumes[0]} name={name} onSelect={onSelect}/>)}</g>
 {mainOnly&&<g transform={`matrix(1 .5 0 1 ${width/2-depth} ${(width/2+depth)/2})`}><rect x="-10" y="-30" width="20" height="30" rx="8" fill="#36555a" stroke="#ffe6b0" strokeWidth="3"/><circle cx="5" cy="-12" r="2" fill="#ffce6e"/></g>}
 <g transform={`translate(${width},${width/2})`}>{sidePositions.map(position=><IsoGate key={position} position={position} wall="side" producer topic={service.produces[0]} name={name} onSelect={onSelect}/>)}</g>
 {producers>0&&<g transform={`matrix(-1 .5 0 1 ${width} ${width/2})`}><rect x="6" y="-62" width={depth-12} height="16" rx="3" fill="#ffe6b4"/><text x={depth/2} y="-50" textAnchor="middle" fontSize="8" fontWeight="900" fill="#5b4a35">SHIPPING →</text></g>}
 {service.art==='Notification'&&<g transform={screenPosition(roofDetails.antenna)}><path d={`M0 ${-height-18}V${-height-83}`} stroke="#674579" strokeWidth="6"/><path d={`M-18 ${-height-65} 0 ${-height-78} 18 ${-height-65}`} fill="none" stroke="#fff0bc" strokeWidth="5"/><circle cy={-height-83} r="6" fill="#ffce63" className="beacon"/><g transform={`matrix(1 .5 0 1 -2 ${-height-75})`}><path d="M-19-12Q0-28 19-12M-12-6Q0-16 12-6" stroke="#efd7ff" strokeWidth="4" fill="none" strokeLinecap="round"/></g></g>}
 {!mainOnly&&<g transform={`matrix(1 .5 0 1 ${width*.3-depth*.24} ${(width*.3+depth*.24)/2-height-40})`}><rect x="-8" y="-18" width={service.art==='Notification'?118:94} height="24" rx="10" fill="#fff3ce" stroke={palettes[2]} strokeWidth="2"/><text x={service.art==='Notification'?50:39} y="-2" textAnchor="middle" fontSize="10" fontWeight="900" fill="#425546">{name.toUpperCase()}</text></g>}
 </g>;
}
