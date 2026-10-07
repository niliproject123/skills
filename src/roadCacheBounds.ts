import type {Route,Terminal} from './scenarioTypes';
import {project} from './isometric';

export function roadCacheBounds(topic:string,routes:Route[],terminals:Terminal[]){
 const roads=routes.filter(route=>route.topic===topic),yards=terminals.filter(terminal=>terminal.topics.includes(topic));
 const points=[...roads.flatMap(route=>route.points),...yards.flatMap(terminal=>[
  {u:terminal.u-20,v:terminal.v-20},{u:terminal.u+terminal.width+80,v:terminal.v-20},
  {u:terminal.u-20,v:terminal.v+terminal.depth+80},{u:terminal.u+terminal.width+80,v:terminal.v+terminal.depth+80}
 ])].map(point=>project(point.u,point.v));
 if(!points.length)return {x:0,y:0,width:1,height:1};
 const margin=Math.max(24,...roads.map(route=>route.lanes*11+24));
 const x=Math.min(...points.map(point=>point.x))-margin*2,y=Math.min(...points.map(point=>point.y))-margin;
 return {x,y,width:Math.ceil(Math.max(...points.map(point=>point.x))-x+margin*2),height:Math.ceil(Math.max(...points.map(point=>point.y))-y+margin)};
}
