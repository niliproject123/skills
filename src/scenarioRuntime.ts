import {defaultScenario} from './scenarioDefault';
import {deriveScenario} from './scenarioDerive';
import type {ScenarioConfig,DerivedRenderModel} from './scenarioTypes';
export let currentScenario=structuredClone(defaultScenario);
// Stable collection identities let existing visual components consume only the derived model.
export const renderModel:DerivedRenderModel=deriveScenario(currentScenario);
export function applyScenario(config:ScenarioConfig){
 const next=deriveScenario(config);
 for(const key of Object.keys(next) as (keyof DerivedRenderModel)[]){const target=renderModel[key],source=next[key];if(Array.isArray(target)&&Array.isArray(source)){(target as unknown[]).splice(0,target.length,...source);}else{for(const property of Object.keys(target))delete (target as Record<string,unknown>)[property];Object.assign(target,source);}}
 currentScenario=structuredClone(config);
}
