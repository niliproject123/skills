import {bridgePoint} from './bridgeGeometry';
import {roadCacheBounds} from './roadCacheBounds';
import {articulatedAngles} from './IsoArticulatedSprite';
import {vehicleAtlas,type VehicleSpriteKind} from './vehicleAtlas';
import {renderModel,scenarioRevision} from './scenarioRuntime';
import type {ReactNode} from 'react';
import {IsoBuilding} from './IsoBuilding';
import {IsoTree} from './IsoPrimitives';
import {CityTerrain,visibleDecorations} from './CityTerrain';
import {IsoRoad} from './IsoRoad';
import {cityBuildings,roadSegments} from './cityLayout';
import {services,topics,type Service} from './model';
import {project} from './isometric';
import {IsoTerminalConnection} from './IsoTerminalConnection';
import {IsoTerminal} from './IsoTerminal';
import {IsoOverpass} from './IsoOverpass';
import {ServiceYards} from './ServiceYards';
import {terminals,overpasses} from './terminalLayout';
import {IsoLamp,IsoShrub} from './IsoPrimitives';
export type Bounds={x:number;y:number;width:number;height:number};
export type Sprite=Bounds&{image:HTMLCanvasElement;source?:Bounds};
export type Scenery=Sprite&{depth:number;name?:Service;terminal?:string;bridge?:boolean};
export const mapBounds:Bounds=renderModel.worldBounds;
const quality=1;
const treeSprites=new Map<number,Promise<Sprite>>();
const markupRenderer=import('react-dom/server');
export function context(canvas:HTMLCanvasElement){const drawing=canvas.getContext('2d');if(!drawing)throw new Error('Canvas 2D is unavailable');return drawing;}
async function raster(node:ReactNode,bounds:Bounds):Promise<Sprite>{
 const {renderToStaticMarkup}=await markupRenderer;
 const markup=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={bounds.width*quality} height={bounds.height*quality} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{fontFamily:'system-ui,sans-serif'}}>{node}</svg>);
 const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width*quality);canvas.height=Math.ceil(bounds.height*quality);context(canvas).drawImage(image,0,0);return {...bounds,image:canvas};}finally{URL.revokeObjectURL(url);}
}
export async function createSprites(){
 const revision=scenarioRevision,mapBounds={...renderModel.worldBounds};
 const terrain=await raster(<><CityTerrain/><ServiceYards/></>,mapBounds);
 const bridgeStructures:Sprite[]=[];
 for(const bridge of overpasses){const half=bridge.lanes*11+40,end=bridge.start+bridge.ramp*2+bridge.deck,corners=[bridge.start,end].flatMap(along=>[-half,half].flatMap(across=>[0,bridge.height].map(height=>{const point=bridgePoint(bridge,along,across);return project(point.u,point.v,height);}))),x=Math.min(...corners.map(point=>point.x))-20,y=Math.min(...corners.map(point=>point.y))-20;bridgeStructures.push(await raster(<IsoOverpass bridge={bridge} part="structure"/>,{x,y,width:Math.max(...corners.map(point=>point.x))-x+40,height:Math.max(...corners.map(point=>point.y))-y+40}));}
 const roads:Sprite[]=[];
 for(const topic of Object.keys(topics))roads.push(await raster(<><IsoRoad label={topic} topic={topic} segments={roadSegments(topic)}/>{terminals.filter(terminal=>terminal.topics.includes(topic)).map(terminal=><IsoTerminalConnection key={terminal.id} terminal={terminal} topic={topic}/>)}</>,roadCacheBounds(topic,renderModel.cityRoutes,terminals)));
 const scenery:Scenery[]=await Promise.all((Object.keys(cityBuildings) as Service[]).map(async name=>{const building=cityBuildings[name],point=project(building.u,building.v);const sprite=await raster(<IsoBuilding mainOnly name={name} layout={{...building,u:0,v:0}} onSelect={()=>{}}/>,{x:-building.depth-45,y:-270,width:building.width+building.depth+100,height:470});return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:building.u+building.v+building.width/2+building.depth,name};}));
 const terminalSprites=await Promise.all(terminals.map(async terminal=>{const point=project(terminal.u,terminal.v);const sprite=await raster(<IsoTerminal terminal={{...terminal,u:0,v:0}}/>,{x:-terminal.depth-105,y:-135,width:terminal.width+terminal.depth+160,height:(terminal.width+terminal.depth)/2+230});return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:terminal.u+terminal.v+terminal.width/2+terminal.depth,name:terminal.service,terminal:terminal.id};}));
 scenery.push(...terminalSprites);
 for(const bridge of overpasses){const half=bridge.lanes*11+35,end=bridge.start+bridge.ramp*2+bridge.deck;const corners=[bridge.start,end].flatMap(along=>[-half,half].flatMap(across=>[0,bridge.height].map(height=>{const point=bridgePoint(bridge,along,across);return project(point.u,point.v,height);})));const x=Math.min(...corners.map(point=>point.x))-15,y=Math.min(...corners.map(point=>point.y))-15;scenery.push({...await raster(<IsoOverpass bridge={bridge} part="deck"/>,{x,y,width:Math.max(...corners.map(point=>point.x))-x+20,height:Math.max(...corners.map(point=>point.y))-y+20}),depth:bridge.depth,bridge:true});}
 const trees=await Promise.all(visibleDecorations().map(async tree=>{const point=project(tree.u,tree.v);let pending=treeSprites.get(tree.size);if(!pending){pending=raster(<IsoTree u={0} v={0} size={tree.size}/>,{x:-45,y:-110,width:90,height:140});if(treeSprites.size>=32)treeSprites.delete(treeSprites.keys().next().value!);treeSprites.set(tree.size,pending);const requested=pending;pending.catch(()=>{if(treeSprites.get(tree.size)===requested)treeSprites.delete(tree.size);});}const sprite=await pending;return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:tree.u+tree.v+18};}));
 scenery.push(...trees);scenery.sort((a,b)=>a.depth-b.depth);
 const vehicles=new Map<string,Sprite>();
 for(const topic of Object.keys(topics)){
  const kinds=new Set<VehicleSpriteKind>();
  for(const route of renderModel.cityRoutes.filter(route=>route.topic===topic&&route.moving+route.queue>0))for(const load of renderModel.partitionLoads[topic]){
   if(load.kind==='semi'){kinds.add('tractor');if(load.trailers>0)kinds.add('trailer');}else kinds.add(load.kind);
  }
  for(const kind of kinds){const frames=await vehicleAtlas(topic,kind,raster);for(const waiting of [false,true])for(let angle=0;angle<articulatedAngles;angle++)vehicles.set(`${topic}-${kind}-${angle}-${waiting}`,frames[Number(waiting)*articulatedAngles+angle]);}
 }
 const props=await raster(<><IsoLamp u={430} v={435}/><IsoLamp u={670} v={625}/><IsoShrub u={390} v={210}/></>,{x:-90,y:170,width:330,height:550});
 const worlds=new Map<string,HTMLCanvasElement>();
 function worldForFocus(focus:string){
 const existing=worlds.get(focus);if(existing)return existing;
 const world=document.createElement('canvas');world.width=terrain.image.width;world.height=terrain.image.height;
 const drawing=context(world);drawing.setTransform(quality,0,0,quality,-mapBounds.x*quality,-mapBounds.y*quality);
 drawing.drawImage(terrain.image,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);
 for(const structure of bridgeStructures)drawing.drawImage(structure.image,structure.x,structure.y,structure.width,structure.height);
 roads.forEach((road,index)=>{drawing.globalAlpha=focus==='all'||focus===Object.keys(topics)[index]?1:.23;drawing.drawImage(road.image,road.x,road.y,road.width,road.height);});
 for(const sprite of scenery){drawing.globalAlpha=!sprite.name||focus==='all'||[...services[sprite.name].produces,...services[sprite.name].consumes].includes(focus as 'orders'|'payments')?1:.3;drawing.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height);}
 drawing.globalAlpha=1;drawing.drawImage(props.image,props.x,props.y,props.width,props.height);if(worlds.size>=2){const oldest=[...worlds.keys()].find(key=>key!=='all');if(oldest!==undefined)worlds.delete(oldest);}worlds.set(focus,world);return world;
 }
 if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing sprites; the previous render was cancelled.');
 worldForFocus('all');
 return {worlds,worldForFocus,scenery,vehicles};
}
export type SpriteCache=Awaited<ReturnType<typeof createSprites>>;
let loadedSprites:Promise<SpriteCache>|undefined,loadedRevision=-1;
export function loadSpriteCache(){if(!loadedSprites||loadedRevision!==scenarioRevision){loadedRevision=scenarioRevision;loadedSprites=createSprites();const pending=loadedSprites;pending.catch(()=>{if(loadedSprites===pending)loadedSprites=undefined;});}return loadedSprites;}

export function invalidateSpriteCache(){loadedSprites=undefined;}
