import {renderModel} from './scenarioRuntime';
import {bridgeSpriteTiles,bridgeTilePixels,bridgeTilePadding} from './bridgeSpriteTiles';
import {visibleDecorations} from './CityTerrain';
import {articulatedAngles} from './IsoArticulatedSprite';

export const sceneAssetBudgetBytes=160*1024*1024;
export function estimateSceneAssetBytes(){
 const pixels=(width:number,height:number)=>Math.ceil(width)*Math.ceil(height);
 let area=330*550;
 for(const building of Object.values(renderModel.cityBuildings))area+=pixels(building.width+building.depth+100,470);
 for(const terminal of renderModel.terminals)area+=pixels(terminal.width+terminal.depth+160,(terminal.width+terminal.depth)/2+230);
 for(const bridge of renderModel.overpasses)area+=bridgeSpriteTiles(bridge).length*(bridgeTilePixels+bridgeTilePadding*2)**2;
 area+=new Set(visibleDecorations().map(tree=>tree.size)).size*90*140;
 const vehicles=new Set<string>();
 for(const route of renderModel.cityRoutes)if(route.moving+route.queue>0)for(const load of renderModel.partitionLoads[route.topic]){const color=renderModel.themes[route.topic].accent;if(load.kind==='semi'){vehicles.add(`tractor/${color}`);if(load.trailers)vehicles.add(`trailer/${color}`);}else vehicles.add(`${load.kind}/${color}`);}
 area+=vehicles.size*90*articulatedAngles*140;
 return area*4;
}
