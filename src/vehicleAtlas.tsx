import {articulatedAngles} from './IsoArticulatedSprite';
import {vehicleSpriteMarkup} from './vehicleSpriteDrawing';
import {topicTheme} from './topicTheme';
import type {Bounds,Sprite} from './canvasSprites';

export type VehicleSpriteKind='car'|'van'|'truck'|'tractor'|'trailer';
type Rasterize=(markup:string,bounds:Bounds)=>Promise<Sprite>;
const sheets=new Map<string,Promise<Sprite[]>>();
const frameBounds={x:-45,y:-40,width:90,height:70};

export function vehicleAtlas(topic:string,kind:VehicleSpriteKind,rasterize:Rasterize){
 const paint=topicTheme[topic];
 const key=JSON.stringify([kind,paint.accent,paint.front,paint.side,articulatedAngles]);
 const existing=sheets.get(key);
 if(existing){sheets.delete(key);sheets.set(key,existing);return existing;}
 // One decode and one canvas for all orientations and waiting states.
 const pending=(async()=>{
  const markup=await vehicleSpriteMarkup(kind,paint.accent);
  const sheet=await rasterize(markup,{x:0,y:0,width:90*articulatedAngles,height:140});
  return Array.from({length:articulatedAngles*2},(_,index)=>({...frameBounds,image:sheet.image,source:{x:index%articulatedAngles*90,y:Math.floor(index/articulatedAngles)*70,width:90,height:70}}));
 })();
 if(sheets.size>=32)sheets.delete(sheets.keys().next().value!);
 sheets.set(key,pending);
 pending.catch(()=>{if(sheets.get(key)===pending)sheets.delete(key);});
 return pending;
}
