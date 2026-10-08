import {tileDrawingCommands} from './tileDrawingCommands';
import type {Bounds,Sprite} from './canvasSprites';

export async function createTileDrawing(terrain:string,roads:Record<string,string>){
 const scene={terrain:tileDrawingCommands(terrain),roads:{}};
 const worker=new Worker(new URL('./tileDrawingWorker.ts',import.meta.url),{type:'module'});
 const pending=new Map<number,{resolve:(sprite:Sprite)=>void;reject:(error:Error)=>void;bounds:Bounds}>();
 let nextId=0,disposed=false,failure:Error|undefined;
 const stop=(error:Error)=>{failure=error;for(const job of pending.values())job.reject(error);pending.clear();worker.terminate();};
 worker.onmessage=({data})=>{
  if(data.error){stop(new Error(`Map tile drawing failed: ${data.error}`));return;}
  const job=pending.get(data.id);if(!job){data.bitmap?.close();return;}pending.delete(data.id);
  try{const canvas=document.createElement('canvas');canvas.width=data.bitmap.width;canvas.height=data.bitmap.height;const context=canvas.getContext('2d');if(!context)throw new Error('Canvas 2D is unavailable.');context.drawImage(data.bitmap,0,0);job.resolve({...job.bounds,image:canvas});}catch(reason){job.reject(reason instanceof Error?reason:new Error(String(reason)));}finally{data.bitmap.close();}
 };
 worker.onerror=event=>{event.preventDefault();stop(new Error(`Map drawing worker failed: ${event.message}`));};
 worker.postMessage({scene});
 try{for(const [topic,markup] of Object.entries(roads)){await new Promise<void>(resolve=>setTimeout(resolve,0));if(failure)throw failure;worker.postMessage({topic,road:tileDrawingCommands(markup)});}}catch(reason){const error=reason instanceof Error?reason:new Error(String(reason));stop(error);throw error;}
 return {
  registerArtwork(artworkKey:string,markup:string){worker.postMessage({artworkKey,layer:tileDrawingCommands(markup)});},
  render(bounds:Bounds,resolution:number,focus:string,artworkKey?:string){return new Promise<Sprite>((resolve,reject)=>{if(disposed||failure){reject(failure??new Error('Map drawing was cancelled.'));return;}const id=nextId++;pending.set(id,{resolve,reject,bounds});worker.postMessage({id,bounds,resolution,focus,artworkKey});});},
  dispose(){disposed=true;stop(new Error('Map drawing was cancelled.'));},
 };
}
