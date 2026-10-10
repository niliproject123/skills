import {renderModel} from './scenarioRuntime';
export type Topic = string;
export type Service = string;
export type StorageSelection={kind:'partition';name:Topic;partitionId:number;anchor?:{x:number;y:number}}|{kind:'broker';name:string};
export type Selection = StorageSelection | {kind:'topic'; name:Topic} | {kind:'service'; name:Service} | {kind:'gate'; name:Service; topic:Topic; producer:boolean} | {kind:'terminal';name:Service;id:string;topic:Topic;producer:boolean};
export function storageSelection(selection:Selection|null):selection is StorageSelection{return selection?.kind==='partition'||selection?.kind==='broker';}
export const services=renderModel.services;
export const topics=renderModel.topics;
