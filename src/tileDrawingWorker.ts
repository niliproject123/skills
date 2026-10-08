import type {DrawingCommand,DrawingLayer} from './tileDrawingCommands';

type Drawing=OffscreenCanvasRenderingContext2D;
type Paint={fill:string;stroke:string;width:number;join:CanvasLineJoin;cap:CanvasLineCap;dash:number[]};
type Scene={terrain:DrawingLayer;roads:Record<string,DrawingLayer>};
let scene:Scene|undefined;
const artworks=new Map<string,DrawingLayer>();
const paths=new WeakMap<DrawingCommand,Path2D>();
const defaultPaint:Paint={fill:'black',stroke:'none',width:1,join:'miter',cap:'butt',dash:[]};
const spare:OffscreenCanvas[]=[];
function drawing(canvas:OffscreenCanvas){const value=canvas.getContext('2d');if(!value)throw new Error('Worker Canvas 2D is unavailable.');return value;}
function pathFor(command:DrawingCommand){
 let path=paths.get(command);if(path)return path;
 const a=command.attributes;path=new Path2D();
 if(command.tag==='path')path=new Path2D(a.d);
 else if(command.tag==='rect')path.rect(Number(a.x??0),Number(a.y??0),Number(a.width),Number(a.height));
 else{const points=a.points.trim().split(/[ ,]+/).map(Number);if(points.length%2||points.some(value=>!Number.isFinite(value)))throw new Error('Invalid road polygon coordinates.');path.moveTo(points[0],points[1]);for(let index=2;index<points.length;index+=2)path.lineTo(points[index],points[index+1]);if(command.tag==='polygon')path.closePath();}
 paths.set(command,path);return path;
}
function transform(context:Drawing,value:string|undefined){
 if(!value)return;
 const operations=[...value.matchAll(/(translate|scale|matrix)\(([^)]+)\)/g)];
 if(operations.map(operation=>operation[0]).join('').replace(/\s/g,'')!==value.replace(/\s/g,''))throw new Error(`Unsupported artwork transform: ${value}`);
 for(const [,kind,argumentsText] of operations){const values=argumentsText.split(/[ ,]+/).map(Number);if(kind==='translate')context.translate(values[0],values[1]??0);else if(kind==='scale')context.scale(values[0],values[1]??values[0]);else context.transform(...values as [number,number,number,number,number,number]);}
}
function isolated(context:Drawing,draw:(surface:Drawing)=>void,opacity:number){
 const canvas=spare.pop()??new OffscreenCanvas(context.canvas.width,context.canvas.height);
 if(canvas.width!==context.canvas.width)canvas.width=context.canvas.width;if(canvas.height!==context.canvas.height)canvas.height=context.canvas.height;
 const surface=drawing(canvas);surface.resetTransform();surface.clearRect(0,0,canvas.width,canvas.height);surface.setTransform(context.getTransform());
 draw(surface);
 context.save();context.resetTransform();context.globalAlpha*=opacity;context.drawImage(canvas,0,0);context.restore();spare.push(canvas);
}
function paintCommand(context:Drawing,command:DrawingCommand,inherited:Paint,layer:DrawingLayer){
 if(command.tag==='defs'||command.tag==='mask')return;
 const a=command.attributes;
 const paint:Paint={fill:a.fill??inherited.fill,stroke:a.stroke??inherited.stroke,width:a['stroke-width']!==undefined?Number(a['stroke-width']):inherited.width,join:(a['stroke-linejoin']??inherited.join) as CanvasLineJoin,cap:(a['stroke-linecap']??inherited.cap) as CanvasLineCap,dash:a['stroke-dasharray']!==undefined?a['stroke-dasharray'].split(/[ ,]+/).map(Number):inherited.dash};
 context.save();transform(context,a.transform);
 const draw=(surface:Drawing)=>{
  if(command.tag==='g'){for(const child of command.children)paintCommand(surface,child,paint,layer);}
  else{
   const path=pathFor(command);
   if(paint.fill!=='none'){surface.fillStyle=paint.fill;surface.globalAlpha=Number(a['fill-opacity']??1);surface.fill(path);surface.globalAlpha=1;}
   if(paint.stroke!=='none'){surface.strokeStyle=paint.stroke;surface.lineWidth=paint.width;surface.lineJoin=paint.join;surface.lineCap=paint.cap;surface.setLineDash(paint.dash);surface.globalAlpha=Number(a['stroke-opacity']??1);surface.stroke(path);surface.globalAlpha=1;}
  }
 };
 const maskId=a.mask?.match(/^url\(#(.+)\)$/)?.[1];
 const masked=(surface:Drawing)=>{
  if(!maskId){draw(surface);return;}
  const mask=layer.masks[maskId];if(!mask)throw new Error(`Missing map marking mask ${maskId}.`);
  const background=mask.find(item=>item.tag==='rect'&&item.attributes.fill==='white');if(!background)throw new Error(`Unsupported map marking mask ${maskId}.`);
  surface.save();surface.clip(pathFor(background));draw(surface);surface.globalCompositeOperation='destination-out';surface.globalAlpha=1;
  for(const hole of mask)if(hole!==background){if(hole.attributes.fill!=='black')throw new Error(`Unsupported map mask color ${maskId}.`);surface.fill(pathFor(hole));}surface.restore();
 };
 const opacity=Number(a.opacity??1);
 if(maskId||opacity!==1)isolated(context,masked,opacity);else draw(context);
 context.restore();
}
function drawLayer(context:Drawing,layer:DrawingLayer){for(const command of layer.commands)paintCommand(context,command,defaultPaint,layer);}
self.onmessage=({data})=>{
 try{
  if(data.scene){scene=data.scene;return;}
  if(data.topic&&data.road){if(!scene)throw new Error('Static map drawing data is not ready.');scene.roads[data.topic]=data.road;return;}
  if(data.artworkKey&&data.layer){artworks.set(data.artworkKey,data.layer);return;}
  if(!scene)throw new Error('Static map drawing data is not ready.');
  const {bounds,resolution,focus,id}=data,canvas=new OffscreenCanvas(Math.ceil(bounds.width*resolution),Math.ceil(bounds.height*resolution)),context=drawing(canvas);
  context.setTransform(resolution,0,0,resolution,-bounds.x*resolution,-bounds.y*resolution);
  if(data.artworkKey){const layer=artworks.get(data.artworkKey);if(!layer)throw new Error(`Missing bridge artwork ${data.artworkKey}.`);drawLayer(context,layer);}
  else{drawLayer(context,scene.terrain);for(const [topic,layer] of Object.entries(scene.roads)){if(focus==='all'||topic===focus)drawLayer(context,layer);else isolated(context,surface=>drawLayer(surface,layer),.23);}}
  const bitmap=canvas.transferToImageBitmap();self.postMessage({id,bitmap},{transfer:[bitmap]});
 }catch(reason){self.postMessage({id:data.id,error:reason instanceof Error?reason.message:String(reason)});}
};
