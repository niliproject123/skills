import {renderToStaticMarkup} from 'react-dom/server';
import {IsoArticulatedSprite,articulatedAngles} from './IsoArticulatedSprite';
import type {VehicleSpriteKind} from './vehicleAtlas';

self.onmessage=({data}:{data:{id:number;kind:VehicleSpriteKind;accent:string}})=>{
 try{
  const {id,kind,accent}=data;
  const markup=renderToStaticMarkup(<>{[false,true].flatMap((waiting,row)=>Array.from({length:articulatedAngles},(_,angle)=><g key={`${row}-${angle}`} transform={`translate(${angle*90+45} ${row*70+40})`}><IsoArticulatedSprite kind={kind} angle={angle} topic="atlas" accent={accent} waiting={waiting}/></g>))}</>);
  self.postMessage({id,markup});
 }catch(reason){self.postMessage({id:data.id,error:reason instanceof Error?reason.message:String(reason)});}
};
