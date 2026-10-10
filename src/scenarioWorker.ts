import {deriveScenario} from './scenarioDerive';
import {validateScenario} from './scenarioValidation';
import {computeLayout} from './mapLayout';
import type {ScenarioConfig} from './scenarioTypes';
import largeCityLayout from './largeCityLayout.json';
import {checkSavedLayout} from './savedLayoutValidation';
import {applicationTopology} from './clusterModel';

const databaseName='kafka-city-layouts',layoutVersion=1;
type SavedLayout=ReturnType<typeof computeLayout>;
let database:Promise<IDBDatabase>|undefined;
function openDatabase(){
 if(!database)database=new Promise<IDBDatabase>((resolve,reject)=>{
  const request=indexedDB.open(databaseName,1);
  request.onupgradeneeded=()=>request.result.createObjectStore('layouts');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(new Error(`Cannot open saved layouts: ${request.error?.message}`));
  request.onblocked=()=>reject(new Error('Saved layout database is blocked by another tab. Close that tab and retry.'));
 });
 return database;
}
async function savedLayout(key:string):Promise<SavedLayout|undefined>{
 const store=await openDatabase();
 return new Promise((resolve,reject)=>{const request=store.transaction('layouts').objectStore('layouts').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error(`Cannot read saved layout: ${request.error?.message}`));});
}
async function saveLayout(key:string,layout:SavedLayout){
 const store=await openDatabase();
 await new Promise<void>((resolve,reject)=>{
  const transaction=store.transaction('layouts','readwrite'),objects=transaction.objectStore('layouts');
  objects.put(layout,key);
  const keys=objects.getAllKeys();keys.onsuccess=()=>{for(const old of keys.result.filter(value=>value!==key).slice(0,Math.max(0,keys.result.length-8)))objects.delete(old);};
  transaction.oncomplete=()=>resolve();transaction.onerror=()=>reject(new Error(`Cannot save layout: ${transaction.error?.message}`));transaction.onabort=()=>reject(new Error(`Saving layout aborted: ${transaction.error?.message}`));
 });
}
self.onmessage=async({data}:{data:ScenarioConfig})=>{
 try{
  const config=validateScenario(data);
  const key=JSON.stringify([layoutVersion,applicationTopology(config.topology),{...config.layout,labels:undefined}]);
  let layout:SavedLayout|undefined;
  if(largeCityLayout.version===layoutVersion&&largeCityLayout.key===key){checkSavedLayout(largeCityLayout.layout,config);layout=largeCityLayout.layout;self.postMessage({progress:'Loading prepared large-city roads and bridges…'});}
  else layout=await savedLayout(key);
  if(!layout){
   self.postMessage({progress:`Calculating roads for ${config.topology.services.length} services and ${config.topology.topics.length} topics…`});
   layout=computeLayout(config.topology,config.layout);await saveLayout(key,layout);
  }else{checkSavedLayout(layout,config);self.postMessage({progress:'Reusing saved roads and bridges…'});}
  self.postMessage({model:deriveScenario(config,layout)});
 }catch(reason){self.postMessage({error:reason instanceof Error?reason.message:String(reason)});}
};
