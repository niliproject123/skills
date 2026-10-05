import {renderModel} from './scenarioRuntime';
export type Topic = string;
export type Service = string;
export type Selection = {kind:'topic'; name:Topic} | {kind:'service'; name:Service} | {kind:'gate'; name:Service; topic:Topic; producer:boolean} | {kind:'terminal';name:Service;id:string;topic:Topic;producer:boolean};
export const services=renderModel.services;
export const topics=renderModel.topics;
