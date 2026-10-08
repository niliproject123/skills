import {bridgeSpriteTiles,bridgeTilePixels,bridgeTilePadding} from './bridgeSpriteTiles';
import {createWorldTiles,tilePadding,tilePixels,overlaps} from './worldTiles';
import {createTileDrawing} from './tileDrawing';
import {estimateSceneAssetBytes,sceneAssetBudgetBytes} from './sceneAssetBudget';
import {articulatedAngles} from './IsoArticulatedSprite';
import {vehicleAtlas,type VehicleSpriteKind} from './vehicleAtlas';
import {renderModel,scenarioRevision,currentScenario} from './scenarioRuntime';
import {Children,Fragment,isValidElement,type ReactNode} from 'react';
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
async function raster(node:ReactNode,bounds:Bounds,resolution=quality):Promise<Sprite>{
 const {renderToStaticMarkup}=await markupRenderer;
 const parts=isValidElement<{children?:ReactNode}>(node)&&node.type===Fragment?Children.toArray(node.props.children):Children.toArray(node);
 const markup:string[]=[];
 // Yield between artwork objects so controls can respond during a cold load.
 for(let index=0;index<parts.length;index+=4){await new Promise<void>(resolve=>setTimeout(resolve,0));markup.push(renderToStaticMarkup(<>{parts.slice(index,index+4)}</>));}
 return rasterMarkup(markup.join(''),bounds,resolution);
}
async function rasterMarkup(body:string,bounds:Bounds,resolution=quality):Promise<Sprite>{
 const markup=`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bounds.width*resolution)}" height="${Math.ceil(bounds.height*resolution)}" viewBox="${bounds.x} ${bounds.y} ${bounds.width} ${bounds.height}" style="font-family:system-ui,sans-serif">${body}</svg>`;
 const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'}));
 try{const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width*resolution);canvas.height=Math.ceil(bounds.height*resolution);context(canvas).drawImage(image,0,0);return {...bounds,image:canvas};}finally{URL.revokeObjectURL(url);}
}
export async function createSprites(){
 let activeDrawing:Awaited<ReturnType<typeof createTileDrawing>>|undefined;
 try{
 let revision=scenarioRevision;const mapBounds={...renderModel.worldBounds};
 if(estimateSceneAssetBytes()>sceneAssetBudgetBytes)throw new Error('Building and vehicle sprites exceed the 160 MiB asset budget. Reduce bay counts or vehicle palette variety.');
 const {renderToStaticMarkup}=await markupRenderer;
 const terrainMarkup=renderToStaticMarkup(<><CityTerrain/><ServiceYards/>{overpasses.map(bridge=><IsoOverpass key={bridge.id} bridge={bridge} part="structure"/>)}</>);
 const roads:Record<string,string>={};
 for(const topic of Object.keys(topics)){
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing road artwork.');
  roads[topic]=renderToStaticMarkup(<><IsoRoad label={topic} topic={topic} segments={roadSegments(topic)}/>{terminals.filter(terminal=>terminal.topics.includes(topic)).map(terminal=><IsoTerminalConnection key={terminal.id} terminal={terminal} topic={topic}/>)}</>);
 }
 const scenery:Scenery[]=[];
 for(const name of Object.keys(cityBuildings) as Service[]){const building=cityBuildings[name],point=project(building.u,building.v);const sprite=await raster(<IsoBuilding mainOnly name={name} layout={{...building,u:0,v:0}} onSelect={()=>{}}/>,{x:-building.depth-45,y:-270,width:building.width+building.depth+100,height:470});scenery.push({...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:building.u+building.v+building.width/2+building.depth,name});}
 for(const terminal of terminals){const point=project(terminal.u,terminal.v);const sprite=await raster(<IsoTerminal terminal={{...terminal,u:0,v:0}}/>,{x:-terminal.depth-105,y:-135,width:terminal.width+terminal.depth+160,height:(terminal.width+terminal.depth)/2+230});scenery.push({...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:terminal.u+terminal.v+terminal.width/2+terminal.depth,name:terminal.service,terminal:terminal.id});}
 const tileDrawing=await createTileDrawing(terrainMarkup,roads);activeDrawing=tileDrawing;
 for(const bridge of overpasses){
  if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing bridge artwork.');
  const artworkKey=`bridge-${bridge.id}`;tileDrawing.registerArtwork(artworkKey,renderToStaticMarkup(<IsoOverpass bridge={bridge} part="deck"/>));
  for(const bounds of bridgeSpriteTiles(bridge)){
   const padded={x:bounds.x-bridgeTilePadding,y:bounds.y-bridgeTilePadding,width:bounds.width+bridgeTilePadding*2,height:bounds.height+bridgeTilePadding*2};
   const sprite=await tileDrawing.render(padded,1,'all',artworkKey);
   scenery.push({...sprite,...bounds,source:{x:bridgeTilePadding,y:bridgeTilePadding,width:bridgeTilePixels,height:bridgeTilePixels},depth:bridge.depth,bridge:true});
  }
 }
 const trees=await Promise.all(visibleDecorations().map(async tree=>{const point=project(tree.u,tree.v);let pending=treeSprites.get(tree.size);if(!pending){pending=raster(<IsoTree u={0} v={0} size={tree.size}/>,{x:-45,y:-110,width:90,height:140});if(treeSprites.size>=32)treeSprites.delete(treeSprites.keys().next().value!);treeSprites.set(tree.size,pending);const requested=pending;pending.catch(()=>{if(treeSprites.get(tree.size)===requested)treeSprites.delete(tree.size);});}const sprite=await pending;return {...sprite,x:sprite.x+point.x,y:sprite.y+point.y,depth:tree.u+tree.v+18};}));
 scenery.push(...trees);scenery.sort((a,b)=>a.depth-b.depth);
 const vehicles=new Map<string,Sprite>();
 for(const topic of Object.keys(topics)){
  const kinds=new Set<VehicleSpriteKind>();
  for(const route of renderModel.cityRoutes.filter(route=>route.topic===topic&&route.moving+route.queue>0))for(const load of renderModel.partitionLoads[topic]){
   if(load.kind==='semi'){kinds.add('tractor');if(load.trailers>0)kinds.add('trailer');}else kinds.add(load.kind);
  }
  for(const kind of kinds){const frames=await vehicleAtlas(topic,kind,rasterMarkup);for(const waiting of [false,true])for(let angle=0;angle<articulatedAngles;angle++)vehicles.set(`${topic}-${kind}-${angle}-${waiting}`,frames[Number(waiting)*articulatedAngles+angle]);}
 }
 const props=await raster(<><IsoLamp u={430} v={435}/><IsoLamp u={670} v={625}/><IsoShrub u={390} v={210}/></>,{x:-90,y:170,width:330,height:550});
 const assetImages=new Set([...scenery,...vehicles.values(),props].map(sprite=>sprite.image));
 const assetBytes=[...assetImages].reduce((bytes,image)=>bytes+image.width*image.height*4,0);
 if(assetBytes>sceneAssetBudgetBytes)throw new Error('Building and vehicle sprites exceed the 160 MiB asset budget. Reduce bay counts or vehicle palette variety.');
 const tiles=createWorldTiles(mapBounds,async tile=>{
  if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing map tiles.');
  const padding=tilePadding/tile.resolution;
  const bounds={x:tile.x-padding,y:tile.y-padding,width:(tilePixels+tilePadding*2)/tile.resolution,height:(tilePixels+tilePadding*2)/tile.resolution};
  const sprite=await tileDrawing.render(bounds,tile.resolution,tile.focus),drawing=context(sprite.image);
  drawing.setTransform(tile.resolution,0,0,tile.resolution,-bounds.x*tile.resolution,-bounds.y*tile.resolution);
  for(const item of scenery)if(overlaps(item,bounds)){drawing.globalAlpha=!item.name||tile.focus==='all'||[...services[item.name].produces,...services[item.name].consumes].includes(tile.focus)?1:.3;const source=item.source;if(source)drawing.drawImage(item.image,source.x,source.y,source.width,source.height,item.x,item.y,item.width,item.height);else drawing.drawImage(item.image,item.x,item.y,item.width,item.height);}
  drawing.globalAlpha=1;if(overlaps(props,bounds))drawing.drawImage(props.image,props.x,props.y,props.width,props.height);
  return sprite;
 });
 if(revision!==scenarioRevision)throw new Error('Scenario changed while preparing sprites; the previous render was cancelled.');
 return {tiles,scenery,vehicles,assetBytes,reuse(){revision=scenarioRevision;},dispose(){tiles.dispose();tileDrawing.dispose();}};
 }catch(reason){activeDrawing?.dispose();throw reason;}
}
export type SpriteCache=Awaited<ReturnType<typeof createSprites>>;
let loadedSprites:Promise<SpriteCache>|undefined,loadedRevision=-1,loadedConfiguration='',completedSprites:SpriteCache|undefined;
export function loadSpriteCache(){if(!loadedSprites||loadedRevision!==scenarioRevision){loadedRevision=scenarioRevision;loadedConfiguration=JSON.stringify(currentScenario);loadedSprites=createSprites();const pending=loadedSprites;void pending.then(cache=>{if(loadedSprites===pending)completedSprites=cache;},()=>{if(loadedSprites===pending){loadedSprites=undefined;completedSprites=undefined;}});}return loadedSprites;}

export function invalidateSpriteCache(){if(completedSprites&&loadedConfiguration===JSON.stringify(currentScenario)){loadedRevision=scenarioRevision;completedSprites.reuse();return;}const previous=loadedSprites;loadedSprites=undefined;completedSprites=undefined;if(previous)void previous.then(cache=>cache.dispose(),()=>{});}
