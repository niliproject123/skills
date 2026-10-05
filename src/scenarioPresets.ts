import {presetTopology} from './presetTopology';
import {defaultScenario} from './scenarioDefault';
import type {ScenarioConfig} from './scenarioTypes';
export const presetNames=['Demo','Normal','Hot partition','Consumer lag','Recovering consumer','High throughput','Many groups'] as const;
export type PresetName=typeof presetNames[number];
export function createPreset(name:PresetName):ScenarioConfig {
 const config=structuredClone(defaultScenario);config.metadata.name=name;config.metadata.id=name.toLowerCase().replaceAll(' ','-');presetTopology(config,name);
 if(name==='Normal')for(const group of config.topology.consumerGroups){config.state.consumerGroups[group.id]={lag:0,consumptionRate:group.topicIds.reduce((sum,id)=>sum+config.state.topics[id].messagesPerSecond,0)};}
 if(name==='Hot partition')config.state.topics.orders.partitionOverrides={'3':8500};
 if(name==='Consumer lag')config.state.consumerGroups['notification-delivery']={lag:100000,consumptionRate:900};
 if(name==='Recovering consumer')config.state.consumerGroups['notification-delivery']={lag:50000,consumptionRate:12000};
 if(name==='High throughput'){config.state.topics.orders.messagesPerSecond=120000;config.state.topics.payments.messagesPerSecond=50000;config.state.topics.inventory.messagesPerSecond=40000;config.state.topics.fulfilments.messagesPerSecond=30000;}
 if(name==='Many groups')for(const [index,suffix] of ['archive'].entries()){const id=`analytics-${suffix}`;config.topology.consumerGroups.push({id,name:id,serviceId:'Analytics',topicIds:['orders'],consumerCount:2});config.state.consumerGroups[id]={consumptionRate:8000,lag:index*3000};}
 return config;
}
