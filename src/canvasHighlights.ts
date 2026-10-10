import {topicRoadGeometry} from './roadMesh';
import {overpasses} from './terminalLayout';
import {bridgePoint,bridgeHeight,bridgeEnd} from './bridgeGeometry';
import {services,topics,type Topic,type Selection} from './model';
import {project} from './isometric';
import {highlightDirections} from './highlightDirections';
import {renderModel} from './scenarioRuntime';
import {drawPartitionLane} from './partitionLanes';
export function linked(topic:Topic,selected:Selection|null){return !selected||(selected.kind==='topic'||selected.kind==='partition')&&selected.name===topic||(selected.kind==='gate'||selected.kind==='terminal')&&selected.topic===topic||selected.kind==='service'&&[...services[selected.name].produces,...services[selected.name].consumes].includes(topic)||selected.kind==='broker'&&renderModel.cluster.partitions[topic]?.some(partition=>partition.replicaBrokerIds.includes(selected.name));}
export function drawHighlights(drawing:CanvasRenderingContext2D,selection:Selection,scale:number,visibleTopics=Object.keys(topics)){
 if(selection.kind==='partition'){if(visibleTopics.includes(selection.name))drawPartitionLane(drawing,selection.name,selection.partitionId,scale);return;}
 drawing.strokeStyle='#fff0a3';drawing.lineWidth=3/scale;drawing.globalAlpha=.8;
 for(const topic of visibleTopics)if(linked(topic,selection))for(const curve of topicRoadGeometry(topic).curves){
 drawing.beginPath();curve.points.forEach(({u,v},index)=>{const point=project(u,v);if(index===0)drawing.moveTo(point.x,point.y);else drawing.lineTo(point.x,point.y);});drawing.stroke();
 }
 // Ground road meshes omit elevated spans; highlight their actual ramps and
 // deck explicitly so both bridge axes remain connected to the ground lines.
 for(const bridge of overpasses)if(visibleTopics.includes(bridge.topic)&&linked(bridge.topic,selection)){
  drawing.beginPath();
  [bridge.start,bridge.start+bridge.ramp,bridge.start+bridge.ramp+bridge.deck,bridgeEnd(bridge)].forEach((along,index)=>{const ground=bridgePoint(bridge,along),point=project(ground.u,ground.v,bridgeHeight(bridge,along));if(index===0)drawing.moveTo(point.x,point.y);else drawing.lineTo(point.x,point.y);});
  drawing.stroke();
 }

 drawing.globalAlpha=1;
 drawing.lineWidth=2/scale;drawing.lineCap='round';drawing.lineJoin='round';
 for(const arrow of highlightDirections())if(visibleTopics.includes(arrow.topic)&&linked(arrow.topic,selection)){
  const forwardX=Math.cos(arrow.angle),forwardY=Math.sin(arrow.angle),length=7/scale,width=4/scale;
  drawing.beginPath();
  drawing.moveTo(arrow.x-forwardX*length-forwardY*width,arrow.y-forwardY*length+forwardX*width);
  drawing.lineTo(arrow.x+forwardX*length,arrow.y+forwardY*length);
  drawing.lineTo(arrow.x-forwardX*length+forwardY*width,arrow.y-forwardY*length-forwardX*width);
  drawing.stroke();
 }
}
