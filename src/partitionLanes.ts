import {cityRoutes,pavedRoutePoints} from './cityLayout';
import {curvedCenterline,offsetCurve,lanePath,sampleLane} from './laneGeometry';
import {laneBridgeTravel,bridgeTravelHeight} from './bridgeTravel';
import {overpasses} from './terminalLayout';
import {scenarioRevision} from './scenarioRuntime';
import {project} from './isometric';
import type {Selection} from './model';
type Lane={topic:string;partitionId:number;points:{x:number;y:number}[];arrows:{x:number;y:number;angle:number}[];bounds:{x:number;y:number;width:number;height:number};elevated:boolean};
let revision=-1,lanes:Lane[]=[];
export function partitionLanes(){
 if(revision===scenarioRevision)return lanes;
 lanes=cityRoutes.flatMap(route=>{
  const center=curvedCenterline(pavedRoutePoints(route),route.lanes*11+18);
  return Array.from({length:route.lanes},(_,partitionId)=>{
   const path=lanePath(offsetCurve(center,(partitionId-(route.lanes-1)/2)*22)),bridges=laneBridgeTravel(path,overpasses.filter(bridge=>bridge.topic===route.topic));
   // Straight sections need only their endpoints. Add exact ramp/deck breaks
   // so elevation remains linear and identical to the traffic path.
   const distances=new Set([...path.distances,...bridges.flatMap(span=>{const ramp=(span.exit-span.entry)*span.bridge.ramp/(span.bridge.deck+span.bridge.ramp*2);return [span.entry,span.entry+ramp,span.exit-ramp,span.exit];})]);
   const screenPoint=(distance:number)=>{const position=sampleLane(path,distance),span=bridges.find(bridge=>distance>=bridge.entry&&distance<=bridge.exit);return project(position.u,position.v,span?bridgeTravelHeight(span,position):0);};
   const points=[...distances].sort((a,b)=>a-b).map(screenPoint),arrows=Array.from({length:Math.floor((path.length-35)/140)},(_,index)=>{const distance=35+index*140,point=screenPoint(distance),before=screenPoint(distance-3),after=screenPoint(distance+3);return {...point,angle:Math.atan2(after.y-before.y,after.x-before.x)};});
   const xs=points.map(point=>point.x),ys=points.map(point=>point.y),x=Math.min(...xs),y=Math.min(...ys);
   return {topic:route.topic,partitionId,points,arrows,bounds:{x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y},elevated:!!bridges.length};
  });
 });revision=scenarioRevision;return lanes;
}
export function pickPartitionLane(x:number,y:number):Selection|null{
 let closest:{distance:number;selection:Selection}|null=null;
 for(const lane of partitionLanes()){
  const bounds=lane.bounds;if(x<bounds.x-14||x>bounds.x+bounds.width+14||y<bounds.y-14||y>bounds.y+bounds.height+14)continue;
  for(let index=1;index<lane.points.length;index++){
   const before=lane.points[index-1],after=lane.points[index],dx=after.x-before.x,dy=after.y-before.y,length=dx*dx+dy*dy;if(length===0)continue;
   const fraction=Math.max(0,Math.min(1,((x-before.x)*dx+(y-before.y)*dy)/length)),anchor={x:before.x+dx*fraction,y:before.y+dy*fraction},distance=Math.hypot(x-anchor.x,y-anchor.y);
   if(distance<10&&(!closest||distance<closest.distance))closest={distance,selection:{kind:'partition',name:lane.topic,partitionId:lane.partitionId,anchor}};
  }
 }return closest?.selection??null;
}
export function drawPartitionLane(drawing:CanvasRenderingContext2D,topic:string,partitionId:number,scale:number){
 drawing.save();drawing.strokeStyle='#fff3b6';drawing.lineWidth=3/scale;drawing.lineCap='round';drawing.lineJoin='round';
 for(const lane of partitionLanes())if(lane.topic===topic&&lane.partitionId===partitionId){
  drawing.beginPath();lane.points.forEach((point,index)=>{if(index===0)drawing.moveTo(point.x,point.y);else drawing.lineTo(point.x,point.y);});drawing.stroke();
  // Arrows follow the same elevated lane used for picking and traffic.
  for(const point of lane.arrows){const length=6/scale;drawing.beginPath();drawing.moveTo(point.x-Math.cos(point.angle-.55)*length,point.y-Math.sin(point.angle-.55)*length);drawing.lineTo(point.x,point.y);drawing.lineTo(point.x-Math.cos(point.angle+.55)*length,point.y-Math.sin(point.angle+.55)*length);drawing.stroke();}
 }drawing.restore();
}
