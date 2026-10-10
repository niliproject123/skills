import {topicRoadGeometry} from './roadMesh';
import {topics,type Selection} from './model';
import {pickStructure} from './terminalPicking';
import {pickPartitionLane} from './partitionLanes';
export function pick(x:number,y:number):Selection|null{
 const structure=pickStructure(x,y);if(structure&&structure.kind!=='topic')return structure;
 const lane=pickPartitionLane(x,y);if(lane)return lane;
 if(structure)return structure;
 const u=y+x/2,v=y-x/2;
 for(const topic of Object.keys(topics)){
 const geometry=topicRoadGeometry(topic);
 for(const curve of geometry.curves)for(let index=1;index<curve.points.length;index++){
 const a=curve.points[index-1],b=curve.points[index],du=b.u-a.u,dv=b.v-a.v,length=du*du+dv*dv;
 if(!length)continue;const fraction=Math.max(0,Math.min(1,((u-a.u)*du+(v-a.v)*dv)/length));
 if(Math.hypot(u-a.u-du*fraction,v-a.v-dv*fraction)<=curve.lanes*11)return {kind:'topic',name:topic};
 }
 for(const polygon of geometry.branches){let inside=false;for(let index=0,previous=polygon.length-1;index<polygon.length;previous=index++){const a=polygon[index],b=polygon[previous];if((a[1]>v)!==(b[1]>v)&&u<(b[0]-a[0])*(v-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(inside)return {kind:'topic',name:topic};}
 }return null;
}
