import {cityBuildings} from './cityLayout';
import {terminals} from './terminalLayout';
export function campusFootprint(service:string){
 const building=cityBuildings[service];if(!building)throw new Error(`Missing campus ${service}`);
 return campusBounds(building,terminals.filter(terminal=>terminal.service===service));
}
export function campusBounds(building:{u:number;v:number;width:number;depth:number},connections:typeof terminals){
 const shapes=[building,...connections.map(terminal=>({...terminal,width:terminal.width+(terminal.wall==='side'?85:0),depth:terminal.depth+(terminal.wall==='front'?85:0)}))];
 const u=Math.min(...shapes.map(shape=>shape.u))-15,v=Math.min(...shapes.map(shape=>shape.v))-15,width=Math.max(...shapes.map(shape=>shape.u+shape.width))-u+15,depth=Math.max(...shapes.map(shape=>shape.v+shape.depth))-v+15;
 return {u,v,width,depth};
}
