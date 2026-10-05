import type {ScenarioConfig,DerivedRenderModel,Terminal,Route} from './scenarioTypes';
export function labelAnchors(config:ScenarioConfig,buildings:DerivedRenderModel['cityBuildings'],terminals:Terminal[],routes:Route[]):DerivedRenderModel['labelAnchors']{
 const result:DerivedRenderModel['labelAnchors']={};
 for(const [id,building] of Object.entries(buildings)){const u=building.u+building.width/2,v=building.v+building.depth/2;result[`service-${id}`]={u,v,rise:320,offsetX:0,offsetY:0};}
 for(const topic of config.topology.topics){const route=routes.find(r=>r.topic===topic.id);if(route){const point=route.points[Math.min(2,route.points.length-1)];result[`topic-${topic.id}`]={u:point.u+route.lanes*11+20,v:point.v,rise:100,offsetX:0,offsetY:0};}}
 for(const terminal of terminals)result[`terminal-${terminal.id}`]={u:terminal.u+terminal.width/2,v:terminal.v+terminal.depth/2,rise:170,offsetX:0,offsetY:0};
 for(const [id,placement] of Object.entries(config.layout.labels??{}))for(const key of [id,`service-${id}`,`topic-${id}`,`terminal-${id}`])if(result[key])result[key]={u:placement.labelAnchor.x,v:placement.labelAnchor.y,rise:0,offsetX:placement.labelOffset.x,offsetY:placement.labelOffset.y};return result;
}
