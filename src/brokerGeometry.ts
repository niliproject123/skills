import {project} from './isometric';
type Point={x:number;y:number};
export function polygon(drawing:CanvasRenderingContext2D,points:Point[],fill:string,stroke?:string){drawing.beginPath();points.forEach((point,index)=>index?drawing.lineTo(point.x,point.y):drawing.moveTo(point.x,point.y));drawing.closePath();drawing.fillStyle=fill;drawing.fill();if(stroke){drawing.strokeStyle=stroke;drawing.lineWidth=1;drawing.stroke();}}
// Rounded ground outlines use the same 2:1 camera as roads and buildings.
export function brokerBox(drawing:CanvasRenderingContext2D,u:number,v:number,width:number,depth:number,height:number,roof:string,front:string,side:string,base=0,radius=7){
 const rounding=Math.min(radius,width/2,depth/2),corners=[[u+width-rounding,v+rounding,-90],[u+width-rounding,v+depth-rounding,0],[u+rounding,v+depth-rounding,90],[u+rounding,v+rounding,180]];
 const outline=corners.flatMap(([x,y,start])=>Array.from({length:5},(_,index)=>{const angle=(start+index*22.5)*Math.PI/180;return {u:x+Math.cos(angle)*rounding,v:y+Math.sin(angle)*rounding};}));
 outline.forEach((before,index)=>{const after=outline[(index+1)%outline.length],normalU=after.v-before.v,normalV=before.u-after.u;if(normalU+normalV<=0)return;polygon(drawing,[project(before.u,before.v,base),project(after.u,after.v,base),project(after.u,after.v,base+height),project(before.u,before.v,base+height)],normalV>normalU?front:side);});
 polygon(drawing,outline.map(point=>project(point.u,point.v,base+height)),roof);
}
export function drawBrokerBuilding(drawing:CanvasRenderingContext2D,storageDepth=230){
 brokerBox(drawing,3,3,176,storageDepth,7,'#c1c7b4','#8c9a90','#718478');
 brokerBox(drawing,17,15,142,96,83,'#566d79','#425963','#30464f');
 brokerBox(drawing,12,10,152,106,9,'#91a9ac','#687f85','#4c6670',83);
 for(let index=0;index<3;index++){
  brokerBox(drawing,34+index*37,27,26,45,12,'#c3d1c7','#849c9b','#657e83',92,5);
  // Server drawers are embedded in the front wall, not service dock bays.
  for(let row=0;row<4;row++){
   const u=30+index*39,v=111,height=22+row*13;
   polygon(drawing,[project(u,v,height),project(u+28,v,height),project(u+28,v,height+8),project(u,v,height+8)],'#a5b8b6');
   const light=project(u+23,v+1,height+4);drawing.fillStyle='#dbe7b6';drawing.beginPath();drawing.arc(light.x,light.y,2,0,Math.PI*2);drawing.fill();
  }
 }
 brokerBox(drawing,135,127,23,30,15,'#9eb1a6','#7a908a','#536e68',7,5);
}
export function drawReplicaModule(drawing:CanvasRenderingContext2D,u:number,v:number,color:string,leader:boolean,inSync:boolean|null,count:number,selected:boolean){
 drawing.save();drawing.globalAlpha*=inSync===false?.52:1;
 brokerBox(drawing,u,v,23,24,17,inSync===false?'#a8afa4':color,inSync===false?'#829087':color,inSync===false?'#697b75':'#52636a',7,5);
 const center=project(u+12,v+13,29);
 if(leader){drawing.strokeStyle='#f9eec5';drawing.lineWidth=2;drawing.beginPath();drawing.moveTo(center.x,center.y);drawing.lineTo(center.x,center.y-12);drawing.stroke();polygon(drawing,[{x:center.x,y:center.y-12},{x:center.x+9,y:center.y-9},{x:center.x,y:center.y-6}],'#ffe9a2');}
 if(inSync===null&&count===1){drawing.fillStyle='#ecebd5';drawing.font='bold 10px system-ui';drawing.fillText('?',center.x-3,center.y+3);}
 if(selected){drawing.strokeStyle='#fff3ac';drawing.lineWidth=2;drawing.beginPath();[project(u,v,25),project(u+23,v,25),project(u+23,v+24,25),project(u,v+24,25)].forEach((point,index)=>index?drawing.lineTo(point.x,point.y):drawing.moveTo(point.x,point.y));drawing.closePath();drawing.stroke();}
 if(count>1){drawing.fillStyle='#fff7de';drawing.font='bold 10px system-ui';drawing.textAlign='center';drawing.fillText(String(count),center.x,center.y+3);}
 drawing.restore();
}
