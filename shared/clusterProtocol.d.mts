import type {ClusterConfig,TopologyModel} from '../src/scenarioTypes';
export function validateClusterTopology(cluster:ClusterConfig|undefined,topics:TopologyModel['topics'],fail:(path:string,message:string)=>never):void;
