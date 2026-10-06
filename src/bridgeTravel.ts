import type {Bridge} from './scenarioTypes';
import type {LanePath} from './laneGeometry';
import {bridgeAcross,bridgePosition,bridgeEnd,bridgeHeight} from './bridgeGeometry';

export type BridgeTravel={bridge:Bridge;entry:number;exit:number};
export function laneBridgeTravel(path:LanePath,bridges:Bridge[]):BridgeTravel[]{
 const spans:BridgeTravel[]=[];
 for(const bridge of bridges){
  let first=-1,last=-1,low=Infinity,high=-Infinity;
  const finish=()=>{
   if(first<0||low>bridge.start+.001||high<bridgeEnd(bridge)-.001)return;
   const from=path.points[first],to=path.points[last],start=bridgePosition(bridge,from),end=bridgePosition(bridge,to);
   const distanceAt=(along:number)=>path.distances[first]+(along-start)/(end-start)*(path.distances[last]-path.distances[first]);
   const a=distanceAt(bridge.start),b=distanceAt(bridgeEnd(bridge));spans.push({bridge,entry:Math.min(a,b),exit:Math.max(a,b)});
  };
  for(let index=1;index<path.points.length;index++){
   const from=path.points[index-1],to=path.points[index];
   const aligned=Math.abs(bridgeAcross(bridge,from)-bridgeAcross(bridge,to))<.001&&Math.abs(bridgeAcross(bridge,from))<=bridge.lanes*11+13;
   if(!aligned){finish();first=-1;last=-1;low=Infinity;high=-Infinity;continue;}
   if(first<0)first=index-1;last=index;low=Math.min(low,bridgePosition(bridge,from),bridgePosition(bridge,to));high=Math.max(high,bridgePosition(bridge,from),bridgePosition(bridge,to));
  }
  finish();
 }
 return spans;
}
export function bridgeTravelHeight(travel:BridgeTravel,position:{u:number;v:number}){return bridgeHeight(travel.bridge,bridgePosition(travel.bridge,position));}
