import {renderModel} from './scenarioRuntime';
import type {Service,Topic} from './model';
import type {VehicleKind} from './IsoVehicle';
export type ProducerConnection={id:string;service:Service;topic:Topic;instances:number};
export type ConsumerGroup={id:string;service:Service;topics:Topic[];instances:number;lag:number;waiting:number;consumeEvery:number};
export const producers=renderModel.producers;
export const consumerGroups=renderModel.consumerGroups;
export const partitionLoads=renderModel.partitionLoads;
export function groupById(id:string){const group=consumerGroups.find(group=>group.id===id);if(!group)throw new Error(`Unknown consumer group ${id}`);return group;}
export function producerById(id:string){const producer=producers.find(producer=>producer.id===id);if(!producer)throw new Error(`Unknown producer connection ${id}`);return producer;}
