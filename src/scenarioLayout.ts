import {terrainOutline} from './terrainOutline';
import {topicTrunkRoute} from './autoRouting';
import {computeLayout} from './autoLayout';
import {bayPosition} from './terminalConnection';
import type {LayoutConfiguration,Terminal,Point,DerivedRenderModel} from './scenarioTypes';
export function buildLayout(config:LayoutConfiguration){
 const buildings:DerivedRenderModel['cityBuildings']={};
 for(const [id,placement] of Object.entries(computeLayout(config.topology,config.layout)))buildings[id]={...placement,width:placement.width??150,depth:placement.depth??110};
 const terminals:Terminal[]=[];
 const entries=[...config.topology.producers.map(producer=>({id:producer.id,name:producer.id,service:producer.serviceId,topics:[producer.topicId],instances:producer.producerCount,producer:true})),...config.topology.consumerGroups.map(group=>({id:group.id,name:group.name,service:group.serviceId,topics:group.topicIds,instances:group.consumerCount,producer:false}))];
 for(const entry of entries){
 const building=buildings[entry.service],placement=config.layout.terminals[entry.id]??{},wall=placement.wall??(entry.producer?'side':'front');
 const bands=entry.topics.map(id=>{const topic=config.topology.topics.find(item=>item.id===id)!;return {id,width:topic.partitionCount*22};});
 const bandGap=Math.max(96,28+(Math.max(...bands.map(band=>band.width/2))+18)/2);
 const bandWidth=bands.reduce((sum,band)=>sum+band.width,0)+Math.max(0,bands.length-1)*bandGap;
 let across=-bandWidth/2;const topicOffsets=Object.fromEntries(bands.map(band=>{const center=across+band.width/2;across+=band.width+bandGap;return [band.id,center];}));
 const minimum=Math.max((entry.instances+1)*34,entry.topics.length>1?bandWidth+24:0);
 const width=Math.max(placement.width??(entry.producer?45:150),wall==='front'?minimum:45),depth=Math.max(placement.depth??(entry.producer?90:35),wall==='side'?minimum:35);
 const siblings=entries.filter(item=>item.service===entry.service&&item.producer===entry.producer),index=siblings.findIndex(item=>item.id===entry.id);
 let u=building.u+(entry.producer?building.width+45:index%2*(width+180)),v=building.v+(entry.producer?terminals.filter(terminal=>terminal.service===entry.service&&terminal.producer).reduce((total,terminal)=>total+terminal.depth+160,0):building.depth+100+Math.floor(index/2)*(depth+135));
 if(!entry.producer){const reserved=entries.filter(item=>item.service===entry.service&&!item.producer&&item.id!==entry.id&&config.layout.terminals[item.id]?.u!==undefined&&config.layout.terminals[item.id]?.v!==undefined).map(item=>{const placed=config.layout.terminals[item.id];return {u:placed.u!,v:placed.v!,width:Math.max(placed.width??150,(placed.wall??'front')==='front'?(item.instances+1)*34:45)};});const previous=[...terminals.filter(terminal=>terminal.service===entry.service&&!terminal.producer),...reserved];if(previous.length){let slot=0;do{u=building.u+(slot%2)*(width+180);v=building.v+building.depth+100+Math.floor(slot/2)*(depth+440);slot++;}while(previous.some(terminal=>u<terminal.u+terminal.width+30&&u+width+30>terminal.u&&Math.abs(v-terminal.v)<depth+90));}}
 if(placement.side){const offset=placement.offset??.5;if(placement.side==='east'){u=building.u+building.width+45;v=building.v+building.depth*offset-depth/2;}if(placement.side==='west'){u=building.u-width-45;v=building.v+building.depth*offset-depth/2;}if(placement.side==='south'){u=building.u+building.width*offset-width/2;v=building.v+building.depth+100;}if(placement.side==='north'){u=building.u+building.width*offset-width/2;v=building.v-depth-100;}}
 terminals.push({...entry,topicOffsets,u:placement.u??u,v:placement.v??v,width,depth,wall});
 }
 return {buildings,terminals};
}
function orthogonal(points:Point[]):Point[]{const result:Point[]=[];for(const point of points){const previous=result.at(-1);if(previous&&previous.u===point.u&&previous.v===point.v)continue;if(previous&&previous.u!==point.u&&previous.v!==point.v)result.push({u:point.u,v:previous.v});result.push({...point});}return result;}
export function routePoints(config:LayoutConfiguration,topic:string,producer:Terminal|undefined,receiver:Terminal,key:string,topicIndex:number,existingRoutes:DerivedRenderModel['cityRoutes']=[],sharedPaths?:Map<string,Point[]>):Point[]{
 const start=producer?bayPosition(producer,topic):{u:receiver.u-240,v:receiver.v+receiver.depth+160};
 const end=receiver.producer?{u:start.u+250,v:start.v+170}:bayPosition(receiver,topic);
 const override=config.layout.routes[key];
 const branch=config.layout.topics[topic]?.branches?.[receiver.id];
 const trunk=config.layout.topics[topic]?.waypoints;
 if(override){const points=override.waypoints.map(point=>({...point}));if(!override.branch){const old=points[0];points[0]=start;if(points.length>2&&points[1].v===old.v)points[1].v=start.v;}points[points.length-1]=end;if(producer?.wall==='side'&&points.length>2){const former=points[1].u,minimum=producer.u+producer.width+(config.topology.topics.find(item=>item.id===topic)!.partitionCount*11)+12;if(former<minimum)for(let index=1;index<points.length-1&&points[index].u===former;index++)points[index].u=minimum;}return orthogonal(points);}
 if(branch)return orthogonal([...branch,end]);
 const shared=producer?Object.entries(config.layout.routes).find(([id,route])=>id.startsWith(producer.id+'/')&&route.branch):undefined;
 if(shared&&!trunk){const points=shared[1].waypoints;return orthogonal([...points.slice(0,-2),{u:end.u,v:points[points.length-2].v},end]);}
 if(trunk)return orthogonal([start,...trunk,end]);
 const sharedPath=sharedPaths?.get(key);if(sharedPath)return sharedPath.map(point=>({...point}));
 return orthogonal(topicTrunkRoute(config,buildLayout(config).terminals,topic,producer,receiver,topicIndex,existingRoutes));
}
export function worldGeometry(config:LayoutConfiguration,buildings:DerivedRenderModel['cityBuildings'],terminals:Terminal[],routes:DerivedRenderModel['cityRoutes']){
 const groundPoints=[...Object.values(buildings).flatMap(building=>[{u:building.u-70,v:building.v-70},{u:building.u+building.width+90,v:building.v+building.depth+90}]),...terminals.flatMap(terminal=>[{u:terminal.u-90,v:terminal.v-70},{u:terminal.u+terminal.width+180,v:terminal.v+terminal.depth+180}]),...routes.flatMap(route=>route.points.flatMap(point=>[{u:point.u-route.lanes*11-30,v:point.v-route.lanes*11-30},{u:point.u+route.lanes*11+30,v:point.v+route.lanes*11+30}]))];
 if(!groundPoints.length)groundPoints.push({u:0,v:0},{u:320,v:320});
 const left=Math.min(...groundPoints.map(p=>p.u)),right=Math.max(...groundPoints.map(p=>p.u)),back=Math.min(...groundPoints.map(p=>p.v)),front=Math.max(...groundPoints.map(p=>p.v));
 const terrain=terrainOutline(groundPoints.flatMap(point=>[{u:point.u-45,v:point.v-45},{u:point.u+45,v:point.v+45}]));
 const projected=[...groundPoints,...terrain.map(([u,v])=>({u,v}))].map(p=>({x:p.u-p.v,y:(p.u+p.v)/2}));
 let x=Math.min(...projected.map(p=>p.x))-80,y=Math.min(...projected.map(p=>p.y))-260,maxX=Math.max(...projected.map(p=>p.x))+80,maxY=Math.max(...projected.map(p=>p.y))+60;
 if(config.layout.worldBounds){const bounds=config.layout.worldBounds;x=Math.min(x,bounds.x);y=Math.min(y,bounds.y);maxX=Math.max(maxX,bounds.x+bounds.width);maxY=Math.max(maxY,bounds.y+bounds.height);}
 const bounds={x,y,width:maxX-x,height:maxY-y};
 if(bounds.width>8000||bounds.height>8000||bounds.width*bounds.height>20000000)throw new Error('Layout exceeds the supported Canvas cache size. Move services/waypoints closer together.');
 return {terrain,bounds};
}
