import {bridgeAxis,bridgeAcross,bridgePosition,bridgeEnd} from './bridgeGeometry';
import type {Bridge,LayoutConfiguration,Route} from './scenarioTypes';
export function planBridges(config:LayoutConfiguration,routes:Route[]):Omit<Bridge,'depth'|'lanes'>[]{
 const bridges=config.layout.overpasses.map(bridge=>({...bridge}));
 const segments=()=>routes.flatMap(route=>route.points.slice(1).map((to,index)=>({route,index,from:route.points[index],to})));
 const handled=new Set<string>();
 for(const axis of ['v','u'] as const)for(const segment of segments()){
  if(axis==='v'?segment.from.u!==segment.to.u:segment.from.v!==segment.to.v)continue;
  const along=(point:{u:number;v:number})=>axis==='v'?point.v:point.u,across=(point:{u:number;v:number})=>axis==='v'?point.u:point.v;
  const fixed=across(segment.from),key=`${segment.route.topic}/${axis}/${fixed}/${Math.min(along(segment.from),along(segment.to))}/${Math.max(along(segment.from),along(segment.to))}`;
  if(handled.has(key))continue;handled.add(key);
  // Every lower-road pass on this straight run contributes to the one elevated span.
  const crossings=segments().filter(other=>other.route.topic!==segment.route.topic&&along(other.from)===along(other.to)&&fixed>Math.min(across(other.from),across(other.to))&&fixed<Math.max(across(other.from),across(other.to))&&along(other.from)>Math.min(along(segment.from),along(segment.to))&&along(other.from)<Math.max(along(segment.from),along(segment.to))).filter(other=>{const point=axis==='v'?{u:fixed,v:along(other.from)}:{u:along(other.from),v:fixed};return !bridges.some(bridge=>bridge.topic===other.route.topic&&Math.abs(bridgeAcross(bridge,point))<other.route.lanes*11+12&&bridgePosition(bridge,point)>bridge.start&&bridgePosition(bridge,point)<bridgeEnd(bridge));});
  if(!crossings.length)continue;
  const deckStart=Math.min(...crossings.map(other=>along(other.from)-other.route.lanes*11-22)),deckEnd=Math.max(...crossings.map(other=>along(other.from)+other.route.lanes*11+22));
  const ramp=64,landing=96;
  // Bridges consume the completed route. Never move its corners after routing:
  // those points can be shared by other branches and bound the dock approach.
  const low=Math.min(along(segment.from),along(segment.to)),high=Math.max(along(segment.from),along(segment.to)),available=Math.min(deckStart-low,high-deckEnd)-12;
  if(available<20)continue;
  const fittedRamp=Math.min(ramp,available),start=deckStart-fittedRamp,deck=deckEnd-deckStart,center=(deckStart+deckEnd)/2;
  const nearby=bridges.find(bridge=>bridge.topic===segment.route.topic&&bridgeAxis(bridge)===axis&&Math.abs((axis==='v'?bridge.u:bridge.v)-fixed)<1&&start<=bridge.start+bridge.ramp*2+bridge.deck+landing&&deckEnd+fittedRamp>=bridge.start-landing);
  if(nearby){const first=Math.min(nearby.start+nearby.ramp,deckStart),last=Math.max(nearby.start+nearby.ramp+nearby.deck,deckEnd);nearby.ramp=Math.max(nearby.ramp,fittedRamp);nearby.start=first-nearby.ramp;nearby.deck=last-first;if(axis==='v')nearby.v=(first+last)/2;else nearby.u=(first+last)/2;continue;}
  bridges.push({id:`auto-bridge-${bridges.length+1}`,routeId:segment.route.id,topic:segment.route.topic,axis,u:axis==='v'?fixed:center,v:axis==='v'?center:fixed,start,ramp:fittedRamp,deck,height:64});
 }
 return bridges;
}
