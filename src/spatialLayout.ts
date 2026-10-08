import {buildLayout} from './scenarioLayout';
import {roadGap} from './roadClearance';
import {dockApproachLength} from './terminalConnection';
import type {LayoutModel,TopologyModel} from './scenarioTypes';

let accepted:{key:string;layout:LayoutModel}|undefined;
export function rememberSpatialLayout(topology:TopologyModel,original:LayoutModel,layout:LayoutModel){
 accepted={key:JSON.stringify([topology,original]),layout:structuredClone(layout)};
}
export function displayedSpatialLayout(topology:TopologyModel,original:LayoutModel){
 return accepted?.key===JSON.stringify([topology,original])?structuredClone(accepted.layout):spatialLayout(topology,original);
}

export function automaticSpatialLayout(layout:LayoutModel){
 return !Object.keys(layout.services).length&&!Object.keys(layout.terminals).length&&
  !Object.keys(layout.routes).length&&!Object.keys(layout.topics).length&&!layout.overpasses.length;
}

// Widths, turn envelopes and complete dock approaches determine the packing.
// A candidate is accepted by mapLayout only after all actual roads can be routed.
export function spatialLayout(topology:TopologyModel,original:LayoutModel,expansion=1):LayoutModel{
 const result=structuredClone(original),count=topology.services.length;
 if(!count)return result;
 const maximumHalfWidth=Math.max(11,...topology.topics.map(topic=>topic.partitionCount*11));
 const turnRadius=maximumHalfWidth+18;
 const turnClearance=(maximumHalfWidth*2+roadGap+turnRadius+64)*expansion;
 // Explicit origin placements let the ordinary terminal sizing code calculate
 // real bay dimensions without recursively requesting automatic placement.
 const seed:LayoutModel={...original,services:Object.fromEntries(topology.services.map(service=>[service.id,{u:0,v:0}]))};
 const measured=buildLayout({topology,layout:seed});
 const campuses=topology.services.map(service=>{
  const building=measured.buildings[service.id];
  const owned=measured.terminals.filter(terminal=>terminal.service===service.id);
  let producerFront=0,right=building.width,bottom=building.depth;
  for(const terminal of owned.filter(item=>item.producer)){
   const lanes=topology.topics.find(topic=>topic.id===terminal.topics[0])!.partitionCount;
   const u=building.width+45,v=producerFront;
   result.terminals[terminal.id]={u,v,width:terminal.width,depth:terminal.depth,wall:'side'};
   producerFront=v+terminal.depth+turnClearance;
   right=Math.max(right,u+terminal.width+dockApproachLength(lanes)+turnClearance);
   bottom=Math.max(bottom,v+terminal.depth+turnClearance);
  }
  let receiverRight=0;
  const receivingRow=bottom+turnClearance;
  for(const terminal of owned.filter(item=>!item.producer)){
   const lanes=Math.max(...terminal.topics.map(id=>topology.topics.find(topic=>topic.id===id)!.partitionCount));
   result.terminals[terminal.id]={u:receiverRight,v:receivingRow,width:terminal.width,depth:terminal.depth,wall:'front'};
   receiverRight+=terminal.width+turnClearance;
   right=Math.max(right,receiverRight);
   bottom=Math.max(bottom,receivingRow+terminal.depth+dockApproachLength(lanes)+turnClearance);
  }
  return {id:service.id,width:right+roadGap,depth:bottom+roadGap};
 });
 // Choose a grid from the measured campus proportions, rather than a fixed
 // number of services per row. Related services retain topology order.
 const averageWidth=campuses.reduce((sum,campus)=>sum+campus.width,0)/count;
 const averageDepth=campuses.reduce((sum,campus)=>sum+campus.depth,0)/count;
 const columns=Math.min(count,Math.max(1,Math.round(Math.sqrt(count*averageDepth/averageWidth))));
 const rows=Math.ceil(count/columns);
 const participants=topology.topics.map(topic=>({
  width:topic.partitionCount*22,
  positions:[...new Set([...topology.producers.filter(item=>item.topicId===topic.id).map(item=>item.serviceId),
   ...topology.consumerGroups.filter(item=>item.topicIds.includes(topic.id)).map(item=>item.serviceId)])]
   .map(id=>campuses.findIndex(campus=>campus.id===id))
 }));
 const corridor=(boundary:number,axis:'column'|'row')=>{
  const crossing=participants.filter(topic=>{
   const positions=topic.positions.map(index=>axis==='column'?index%columns:Math.floor(index/columns));
   return positions.some(position=>position<=boundary)&&positions.some(position=>position>boundary);
  });
  return crossing.reduce((width,topic)=>width+(topic.width+roadGap)*expansion,turnClearance*2);
 };
 const columnStarts=[0],rowStarts=[0];
 for(let column=0;column<columns-1;column++)columnStarts.push(columnStarts[column]+
  Math.max(...campuses.filter((_,index)=>index%columns===column).map(campus=>campus.width))+corridor(column,'column'));
 for(let row=0;row<rows-1;row++)rowStarts.push(rowStarts[row]+
  Math.max(...campuses.slice(row*columns,(row+1)*columns).map(campus=>campus.depth))+corridor(row,'row'));
 campuses.forEach((campus,index)=>{
  const u=columnStarts[index%columns],v=rowStarts[Math.floor(index/columns)];
  result.services[campus.id]={u,v,width:150,depth:110};
  for(const terminal of measured.terminals.filter(item=>item.service===campus.id)){
   const placement=result.terminals[terminal.id];placement.u!+=u;placement.v!+=v;
  }
 });
 return result;
}
