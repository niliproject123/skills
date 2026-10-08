import type {VehicleSpriteKind} from './vehicleAtlas';

let worker:Worker|undefined,failure:Error|undefined,nextId=0;
const pending=new Map<number,{resolve:(markup:string)=>void;reject:(error:Error)=>void}>();
export function vehicleSpriteMarkup(kind:VehicleSpriteKind,accent:string){
 if(failure)return Promise.reject(failure);
 if(!worker){
  worker=new Worker(new URL('./vehicleSpriteWorker.tsx',import.meta.url),{type:'module'});
  const stop=(error:Error)=>{failure=error;for(const request of pending.values())request.reject(error);pending.clear();worker?.terminate();};
  worker.onerror=event=>{event.preventDefault();stop(new Error(`Vehicle sprite worker failed: ${event.message}`));};
  worker.onmessage=({data})=>{if(data.error){stop(new Error(`Vehicle sprite creation failed: ${data.error}`));return;}const request=pending.get(data.id);if(request){pending.delete(data.id);request.resolve(data.markup);}};
 }
 return new Promise<string>((resolve,reject)=>{const id=nextId++;pending.set(id,{resolve,reject});worker!.postMessage({id,kind,accent});});
}
