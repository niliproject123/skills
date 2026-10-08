import {defaultScenario} from './scenarioDefault';
import {deriveScenario} from './scenarioDerive';
import type {ScenarioConfig,DerivedRenderModel} from './scenarioTypes';
import {automaticSpatialLayout,rememberSpatialLayout} from './spatialLayout';
export let scenarioRevision=0;
export let currentScenario=structuredClone(defaultScenario);
// Stable collection identities let existing visual components consume only the derived model.
export const renderModel:DerivedRenderModel=deriveScenario(currentScenario);
export function applyScenario(config:ScenarioConfig,prepared?:DerivedRenderModel){
 const next=prepared??deriveScenario(config);
 if(automaticSpatialLayout(config.layout))rememberSpatialLayout(config.topology,config.layout,{...config.layout,services:structuredClone(next.cityBuildings),terminals:Object.fromEntries(next.terminals.map(terminal=>[terminal.id,{u:terminal.u,v:terminal.v,width:terminal.width,depth:terminal.depth,wall:terminal.wall}]))});
 for(const key of Object.keys(next) as (keyof DerivedRenderModel)[]){const target=renderModel[key],source=next[key];if(Array.isArray(target)&&Array.isArray(source)){(target as unknown[]).splice(0,target.length,...source);}else{for(const property of Object.keys(target))delete (target as Record<string,unknown>)[property];Object.assign(target,source);}}
 currentScenario=structuredClone(config);scenarioRevision++;
}
// Live samples retain accepted geometry and static sprite identity.
export function applyMeasurements(config:ScenarioConfig){
 const saved={buildings:renderModel.cityBuildings,terminals:renderModel.terminals,routes:renderModel.cityRoutes,overpasses:renderModel.overpasses};
 const next=deriveScenario(config,saved);
 for(const key of ['services','topics','partitionLoads'] as const){for(const property of Object.keys(renderModel[key]))delete (renderModel[key] as Record<string,unknown>)[property];Object.assign(renderModel[key],next[key]);}
 renderModel.consumerGroups.splice(0,renderModel.consumerGroups.length,...next.consumerGroups);
 renderModel.cityRoutes.splice(0,renderModel.cityRoutes.length,...next.cityRoutes);
 currentScenario=structuredClone(config);
}
