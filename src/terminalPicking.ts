import {terminals,overpasses} from './terminalLayout';
import {cityBuildings} from './cityLayout';
import {project} from './isometric';
import type {Selection,Service} from './model';
function inside(x:number,y:number,points:{x:number;y:number}[]){let result=false;for(let index=0,previous=points.length-1;index<points.length;previous=index++){const a=points[index],b=points[previous];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;}
export function pickStructure(x:number,y:number):Selection|null{
 const objects=[...terminals.map(terminal=>({shape:{...terminal,width:terminal.width+(terminal.wall==='side'?85:0),depth:terminal.depth+(terminal.wall==='front'?85:0)},height:55,selection:{kind:'terminal',name:terminal.service,id:terminal.id,topic:terminal.topics[0],producer:terminal.producer} as Selection})),...(Object.keys(cityBuildings) as Service[]).map(name=>({shape:cityBuildings[name],height:145,selection:{kind:'service',name} as Selection}))];
 objects.sort((a,b)=>b.shape.u+b.shape.v+b.shape.width/2+b.shape.depth-a.shape.u-a.shape.v-a.shape.width/2-a.shape.depth);
 for(const {shape,height,selection} of objects){const {u,v,width,depth}=shape;const points=[[u,v,height],[u+width,v,height],[u+width,v,0],[u+width,v+depth,0],[u,v+depth,0],[u,v+depth,height]].map(([u,v,h])=>project(u,v,h));if(inside(x,y,points))return selection;}
 for(const bridge of overpasses){const half=bridge.lanes*11+3,start=bridge.start+bridge.ramp,end=start+bridge.deck;const points=[[bridge.u-half,start,bridge.height],[bridge.u+half,start,bridge.height],[bridge.u+half,end,bridge.height],[bridge.u-half,end,bridge.height]].map(([u,v,h])=>project(u,v,h));if(inside(x,y,points))return {kind:'topic',name:bridge.topic};}
 return null;
}
