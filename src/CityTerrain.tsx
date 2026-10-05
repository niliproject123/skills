import {renderModel} from './scenarioRuntime';
import {vertices} from './isometric';
import {IsoBox,IsoLamp,IsoRoadSign,IsoShrub,IsoTree} from './IsoPrimitives';
export const decoration=[
 {u:-30,v:200,size:.8},{u:-50,v:265,size:1},{u:-50,v:315,size:.7},
 {u:245,v:220,size:.8},{u:275,v:210,size:1},{u:305,v:205,size:.7},
 {u:320,v:220,size:.7},{u:350,v:190,size:.85},
 {u:595,v:100,size:.8},{u:640,v:80,size:.7},
 {u:655,v:-260,size:1},{u:640,v:-310,size:.7},
 {u:930,v:-275,size:.8},{u:945,v:-215,size:.7},
 {u:1040,v:440,size:.9},{u:1065,v:490,size:.7},
 {u:600,v:760,size:1},{u:640,v:780,size:.8},{u:680,v:785,size:.6}
];
export function visibleDecorations(){
 const candidates=renderModel.terrainOutline.length>4?decoration:Object.values(renderModel.cityBuildings).flatMap(building=>[{u:building.u-50,v:building.v-35,size:.8},{u:building.u-35,v:building.v-55,size:.7},{u:building.u+40,v:building.v-55,size:.9}]);
 const outline=renderModel.terrainOutline;
 return candidates.filter(tree=>{let inside=false;for(let index=0,previous=outline.length-1;index<outline.length;previous=index++){const a=outline[index],b=outline[previous];if((a[1]>tree.v)!==(b[1]>tree.v)&&tree.u<(b[0]-a[0])*(tree.v-a[1])/(b[1]-a[1])+a[0])inside=!inside;}if(!inside)return false;
 if([...Object.values(renderModel.cityBuildings),...renderModel.terminals].some(shape=>tree.u>shape.u-40&&tree.u<shape.u+shape.width+40&&tree.v>shape.v-40&&tree.v<shape.v+shape.depth+40))return false;
 return !renderModel.cityRoutes.some(route=>route.points.slice(1).some((end,index)=>{const start=route.points[index],du=end.u-start.u,dv=end.v-start.v,length=du*du+dv*dv;if(!length)return false;const t=Math.max(0,Math.min(1,((tree.u-start.u)*du+(tree.v-start.v)*dv)/length));return Math.hypot(tree.u-start.u-du*t,tree.v-start.v-dv*t)<route.lanes*11+40;}));
 });
}
export function CityTerrain(){
 const outline=renderModel.terrainOutline;
 return <g><polygon points={vertices(outline.map(([u,v])=>[u,v,-18]))} fill="#6b964f"/><polygon points={vertices(outline)} fill="#a7c771" stroke="#bfdc87" strokeWidth="5"/>
 {outline.length>4&&<><polygon points={vertices([[240,150],[410,150],[410,190],[240,190]])} fill="#dfc98d"/><polygon points={vertices([[630,90],[666,90],[666,-260],[630,-260]])} fill="#dfc98d"/></>}
 {Array.from({length:28},(_,index)=>{const u=250+(index*53%430),v=450+(index*71%120);return <path key={index} d={`M${u-v} ${(u+v)/2}l4-2m-2 4 4-2`} stroke="#759e53" opacity=".5"/>;})}
 </g>;
}
export function GardenProps(){return <g><IsoRoadSign u={320} v={305} label="ORDERS · 4 LANES"/><IsoRoadSign u={850} v={45} label="PAYMENTS · 2 LANES"/><IsoRoadSign u={985} v={650} label="WAITING" small/><IsoRoadSign u={855} v={-110} label="BACKED UP" small/><IsoLamp u={430} v={435}/><IsoLamp u={670} v={625}/><IsoLamp u={860} v={140}/><IsoShrub u={150} v={195}/><IsoShrub u={390} v={210}/><IsoShrub u={1010} v={570}/><IsoBox u={255} v={165} width={32} depth={14} height={12} roof="#d99956" front="#b8763f" side="#915e36"/></g>;}
export function CityTrees(){return <>{visibleDecorations().map((tree,index)=><IsoTree key={index} {...tree}/>)}</>;}
