import {bridgePoint,bridgeHeight,bridgeEnd} from './bridgeGeometry';
import {project} from './isometric';
import type {Bridge} from './scenarioTypes';
import type {Bounds} from './canvasSprites';

export const bridgeTilePixels=128,bridgeTilePadding=2;
// Cover only cells touched by the deck ribbon. Global cell ownership prevents
// opacity seams, while padded source pixels preserve antialiasing at boundaries.
export function bridgeSpriteTiles(bridge:Bridge):Bounds[]{
 const tiles=new Map<string,Bounds>(),half=bridge.lanes*11+3;
 const levels=[bridge.start,bridge.start+bridge.ramp,bridge.start+bridge.ramp+bridge.deck,bridgeEnd(bridge)];
 for(let level=1;level<levels.length;level++)for(let start=levels[level-1];start<levels[level];start+=64){
  const end=Math.min(start+64,levels[level]);
  const corners=[start,end].flatMap(along=>[-half,half].flatMap(across=>[-10,8].map(rise=>{const point=bridgePoint(bridge,along,across);return project(point.u,point.v,bridgeHeight(bridge,along)+rise);})));
  const left=Math.min(...corners.map(point=>point.x))-2,right=Math.max(...corners.map(point=>point.x))+2,top=Math.min(...corners.map(point=>point.y))-2,bottom=Math.max(...corners.map(point=>point.y))+2;
  for(let row=Math.floor(top/bridgeTilePixels);row<Math.ceil(bottom/bridgeTilePixels);row++)for(let column=Math.floor(left/bridgeTilePixels);column<Math.ceil(right/bridgeTilePixels);column++)tiles.set(`${column}/${row}`,{x:column*bridgeTilePixels,y:row*bridgeTilePixels,width:bridgeTilePixels,height:bridgeTilePixels});
 }
 return [...tiles.values()];
}
