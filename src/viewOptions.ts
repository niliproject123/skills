import type {Selection} from './model';
import {renderModel} from './scenarioRuntime';
export type SignMode='automatic'|'always'|'hidden';
export type ViewOptions={topics:string[];services:string[];serviceSigns:SignMode;topicSigns:SignMode;lagGauges:SignMode};
export const defaultViewOptions:ViewOptions={topics:[],services:[],serviceSigns:'automatic',topicSigns:'automatic',lagGauges:'automatic'};
export function visibleObjects(options:ViewOptions){
 const allTopics=Object.keys(renderModel.topics),allServices=Object.keys(renderModel.services);
 const selectedServices=options.services.filter(id=>allServices.includes(id)),selectedTopics=options.topics.filter(id=>allTopics.includes(id));
 const serviceTopics=new Set(selectedServices.flatMap(id=>[...renderModel.services[id].produces,...renderModel.services[id].consumes]));
 const topics=allTopics.filter(id=>(!selectedTopics.length||selectedTopics.includes(id))&&(!selectedServices.length||serviceTopics.has(id)));
 const services=!selectedTopics.length&&!selectedServices.length?allServices:allServices.filter(id=>selectedServices.includes(id)||[...renderModel.services[id].produces,...renderModel.services[id].consumes].some(topic=>topics.includes(topic)));
 return {topics,services,filtered:!!selectedTopics.length||!!selectedServices.length};
}
export function signVisible(mode:SignMode,zoom:number,focused:boolean,threshold:number){return mode!=='hidden'&&(mode==='always'||zoom>=threshold||focused);}
export function objectFocused(selection:Selection|null,kind:'service'|'topic'|'terminal',id:string){return !!selection&&(kind==='terminal'?selection.kind==='terminal'&&selection.id===id:kind==='topic'?(selection.kind==='topic'||selection.kind==='partition'?selection.name:selection.kind==='terminal'||selection.kind==='gate'?selection.topic:undefined)===id:selection.name===id&&selection.kind!=='topic'&&selection.kind!=='partition'&&selection.kind!=='broker');}
export function parseFocus(key:string):{topics:string[];services:string[]}|null{return key.startsWith('view:')?JSON.parse(key.slice(5)):null;}
