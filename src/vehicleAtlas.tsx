import type {ReactNode} from 'react';
import {IsoArticulatedSprite,articulatedAngles} from './IsoArticulatedSprite';
import {topicTheme} from './topicTheme';
import type {Bounds,Sprite} from './canvasSprites';

export type VehicleSpriteKind='car'|'van'|'truck'|'tractor'|'trailer';
type Rasterize=(node:ReactNode,bounds:Bounds)=>Promise<Sprite>;
const sheets=new Map<string,Promise<Sprite[]>>();
const frameBounds={x:-45,y:-40,width:90,height:70};

export function vehicleAtlas(topic:string,kind:VehicleSpriteKind,rasterize:Rasterize){
 const paint=topicTheme[topic];
 const key=JSON.stringify([kind,paint.accent,paint.front,paint.side,articulatedAngles]);
 const existing=sheets.get(key);
 if(existing){sheets.delete(key);sheets.set(key,existing);return existing;}
 // One decode and one canvas for all orientations and waiting states.
 const pending=(async()=>{
  await new Promise<void>(resolve=>setTimeout(resolve,0));
  const sheet=await rasterize(<>{[false,true].flatMap((waiting,row)=>Array.from({length:articulatedAngles},(_,angle)=><g key={`${row}-${angle}`} transform={`translate(${angle*90+45} ${row*70+40})`}><IsoArticulatedSprite kind={kind} angle={angle} topic={topic} accent={paint.accent} waiting={waiting}/></g>))}</>,{x:0,y:0,width:90*articulatedAngles,height:140});
  return Array.from({length:articulatedAngles*2},(_,index)=>({...frameBounds,image:sheet.image,source:{x:index%articulatedAngles*90,y:Math.floor(index/articulatedAngles)*70,width:90,height:70}}));
 })();
 if(sheets.size>=32)sheets.delete(sheets.keys().next().value!);
 sheets.set(key,pending);
 pending.catch(()=>{if(sheets.get(key)===pending)sheets.delete(key);});
 return pending;
}
