import {topicRoadGeometry} from './roadMesh';
import {cityBuildings} from './cityLayout';
import {terminals,roadElevation} from './terminalLayout';
import {services,topics,type Topic,type Selection} from './model';
import {project} from './isometric';
export function linked(topic:Topic,selected:Selection|null){return !selected||selected.kind==='topic'&&selected.name===topic||(selected.kind==='gate'||selected.kind==='terminal')&&selected.topic===topic||selected.kind==='service'&&[...services[selected.name].produces,...services[selected.name].consumes].includes(topic);}
export function drawHighlights(drawing:CanvasRenderingContext2D,selection:Selection,scale:number){
 drawing.strokeStyle='#fff0a3';drawing.lineWidth=3/scale;drawing.globalAlpha=.8;
 for(const topic of Object.keys(topics))if(linked(topic,selection))for(const curve of topicRoadGeometry(topic).curves){
 drawing.beginPath();curve.points.forEach(({u,v},index)=>{const point=project(u,v,roadElevation(topic,u,v));if(index===0)drawing.moveTo(point.x,point.y);else drawing.lineTo(point.x,point.y);});drawing.stroke();
 }

 for(const terminal of terminals){const related=selection.kind==='service'?selection.name===terminal.service:selection.kind==='terminal'?selection.id===terminal.id:terminal.topics.some(topic=>linked(topic,selection));if(!related)continue;
 const point=project(terminal.u+terminal.width/2,terminal.v+terminal.depth);drawing.beginPath();drawing.ellipse(point.x,point.y,terminal.width*.6,terminal.width*.3,0,0,Math.PI*2);drawing.stroke();}
 if(selection.kind!=='topic'){const building=cityBuildings[selection.name],point=project(building.u+building.width/2,building.v+building.depth);drawing.beginPath();drawing.ellipse(point.x,point.y,building.width*.6,building.width*.3,0,0,Math.PI*2);drawing.stroke();}drawing.globalAlpha=1;
}
