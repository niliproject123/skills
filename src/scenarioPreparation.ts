import type {ScenarioConfig,DerivedRenderModel} from './scenarioTypes';

type Pending={resolve:(model:DerivedRenderModel)=>void;reject:(error:Error)=>void;progress:(message:string)=>void};
let worker:Worker|undefined,pending:Pending|undefined;
export function cancelScenarioPreparation(){
 worker?.terminate();worker=undefined;
 pending?.reject(new Error('City preparation cancelled.'));pending=undefined;
}
export function prepareScenario(config:ScenarioConfig,progress:(message:string)=>void):Promise<DerivedRenderModel>{
 cancelScenarioPreparation();progress('Checking saved layout…');
 worker=new Worker(new URL('./scenarioWorker.ts',import.meta.url),{type:'module'});
 const requestedWorker=worker;
 return new Promise((resolve,reject)=>{
  pending={resolve,reject,progress};
  worker!.onmessage=({data})=>{
   if(worker!==requestedWorker)return;
   if(data.progress){pending?.progress(data.progress);return;}
   const job=pending;pending=undefined;
   if(data.error)job?.reject(new Error(data.error));else job?.resolve(data.model);
  };
  worker!.onerror=event=>{event.preventDefault();if(worker!==requestedWorker)return;const job=pending;pending=undefined;worker?.terminate();worker=undefined;job?.reject(new Error(`Layout worker failed: ${event.message}`));};
  worker!.postMessage(config);
 });
}
