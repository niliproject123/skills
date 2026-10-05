import {topicRoadGeometry} from './roadMesh';
import {roadElevation} from './terminalLayout';
import {services,topics,type Topic,type Selection} from './model';
import {project} from './isometric';
export function linked(topic:Topic,selected:Selection|null){return !selected||selected.kind==='topic'&&selected.name===topic||(selected.kind==='gate'||selected.kind==='terminal')&&selected.topic===topic||selected.kind==='service'&&[...services[selected.name].produces,...services[selected.name].consumes].includes(topic);}
export function drawHighlights(drawing:CanvasRenderingContext2D,selection:Selection,scale:number){
 drawing.strokeStyle='#fff0a3';drawing.lineWidth=3/scale;drawing.globalAlpha=.8;
 for(const topic of Object.keys(topics))if(linked(topic,selection))for(const curve of topicRoadGeometry(topic).curves){
 drawing.beginPath();curve.points.forEach(({u,v},index)=>{const point=project(u,v,roadElevation(topic,u,v));if(index===0)drawing.moveTo(point.x,point.y);else drawing.lineTo(point.x,point.y);});drawing.stroke();
 }

 drawing.globalAlpha=1;
}
