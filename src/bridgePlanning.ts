import type {Bridge,LayoutConfiguration,Route} from './scenarioTypes';
export function planBridges(config:LayoutConfiguration,routes:Route[]):Omit<Bridge,'depth'|'lanes'>[]{
 const bridges=config.layout.overpasses.map(bridge=>({...bridge}));
 const segments=()=>routes.flatMap(route=>route.points.slice(1).map((to,index)=>({route,index,from:route.points[index],to})));
 const handled=new Set<string>();
 for(const segment of segments()){
  if(segment.from.u!==segment.to.u)continue;
  const u=segment.from.u,key=`${segment.route.topic}/${u}/${Math.min(segment.from.v,segment.to.v)}/${Math.max(segment.from.v,segment.to.v)}`;
  if(handled.has(key))continue;handled.add(key);
  // Every lower-road pass on this straight run contributes to the one elevated span.
  const crossings=segments().filter(other=>other.route.topic!==segment.route.topic&&other.from.v===other.to.v&&u>Math.min(other.from.u,other.to.u)&&u<Math.max(other.from.u,other.to.u)&&other.from.v>Math.min(segment.from.v,segment.to.v)&&other.from.v<Math.max(segment.from.v,segment.to.v));
  if(!crossings.length)continue;
  const deckStart=Math.min(...crossings.map(other=>other.from.v-other.route.lanes*11-22)),deckEnd=Math.max(...crossings.map(other=>other.from.v+other.route.lanes*11+22));
  const ramp=64,landing=96;
  // Bridges consume the completed route. Never move its corners after routing:
  // those points can be shared by other branches and bound the dock approach.
  const low=Math.min(segment.from.v,segment.to.v),high=Math.max(segment.from.v,segment.to.v),available=Math.min(deckStart-low,high-deckEnd)-12;
  if(available<20)continue;
  const fittedRamp=Math.min(ramp,available),start=deckStart-fittedRamp,deck=deckEnd-deckStart,v=(deckStart+deckEnd)/2;
  const nearby=bridges.find(bridge=>bridge.topic===segment.route.topic&&Math.abs(bridge.u-u)<1&&start<=bridge.start+bridge.ramp*2+bridge.deck+landing&&deckEnd+fittedRamp>=bridge.start-landing);
  if(nearby){const first=Math.min(nearby.start+nearby.ramp,deckStart),last=Math.max(nearby.start+nearby.ramp+nearby.deck,deckEnd);nearby.ramp=Math.max(nearby.ramp,fittedRamp);nearby.start=first-nearby.ramp;nearby.deck=last-first;nearby.v=(first+last)/2;continue;}
  if(bridges.some(bridge=>bridge.topic!==segment.route.topic&&Math.abs(bridge.u-u)<segment.route.lanes*22+24&&Math.abs(bridge.v-v)<bridge.deck/2+bridge.ramp+(deck/2)+fittedRamp))continue;
  bridges.push({id:`auto-bridge-${bridges.length+1}`,routeId:segment.route.id,topic:segment.route.topic,u,v,start,ramp:fittedRamp,deck,height:64});
 }
 return bridges;
}
