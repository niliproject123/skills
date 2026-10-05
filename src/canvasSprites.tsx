import {IsoYardTurn} from './IsoYardTurn';
import {IsoArticulatedSprite,articulatedAngles} from './IsoArticulatedSprite';
import {renderModel,scenarioRevision} from './scenarioRuntime';
import type {ReactNode} from 'react';
import {IsoBuilding} from './IsoBuilding';
import {IsoTree} from './IsoPrimitives';
import {CityTerrain,GardenProps,visibleDecorations} from './CityTerrain';
import {IsoRoad} from './IsoRoad';
import {cityBuildings,roadSegments} from './cityLayout';
import {services,topics,type Service} from './model';
import {project,vertices} from './isometric';
import {IsoTerminalConnection} from './IsoTerminalConnection';
import {IsoTerminal} from './IsoTerminal';
import {IsoOverpass} from './IsoOverpass';
import {ServiceYards} from './ServiceYards';
import {terminals,overpasses} from './terminalLayout';
import {IsoLamp,IsoShrub} from './IsoPrimitives';
export type Bounds={x:number;y:number;width:number;height:number};
export type Sprite=Bounds&{image:HTMLCanvasElement};
export type Scenery=Sprite&{depth:number;name?:Service;terminal?:string;bridge?:boolean};
export const mapBounds:Bounds=renderModel.worldBounds;
const quality=1;
export function context(canvas:HTMLCanvasElement){const drawing=canvas.getContext('2d');if(!drawing)throw new Error('Canvas 2D is unavailable');return drawing;}
async function raster(node:ReactNode,bounds:Bounds):Promise<Sprite>{
 const {renderToStaticMarkup}=await import('react-dom/server');
 const markup=renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={bounds.width*quality} height={bounds.height*quality} viewBox={`${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}`} style={{fontFamily:'system-ui,sans-serif'}}>{node}</svg>);
 const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width*quality);canvas.height=Math.ceil(bounds.height*quality);context(canvas).drawImage(image,0,0);return {...bounds,image:canvas};}finally{URL.revokeObjectURL(url);}
}
function Drives(){return <>{(Object.keys(cityBuildings) as Service[]).map(name=>{const building=cityBuildings[name];return <g key={name}>{Array.from({length:services[name].consumers},(_,index)=>{const u=building.u+(index+1)*building.width/(services[name].consumers+1),v=building.v+building.depth;return <polygon key={index} points={vertices([[u-15,v],[u+15,v],[u+15,v+35],[u-15,v+35]])} fill="#baa786" stroke="#f3d99f"/>;})}{Array.from({length:services[name].producers},(_,index)=>{const u=building.u+building.width,v=building.v+(index+1)*building.depth/(services[name].producers+1);return <polygon key={index} points={vertices([[u,v-14],[u+35,v-14],[u+35,v+14],[u,v+14]])} fill="#baa786" stroke="#f3d99f"/>;})}</g>;})}</>;}
export async function createSprites(){
 const revision=scenarioRevision,mapBounds={...renderModel.worldBounds};
 const terrain=await raster(<><CityTerrain/><ServiceYards/></>,mapBounds);
 const bridgeStructures=await raster(<>{overpasses.map(bridge=><IsoOverpass key={bridge.id} bridge={bridge} part="structure"/>)}</>,mapBounds);
 const roads=await Promise.all(Object.keys(topics).map(topic=>raster(<><IsoRoad label={topic} topic={topic} segments={roadSegments(topic)}/>{terminals.filter(terminal=>terminal.topics.includes(topic)).map(terminal=><g key={terminal.id}><IsoTerminalConnection terminal={terminal}/>{!terminal.producer&&<IsoYardTurn terminal={terminal}/>}</g>)}</>,mapBounds)));
 const scenery:Scenery[]=await Promise.all((Object.keys(cityBuildings) as Service[]).map(async name=>{const building=cityBuildings[name],point=project(building.u,building.v);const sprite=await raster(<IsoBuilding mainOnly name={name} layout={{...building,u:0,v:0}} onSelect={()=>{}}/>,{x:-building.depth-45,y:-270,width:building.width+building.depth+100,height:470});return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:building.u+building.v+building.width/2+building.depth,name};}));
 const terminalSprites=await Promise.all(terminals.map(async terminal=>{const point=project(terminal.u,terminal.v);const sprite=await raster(<IsoTerminal terminal={{...terminal,u:0,v:0}}/>,{x:-terminal.depth-105,y:-135,width:terminal.width+terminal.depth+160,height:(terminal.width+terminal.depth)/2+230});return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:terminal.u+terminal.v+terminal.width/2+terminal.depth,name:terminal.service,terminal:terminal.id};}));
 scenery.push(...terminalSprites);
 for(const bridge of overpasses){const half=bridge.lanes*11+35,end=bridge.start+bridge.ramp*2+bridge.deck;const corners=[project(bridge.u-half,bridge.start),project(bridge.u+half,end),project(bridge.u+half,bridge.start,bridge.height),project(bridge.u-half,end)];const x=Math.min(...corners.map(point=>point.x))-15,y=Math.min(...corners.map(point=>point.y))-15;scenery.push({...await raster(<IsoOverpass bridge={bridge} part="deck"/>,{x,y,width:Math.max(...corners.map(point=>point.x))-x+20,height:Math.max(...corners.map(point=>point.y))-y+20}),depth:bridge.depth,bridge:true});}
 const trees=await Promise.all(visibleDecorations().map(async tree=>{const point=project(tree.u,tree.v);const sprite=await raster(<IsoTree u={0} v={0} size={tree.size}/>,{x:-45,y:-110,width:90,height:140});return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:tree.u+tree.v+18};}));
 scenery.push(...trees);scenery.sort((a,b)=>a.depth-b.depth);
 const vehicles=new Map<string,Sprite>();
 await Promise.all(Object.keys(topics).flatMap(topic=>(['car','van','truck','tractor','trailer'] as const).flatMap(kind=>Array.from({length:articulatedAngles},(_,angle)=>[false,true].map(async waiting=>vehicles.set(`${topic}-${kind}-${angle}-${waiting}`,await raster(<IsoArticulatedSprite kind={kind} angle={angle} topic={topic} waiting={waiting}/>,{x:-45,y:-40,width:90,height:70})))).flat())));
 const props=await raster(<><IsoLamp u={430} v={435}/><IsoLamp u={670} v={625}/><IsoShrub u={390} v={210}/></>,mapBounds);
 const worlds=new Map<string,HTMLCanvasElement>();
 function worldForFocus(focus:string){
 const existing=worlds.get(focus);if(existing)return existing;
 const world=document.createElement('canvas');world.width=terrain.image.width;world.height=terrain.image.height;
 const drawing=context(world);drawing.setTransform(quality,0,0,quality,-mapBounds.x*quality,-mapBounds.y*quality);
 drawing.drawImage(terrain.image,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);
 drawing.drawImage(bridgeStructures.image,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);
 roads.forEach((road,index)=>{drawing.globalAlpha=focus==='all'||focus===Object.keys(topics)[index]?1:.23;drawing.drawImage(road.image,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);});
 for(const sprite of scenery){drawing.globalAlpha=!sprite.name||focus==='all'||[...services[sprite.name].produces,...services[sprite.name].consumes].includes(focus as 'orders'|'payments')?1:.3;drawing.drawImage(sprite.image,sprite.x,sprite.y,sprite.width,sprite.height);}
 drawing.globalAlpha=1;drawing.drawImage(props.image,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);if(worlds.size>=3){const oldest=[...worlds.keys()].find(key=>key!=='all');if(oldest!==undefined)worlds.delete(oldest);}worlds.set(focus,world);return world;
 }
 if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing sprites; the previous render was cancelled.');
 worldForFocus('all');
 return {worlds,worldForFocus,scenery,vehicles};
}
export type SpriteCache=Awaited<ReturnType<typeof createSprites>>;
let loadedSprites:Promise<SpriteCache>|undefined,loadedRevision=-1;
export function loadSpriteCache(){if(!loadedSprites||loadedRevision!==scenarioRevision){loadedRevision=scenarioRevision;loadedSprites=createSprites();const pending=loadedSprites;pending.catch(()=>{if(loadedSprites===pending)loadedSprites=undefined;});}return loadedSprites;}

export function invalidateSpriteCache(){loadedSprites=undefined;}
