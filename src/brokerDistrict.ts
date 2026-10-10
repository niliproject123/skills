import {renderModel,clusterRevision,scenarioRevision} from './scenarioRuntime';
import {project} from './isometric';
import type {Broker,PartitionPlacement} from './scenarioTypes';
import type {Selection} from './model';
import {drawBrokerBuilding,drawReplicaModule,polygon} from './brokerGeometry';
import {partitionLanes} from './partitionLanes';
type Replica={topic:string;placement:PartitionPlacement};
type Entry={topic:string;placement:PartitionPlacement|null;count:number};
type Token={topic:string;partitionId:number|null;brokerId:string;count:number;x:number;y:number;leader:boolean;inSync:boolean|null};
type Building={broker:Broker;u:number;v:number;image:HTMLCanvasElement;tokens:Token[];left:number;top:number};
type Group={name:string;u:number;v:number;width:number;depth:number};
type District={buildings:Building[];groups:Group[];center:{x:number;y:number};replicas:number;bytes:number};
let prepared:District|undefined,preparedKey='',source='';
function inside(x:number,y:number,points:{x:number;y:number}[]){let result=false;for(let index=0,previous=points.length-1;index<points.length;previous=index++){const before=points[index],after=points[previous];if((before.y>y)!==(after.y>y)&&x<(after.x-before.x)*(y-before.y)/(after.y-before.y)+before.x)result=!result;}return result;}
function hosted(brokerId:string):Replica[]{return Object.entries(renderModel.cluster.partitions).flatMap(([topic,partitions])=>partitions.filter(partition=>partition.replicaBrokerIds.includes(brokerId)).map(placement=>({topic,placement})));}
function relevant(topic:string,partitionId:number|null,brokerId:string,selection:Selection|null,visibleTopics:string[]){
 if(!visibleTopics.includes(topic))return false;
 if(!selection)return true;
 if(selection.kind==='broker')return selection.name===brokerId;
 if(selection.kind==='partition')return selection.name===topic&&selection.partitionId===partitionId;
 if(selection.kind==='topic')return selection.name===topic;
 if(selection.kind==='service')return [...renderModel.services[selection.name].produces,...renderModel.services[selection.name].consumes].includes(topic);
 return selection.topic===topic;
}
function prepareDistrict(selection:Selection|null,visibleTopics:string[]):District{
 const key=JSON.stringify([selection?.kind,selection?.name,selection?.kind==='partition'?selection.partitionId:null,selection?.kind==='terminal'||selection?.kind==='gate'?selection.topic:null,visibleTopics]);
 const currentSource=`${scenarioRevision}/${clusterRevision}`;
 if(prepared&&preparedKey===key&&source===currentSource)return prepared;
 for(const building of prepared?.buildings??[])building.image.width=building.image.height=0;
 const groups=new Map<string,Broker[]>();
 for(const broker of renderModel.cluster.brokers){const name=[broker.zone?`AZ ${broker.zone}`:'',broker.rack?`Rack ${broker.rack}`:''].filter(Boolean).join(' · ')||'Brokers';groups.set(name,[...(groups.get(name)??[]),broker]);}
 const storageDepth=Math.max(230,...renderModel.cluster.brokers.map(broker=>{const copies=hosted(broker.id),modules=copies.length<=24?copies.length:new Set(copies.map(copy=>copy.topic)).size;return 150+Math.ceil(modules/6)*25;})),stride=storageDepth+22;
 const spriteBytes=Math.ceil((storageDepth+220)*1.5)*Math.ceil(((storageDepth+180)/2+130)*1.5)*4*renderModel.cluster.brokers.length;
 if(spriteBytes>64*1024*1024)throw new Error('Broker District exceeds its 64 MiB sprite budget. Send a smaller, explicitly scoped broker/topic topology.');
 const ordered=[...groups].sort(([a],[b])=>a.localeCompare(b)),columns=Math.max(1,Math.ceil(Math.sqrt(ordered.length))),slots=ordered.map(([name,brokers])=>{const columns=Math.min(4,Math.ceil(Math.sqrt(brokers.length)));return {name,brokers,columns,width:columns*200+26,depth:Math.ceil(brokers.length/columns)*stride+36};});
 const columnWidth=Math.max(200,...slots.map(slot=>slot.width))+24,rowDepth=Math.max(260,...slots.map(slot=>slot.depth))+24,totalWidth=columns*columnWidth,totalDepth=Math.ceil(slots.length/columns)*rowDepth;
 const bounds=renderModel.worldBounds,center={x:bounds.x+bounds.width*.55,y:bounds.y+bounds.height*.46},origin={u:center.y+center.x/2-totalWidth/2,v:center.y-center.x/2-totalDepth/2};
 const buildings:Building[]=[],districtGroups:Group[]=[];
 slots.forEach((slot,index)=>{
  const u=origin.u+(index%columns)*columnWidth,v=origin.v+Math.floor(index/columns)*rowDepth;
  districtGroups.push({name:slot.name,u,v,width:slot.width,depth:slot.depth});
  slot.brokers.slice().sort((a,b)=>a.id.localeCompare(b.id)).forEach((broker,index)=>{
   const buildingU=u+14+(index%slot.columns)*200,buildingV=v+28+Math.floor(index/slot.columns)*stride,replicas=hosted(broker.id);
   // Dense brokers use explicit topic-count modules in overview. Selection
   // resolves them to the exact partition copy, never an invented placement.
   const entries:Entry[]=replicas.length<=24?replicas.map(replica=>({...replica,count:1})):Object.keys(renderModel.topics).flatMap<Entry>(topic=>{
    const copies=replicas.filter(replica=>replica.topic===topic);if(!copies.length)return [];
    if(copies.length===1)return [{...copies[0],count:1}];
    if(selection?.kind==='partition'&&selection.name===topic){const copy=copies.find(replica=>replica.placement.partitionId===selection.partitionId);return copy?[{...copy,count:1}]:[{topic,placement:null,count:copies.length}];}
    return [{topic,placement:null,count:copies.length}];
   });
   const left=-storageDepth-20,top=-110,image=document.createElement('canvas');image.width=Math.ceil((storageDepth+220)*1.5);image.height=Math.ceil(((storageDepth+180)/2+130)*1.5);const drawing=image.getContext('2d');if(!drawing)throw new Error('Broker sprite Canvas 2D is unavailable.');drawing.setTransform(1.5,0,0,1.5,-left*1.5,-top*1.5);drawBrokerBuilding(drawing,storageDepth);
   const tokens:Token[]=[];
   entries.forEach((entry,index)=>{
    const partition=entry.placement,tokenU=18+(index%6)*25,tokenV=132+Math.floor(index/6)*25,partitionId=partition?.partitionId??null,leader=partition?.leaderBrokerId===broker.id,inSync=partition?.inSyncReplicaBrokerIds===null||!partition?null:partition.inSyncReplicaBrokerIds.includes(broker.id),focused=relevant(entry.topic,partitionId,broker.id,selection,visibleTopics);
    drawing.save();drawing.globalAlpha=focused?1:.2;drawReplicaModule(drawing,tokenU,tokenV,renderModel.themes[entry.topic].accent,leader,inSync,entry.count,!!selection&&focused);drawing.restore();
    const anchor=project(buildingU+tokenU+11,buildingV+tokenV+12,24);tokens.push({topic:entry.topic,partitionId,brokerId:broker.id,count:entry.count,...anchor,leader,inSync});
   });
   buildings.push({broker,u:buildingU,v:buildingV,image,tokens,left,top});
  });
 });
 const replicas=Object.values(renderModel.cluster.partitions).flat().reduce((sum,partition)=>sum+partition.replicaBrokerIds.length,0),bytes=buildings.reduce((sum,building)=>sum+building.image.width*building.image.height*4,0);
 prepared={buildings,groups:districtGroups,center,replicas,bytes};preparedKey=key;source=currentSource;return prepared;
}
export function drawBrokerDistrict(drawing:CanvasRenderingContext2D,selection:Selection|null,visibleTopics:string[],scale:number,visible:{x:number;y:number;width:number;height:number}){
 const district=prepareDistrict(selection,visibleTopics);drawing.save();
 for(const group of district.groups){const {u,v,width,depth}=group;polygon(drawing,[[u,v],[u+width,v],[u+width,v+depth],[u,v+depth]].map(([u,v])=>project(u,v)),'#c7c9af','#8b9c88');}
 const selectedTokens:Token[]=[];
 for(const building of district.buildings.slice().sort((a,b)=>a.u+a.v-b.u-b.v)){
  const position=project(building.u,building.v),left=position.x+building.left,top=position.y+building.top,width=building.image.width/1.5,height=building.image.height/1.5;
  const onScreen=left+width>=visible.x&&left<=visible.x+visible.width&&top+height>=visible.y&&top<=visible.y+visible.height;
  if(onScreen)drawing.drawImage(building.image,left,top,width,height);
  if(selection?.kind==='broker'&&selection.name===building.broker.id){drawing.strokeStyle='#fff0a2';drawing.lineWidth=2/scale;drawing.beginPath();const depth=-building.left-20;[[3,3],[179,3],[179,depth+3],[3,depth+3]].map(([u,v])=>project(building.u+u,building.v+v,8)).forEach((point,index)=>index?drawing.lineTo(point.x,point.y):drawing.moveTo(point.x,point.y));drawing.closePath();drawing.stroke();}
  if(scale>.24||selection?.kind==='broker'&&selection.name===building.broker.id||selection?.kind==='partition'&&building.tokens.some(token=>token.partitionId===selection.partitionId&&token.topic===selection.name)){
   // Dedicated campus-edge anchor keeps the pole clear of server roof props.
   const anchor=project(building.u+3,building.v+120),top=project(building.u+3,building.v+120,156);drawing.strokeStyle='#727b74';drawing.lineWidth=1/scale;drawing.beginPath();drawing.moveTo(anchor.x,anchor.y);drawing.lineTo(top.x,top.y);drawing.stroke();
   drawing.font=`600 ${Math.min(28,12/scale)}px system-ui`;drawing.textAlign='center';const width=drawing.measureText(building.broker.name).width+14;drawing.fillStyle='#f5eed1';drawing.fillRect(top.x-width/2,top.y-16/scale,width,20/scale);drawing.fillStyle='#3b5155';drawing.fillText(building.broker.name,top.x,top.y-3/scale);
  }
  for(const token of building.tokens)if(selection?.kind==='partition'&&token.topic===selection.name&&token.partitionId===selection.partitionId)selectedTokens.push(token);
 }
 if(scale>.25)for(const group of district.groups){const label=project(group.u+group.width/2,group.v+group.depth,5);drawing.font=`600 ${11/scale}px system-ui`;drawing.textAlign='center';const width=drawing.measureText(group.name).width+10/scale;drawing.fillStyle='#e9e8cddd';drawing.fillRect(label.x-width/2,label.y-10/scale,width,16/scale);drawing.fillStyle='#425652';drawing.fillText(group.name,label.x,label.y+2/scale);}
 if(scale>.32)for(const token of selectedTokens){const label=`${token.leader?'Leader':'Follower'} · ${token.inSync===null?'ISR unknown':token.inSync?'in ISR':'outside ISR'}`;drawing.font=`600 ${10/scale}px system-ui`;drawing.textAlign='center';const width=drawing.measureText(label).width+8/scale;drawing.fillStyle='#f7efd5e6';drawing.fillRect(token.x-width/2,token.y+9/scale,width,15/scale);drawing.fillStyle='#304c51';drawing.fillText(label,token.x,token.y+20/scale);}
 if(selection?.kind==='partition'&&selection.anchor){drawing.strokeStyle='#7b958c';drawing.lineWidth=1.4/scale;drawing.setLineDash([4/scale,6/scale]);for(const token of selectedTokens){drawing.beginPath();drawing.moveTo(selection.anchor.x,selection.anchor.y);drawing.bezierCurveTo(selection.anchor.x,selection.anchor.y-70,token.x,token.y-70,token.x,token.y);drawing.stroke();}drawing.setLineDash([]);}
 drawing.restore();return {replicas:district.replicas,connections:selection?.kind==='partition'&&selection.anchor?selectedTokens.length:0,center:district.center,bytes:district.bytes};
}
export function pickBrokerDistrict(x:number,y:number,selection:Selection|null,visibleTopics:string[]):Selection|null{
 const district=prepareDistrict(selection,visibleTopics);
 for(const building of district.buildings.slice().sort((a,b)=>b.u+b.v-a.u-a.v)){
  for(const token of building.tokens)if(Math.abs(x-token.x)<20&&Math.abs(y-token.y)<17){if(token.partitionId===null)return {kind:'topic',name:token.topic};const lane=partitionLanes().find(lane=>lane.topic===token.topic&&lane.partitionId===token.partitionId),anchor=selection?.kind==='partition'&&selection.name===token.topic&&selection.partitionId===token.partitionId?selection.anchor:lane?.points[Math.floor(lane.points.length/2)];return {kind:'partition',name:token.topic,partitionId:token.partitionId,anchor};}
  const outline=[[12,10,92],[164,10,92],[164,10,0],[164,116,0],[12,116,0],[12,116,92]].map(([u,v,height])=>project(building.u+u,building.v+v,height));if(inside(x,y,outline))return {kind:'broker',name:building.broker.id};
 }
 return null;
}
export function brokerDistrictBounds(selection:Selection|null,visibleTopics:string[]){
 const district=prepareDistrict(selection,visibleTopics),points=district.groups.flatMap(group=>[[group.u,group.v],[group.u+group.width,group.v],[group.u,group.v+group.depth],[group.u+group.width,group.v+group.depth]].map(([u,v])=>project(u,v)));
 if(!points.length)throw new Error('Broker topology has not been supplied.');
 const x=Math.min(...points.map(point=>point.x)),y=Math.min(...points.map(point=>point.y))-200;
 return {x,y,width:Math.max(...points.map(point=>point.x))-x,height:Math.max(...points.map(point=>point.y))-y+30};
}
