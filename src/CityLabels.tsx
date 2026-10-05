import {currentScenario,renderModel} from './scenarioRuntime';
import {serviceSignAnchor} from './signAnchors';
import {cityBuildings} from './cityLayout';
import {terminals} from './terminalLayout';
import {project} from './isometric';
import {services,topics,type Service,type Selection} from './model';
import {topicTheme} from './topicTheme';
export function getCityLabels():{id:string;name:string;point:{x:number;y:number};kind:string;close:boolean;detailed?:boolean;accent?:string;rise?:number;offsetX?:number;offsetY?:number}[]{return [
 ...(Object.keys(cityBuildings) as Service[]).map(name=>{const anchor=serviceSignAnchor(name);return {id:`service-${name}`,name:services[name].name.toUpperCase(),point:project(anchor.u,anchor.v),rise:anchor.rise,offsetX:anchor.offsetX,offsetY:anchor.offsetY,kind:'service',close:false};}),
 ...Object.keys(topics).filter(topic=>renderModel.labelAnchors[`topic-${topic}`]).map(topic=>{const anchor=renderModel.labelAnchors[`topic-${topic}`];return {id:`topic-${topic}`,name:topics[topic].name,point:project(anchor.u,anchor.v),accent:topicTheme[topic].accent,rise:anchor.rise,kind:'topic',close:false};}),
 ...terminals.map(terminal=>{const anchor=renderModel.labelAnchors[`terminal-${terminal.id}`];return {id:terminal.id,name:terminal.name,point:project(anchor.u,anchor.v),accent:topicTheme[terminal.topics[0]].accent,rise:anchor.rise,kind:'terminal',close:true};})

];}
export function CityLabels(){return <div className="city-labels" aria-label="City names">{getCityLabels().map(label=><span key={label.id} data-label={label.id} className={`city-label ${label.kind}`}>{label.name}</span>)}</div>;}
export function placeLabels(root:HTMLElement,view:{scale:number;x:number;y:number},zoom:number,width:number,height:number,focus:Selection|null=null){
 const occupied:{x:number;y:number;width:number;height:number}[]=[];
 for(const label of getCityLabels()){const element=root.querySelector<HTMLElement>(`[data-label="${label.id}"]`);if(!element)throw new Error(`Missing HTML label ${label.id}`);
 const settings=currentScenario.visualization.labels;const override=currentScenario.layout.labels?.[label.kind==='terminal'?`terminal-${label.id}`:label.id]??currentScenario.layout.labels?.[label.kind==='service'?label.id.slice(8):label.kind==='topic'?label.id.slice(6):label.id];const point=override?project(override.labelAnchor.x,override.labelAnchor.y):label.point;
 const boxWidth=label.name.length*(label.kind==='service'?8:6.5)+8;let anchorY=view.y+point.y*view.scale,anchorX=view.x+point.x*view.scale;let x=anchorX-boxWidth/2,y=anchorY-20+(override?override.labelOffset.y:-(label.rise!==undefined?label.rise*view.scale:settings?.poleLength??32)+(settings?.offsetY??0));
 const visible=!(label.close&&zoom<=1.35&&!(focus?.kind==='terminal'&&focus.id===label.id))&&x+boxWidth>0&&x<width&&y+22>0&&y<height;
 element.hidden=!visible;if(!visible)continue;

 for(let attempt=0;attempt<5;attempt++){if(!occupied.some(box=>x<box.x+box.width+5&&x+boxWidth+5>box.x&&y<box.y+box.height+4&&y+22>box.y))break;y-=25;}

 occupied.push({x,y,width:boxWidth,height:20});element.style.width=`${boxWidth}px`;element.style.fontSize=`${label.kind==='service'?settings?.serviceSize??14:label.kind==='topic'?settings?.topicSize??11:10}px`;const poleX=anchorX-(x+boxWidth/2),poleY=anchorY-y-20;element.style.setProperty('--pole-height',`${Math.hypot(poleX,poleY)}px`);element.style.setProperty('--pole-angle',`${-Math.atan2(poleX,poleY)*180/Math.PI}deg`);element.style.setProperty('--sign-color',label.accent||'#8a805d');element.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
 }
}
