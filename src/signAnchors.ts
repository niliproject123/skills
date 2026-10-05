import {rooftopKeepouts,poleIntersects} from './buildingFeatures';
import {services} from './model';
import {campusFootprint} from './campusGeometry';
import {currentScenario,renderModel} from './scenarioRuntime';
import {cityBuildings} from './cityLayout';
import {terminals} from './terminalLayout';
import {project,type GroundPoint} from './isometric';
export type WorldSignAnchor=GroundPoint&{rise:number;offsetX:number;offsetY:number};
// Service signs use the explicit object-center anchor supplied by labelGeometry.
export function serviceSignAnchor(service:string):WorldSignAnchor{
 const building=cityBuildings[service];if(!building)throw new Error(`Missing sign campus ${service}`);
 const anchor=renderModel.labelAnchors[`service-${service}`];if(!anchor)throw new Error(`Missing campus label anchor ${service}`);return anchor;
}

export function clearCampusAnchor(service:string,sign:{x:number;y:number}){
 const campus=campusFootprint(service),candidates=[12,35,65].flatMap(clearance=>[.5,.8,.2,0,1].flatMap(fraction=>[{u:campus.u+campus.width*fraction,v:campus.v-clearance},{u:campus.u+campus.width*fraction,v:campus.v+campus.depth+clearance},{u:campus.u+campus.width+clearance,v:campus.v+campus.depth*fraction},{u:campus.u-clearance,v:campus.v+campus.depth*fraction}]));
 const keepouts=Object.entries(cityBuildings).flatMap(([id,building])=>rooftopKeepouts(building,services[id].art));
 const visibleObjects=[...Object.values(cityBuildings).map(building=>({...building,height:145})),...terminals.map(terminal=>({...terminal,height:55}))].map(shape=>{const points=[0,shape.width].flatMap(du=>[0,shape.depth].flatMap(dv=>[0,shape.height].map(height=>project(shape.u+du,shape.v+dv,height))));return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};});
 const anchor=candidates.find(point=>{const end=project(point.u,point.v);return !visibleObjects.some(box=>end.x>box.left&&end.x<box.right&&end.y>box.top&&end.y<box.bottom)&&!keepouts.some(box=>poleIntersects(sign,end,box));});
 if(!anchor)throw new Error(`No clear sign pole for ${services[service].name}. Set an explicit label anchor and offset.`);return anchor;
}
