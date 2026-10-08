import type {TopologyModel} from '../src/scenarioTypes';
export type MapSnapshot={version:1;sequence:number;cluster:{id:string;name:string};observedAt:string;topology:TopologyModel;metrics:{topics:Record<string,{messagesPerSecond:number|null;averageMessageBytes?:number|null;source:string}>;consumerGroups:Record<string,{consumptionRate:number|null;lag:number|null;source:string}>};status:{state:'ok'|'degraded'|'error';message:string}};
export class PayloadError extends Error {}
export function validateMapSnapshot(input:unknown,now?:number):MapSnapshot;
