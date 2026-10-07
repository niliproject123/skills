import {cityRoutes,pavedRoutePoints} from './cityLayout';
import {curvedCenterline,lanePath,sampleLane} from './laneGeometry';
import {laneBridgeTravel,bridgeTravelHeight} from './bridgeTravel';
import {overpasses} from './terminalLayout';
import {scenarioRevision} from './scenarioRuntime';
import {project} from './isometric';

type Arrow={topic:string;x:number;y:number;angle:number};
let preparedRevision=-1;
let arrows:Arrow[]=[];

// Derive once per scenario from directed traffic paths, rather than undirected
// road mesh traversal. Shared roads can correctly indicate both directions.
export function highlightDirections(){
 if(preparedRevision===scenarioRevision)return arrows;
 const prepared:Arrow[]=[],occupied=new Set<string>();
 for(const route of cityRoutes){
  const path=lanePath(curvedCenterline(pavedRoutePoints(route),route.lanes*11+18));
  const bridges=laneBridgeTravel(path,overpasses.filter(bridge=>bridge.topic===route.topic));
  const onScreen=(distance:number)=>{
   const position=sampleLane(path,distance),bridge=bridges.find(span=>distance>=span.entry&&distance<=span.exit);
   return project(position.u,position.v,bridge?bridgeTravelHeight(bridge,position):0);
  };
  for(let distance=45;distance<path.length-16;distance+=110){
   const position=sampleLane(path,distance),before=onScreen(distance-5),after=onScreen(distance+5),center=onScreen(distance);
   const angle=Math.atan2(after.y-before.y,after.x-before.x);
   const identity=`${route.topic}/${Math.round(position.u/90)}/${Math.round(position.v/90)}/${Math.round(angle/(Math.PI/4))}`;
   if(occupied.has(identity))continue;
   occupied.add(identity);prepared.push({topic:route.topic,x:center.x,y:center.y,angle});
  }
 }
 arrows=prepared;preparedRevision=scenarioRevision;return arrows;
}
