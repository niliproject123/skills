import {buildings} from './layout';
import {services,type Service,type Selection,type Topic} from './model';
type Props={name:Service;selected:Selection|null;onSelect:(selection:Selection)=>void};
export function ServiceBuilding({name,selected,onSelect}:Props) {
 const [x,y]=buildings[name],service=services[name];
 const relevant=!selected || selected.name===name || (selected.kind==='topic' && [...service.produces,...service.consumes].includes(selected.name));
 function gates(count:number,producer:boolean,topic:Topic,start:number) {return Array.from({length:count},(_,index)=><g key={`${producer}-${index}`} transform={`translate(${start+index*25},48)`} className="gate" role="button" tabIndex={0} onClick={event=>{event.stopPropagation();onSelect({kind:'gate',name,topic,producer});}} onKeyDown={event=>{if(event.key==='Enter')onSelect({kind:'gate',name,topic,producer});}}>
 <title>{name} · {producer?'Producer / outgoing':'Consumer / incoming'} · {topic} · {count} gates · lag {service.lag}</title><rect width="20" height="27" rx="3" fill="#283b41" stroke={producer?'#ffd68d':'#bce6e8'} strokeWidth="3"/><path d="M4 7h12M4 12h12" stroke="#617477"/><path d={producer?'M10 17v8m-4-4 4 4 4-4':'M10 25v-8m-4 4 4-4 4 4'} stroke="white" fill="none"/>
 </g>);}
 return <g transform={`translate(${x},${y})`} opacity={relevant?1:.35} className="building" role="button" tabIndex={0} aria-label={`${name} Service`} onClick={()=>onSelect({kind:'service',name})} onKeyDown={event=>{if(event.key==='Enter')onSelect({kind:'service',name});}}>
 <ellipse cx="25" cy="77" rx="110" ry="35" fill="#2f5846" opacity=".13"/>
 <path d="M-85-15 35-55 115-12-5 30Z" fill={service.color} stroke="#ffffff" strokeWidth="3"/>
 <path d="M-85-15-5 30v65l-80-44Z" fill={service.color}/><path d="M-5 30 115-12v65L-5 95Z" fill={service.color} filter="url(#shade)"/>
 <path d="M-65-19 34-49 89-20-10 13Z" fill="#f7f1da"/><path d="M-52-20 35-46 75-23-12 4Z" fill={service.color} opacity=".6"/>
 <rect x="-58" y="15" width="25" height="22" rx="3" fill="#d4f1ed"/><path d="M-45 16v20" stroke={service.color} strokeWidth="3"/>
 {service.consumers>0&&gates(service.consumers,false,service.consumes[0],0)}
 {service.producers>0&&gates(service.producers,true,service.produces[0],name==='Orders'?0:77)}
 {name==='Notification'&&<g><path d="M35-44v-57m-18 15 18-15 18 15" stroke="#695486" strokeWidth="5" fill="none"/><circle cx="35" cy="-104" r="6" fill="#eed69e" className="beacon"/></g>}
 <g transform="translate(-42,-78)"><rect x="-25" y="-14" width="155" height="30" rx="9" fill="#fffdf3"/><text x="52" y="6" textAnchor="middle" fill="#334942" fontSize="14" fontWeight="700">{name.toUpperCase()}</text></g>
 <text x="25" y="124" textAnchor="middle" fill="#405e50" fontSize="12">{service.lag>10000?'Backed up':service.lag>100?'Falling behind':name==='Orders'?'Shipping orders':'Keeping up'}</text>
 </g>;
}
