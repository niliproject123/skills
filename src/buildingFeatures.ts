import {project} from './isometric';
import type {Placement} from './scenarioTypes';
export function roofFeatures(width:number,depth:number,art:string){const height=art==='Notification'?112:100;return {
 cap:{u:width*.27,v:depth*.24,width:width*.46,depth:depth*.48,height:21,base:height+18},
 chimney:[{u:15,v:18,width:23,depth:23,height:17,base:height+18},{u:19,v:22,width:15,depth:15,height:14,base:height+35}],
 antenna:{u:width*.75,v:depth*.3},height,
 };}
export function rooftopKeepouts(building:Placement,art:string){const width=building.width??150,depth=building.depth??110,features=roofFeatures(width,depth,art),volumes=[features.cap,...(art==='Orders'?features.chimney:[])];const boxes=volumes.map(volume=>{const points=[0,volume.width].flatMap(du=>[0,volume.depth].flatMap(dv=>[volume.base,volume.base+volume.height].map(h=>project(building.u+volume.u+du,building.v+volume.v+dv,h))));return {left:Math.min(...points.map(p=>p.x))-5,right:Math.max(...points.map(p=>p.x))+5,top:Math.min(...points.map(p=>p.y))-5,bottom:Math.max(...points.map(p=>p.y))+5};});
 if(art==='Payment'){const point=project(building.u+width*.55,building.v+depth*.44,features.height+59);boxes.push({left:point.x-24,right:point.x+24,top:point.y-26,bottom:point.y+27});}
 if(art==='Notification'){const point=project(building.u+features.antenna.u,building.v+features.antenna.v,features.height+83);boxes.push({left:point.x-25,right:point.x+25,top:point.y-10,bottom:point.y+75});}return boxes;
}
export function poleIntersects(from:{x:number;y:number},to:{x:number;y:number},box:{left:number;right:number;top:number;bottom:number}){let entry=0,exit=1;for(const [origin,change,min,max] of [[from.x,to.x-from.x,box.left,box.right],[from.y,to.y-from.y,box.top,box.bottom]]){if(Math.abs(change)<.00001){if(origin<min||origin>max)return false;}else{const a=(min-origin)/change,b=(max-origin)/change;entry=Math.max(entry,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(entry>exit)return false;}}return true;}
