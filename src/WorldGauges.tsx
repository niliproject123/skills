import {renderModel} from './scenarioRuntime';
import {measuredLag} from './liveData';
import {project} from './isometric';
import type {Selection} from './model';
import {objectFocused,signVisible,visibleObjects,type ViewOptions} from './viewOptions';
export function WorldGauges(){return <div className="world-gauges" aria-label="Consumer lag gauges">{renderModel.terminals.filter(item=>!item.producer).map(terminal=><div key={terminal.id} data-gauge={terminal.id} className="world-gauge"><div className="gauge-track"><div className="gauge-level"/></div><span/><i className="gauge-post first"/><i className="gauge-post second"/></div>)}</div>;}
export function placeGauges(root:HTMLElement,view:{scale:number;x:number;y:number},zoom:number,width:number,height:number,focus:Selection|null,options:ViewOptions){
 const visible=visibleObjects(options);
 for(const terminal of renderModel.terminals.filter(item=>!item.producer)){
  const element=root.querySelector<HTMLElement>(`[data-gauge="${terminal.id}"]`);if(!element)throw new Error(`Missing lag gauge ${terminal.id}`);
  const group=renderModel.consumerGroups.find(item=>item.id===terminal.id)!;
  const point=project(terminal.u+terminal.width/2,terminal.v+terminal.depth/2,95),x=view.x+point.x*view.scale,y=view.y+point.y*view.scale,scale=Math.min(1.2,Math.max(.65,view.scale));
  element.hidden=!visible.services.includes(terminal.service)||!terminal.topics.some(topic=>visible.topics.includes(topic))||!signVisible(options.lagGauges,zoom,objectFocused(focus,'terminal',terminal.id)||objectFocused(focus,'service',terminal.service),1.35)||x<0||x>width||y<0||y>height;
  if(element.hidden)continue;
  const lag=measuredLag(terminal.id,group.lag),level=lag===null?0:lag/(lag+10000),color=lag===null?'#b9bdb1':level<.2?'#73b76e':level<.6?'#efb74e':'#db6554';
  element.style.transform=`translate(${x-36*scale}px,${y-22*scale}px) scale(${scale})`;element.style.background=color;element.style.setProperty('--gauge-post-height',`${40*view.scale/scale}px`);
  element.querySelector<HTMLElement>('.gauge-level')!.style.width=`${Math.max(0,100*level)}%`;
  element.querySelector('span')!.textContent=lag===null?'Unknown':lag.toLocaleString();element.setAttribute('aria-label',`${group.name} lag ${lag===null?'unknown':lag}`);
 }
}
