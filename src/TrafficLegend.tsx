import {VehiclePreview} from './VehiclePreview';
import type {VisualEncodingConfig,VehicleClass} from './scenarioTypes';

export function TrafficLegend({visual}:{visual:VisualEncodingConfig}){
 const thresholds=visual.thresholds,number=(value:number)=>value.toLocaleString();
 const entries:{kind:VehicleClass;label:string;range:string;trailers?:number}[]=[
  {kind:'car',label:'Car',range:`0–${number(thresholds.car)}`},
  {kind:'van',label:'Van',range:`>${number(thresholds.car)}–${number(thresholds.van)}`},
  {kind:'truck',label:'Truck',range:`>${number(thresholds.van)}–${number(thresholds.truck)}`},
  {kind:'semi',label:'Semi',range:visual.maxTrailers>1?`>${number(thresholds.truck)}–${number(thresholds.semi)}`:`>${number(thresholds.truck)}`,trailers:1}
 ];
 if(visual.maxTrailers>1)entries.push({kind:'semi',label:'Multi-trailer',range:`>${number(thresholds.semi)}`,trailers:Math.min(3,visual.maxTrailers)});
 return <section className="traffic-legend" aria-label="Vehicle message ranges"><strong>Traffic <small>messages/s per partition</small></strong><div className="traffic-legend-items">{entries.map(entry=><div className="traffic-legend-item" key={entry.label} title={`${entry.label}: ${entry.range} messages per second per partition`}><VehiclePreview compact kind={entry.kind} trailers={entry.trailers} accent="#d78559"/><span>{entry.label}<small>{entry.range}</small></span></div>)}</div><span className="queue-key">Amber roof marker: waiting</span></section>;
}
