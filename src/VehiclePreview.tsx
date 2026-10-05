import {type VehicleKind} from './IsoVehicle';
import {IsoArticulatedSprite} from './IsoArticulatedSprite';
import {project} from './isometric';
export function VehiclePreview({kind,trailers=1,accent='#d78559'}:{kind:VehicleKind;trailers?:number;accent?:string}){
 const length=kind==='semi'?38+Math.max(1,trailers)*46:70,left=kind==='semi'?length-30:40;
 return <svg className="vehicle-preview" viewBox={`${-left} ${-left/2-45} ${length+35} ${length/2+75}`} role="img" aria-label={`${kind}${kind==='semi'?` with ${trailers} trailers`:''} preview`}>
 {kind==='semi'?<>{Array.from({length:Math.max(1,trailers)},(_,index)=>{const point=project(-38-index*46,0);return <g key={index} transform={`translate(${point.x},${point.y})`}><path d="M20 6 L30 11" stroke="#596b62" strokeWidth="3"/><IsoArticulatedSprite kind="trailer" topic="preview" accent={accent} angle={0} waiting={false}/></g>;})}<IsoArticulatedSprite kind="tractor" topic="preview" accent={accent} angle={0} waiting={false}/></>:<IsoArticulatedSprite kind={kind} angle={0} waiting={false} topic="preview" accent={accent}/>}
 </svg>;
}
export function VehicleGallery({maxTrailers,accent}:{maxTrailers:number;accent:string}){return <div className="vehicle-gallery">{(['car','van','truck'] as const).map(kind=><div key={kind}><VehiclePreview kind={kind} accent={accent}/><small>{kind==='truck'?'Box truck':kind}</small></div>)}{[1,2,3,Math.max(1,Math.min(8,maxTrailers))].map((trailers,index)=><div key={index}><VehiclePreview kind="semi" trailers={trailers} accent={accent}/><small>{index===3?'Configured maximum':trailers===1?'Semi':`Semi + ${trailers-1} extra`}</small></div>)}</div>;}
