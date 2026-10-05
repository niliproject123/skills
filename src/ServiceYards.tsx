import {campusFootprint} from './campusGeometry';
import {IsoRoundedBox} from './IsoRoundedBox';
import {cityBuildings} from './cityLayout';
import {terminals} from './terminalLayout';
import type {Service} from './model';
import {vertices} from './isometric';
export function ServiceYards(){return <>{(Object.keys(cityBuildings) as Service[]).map(name=>{const building=cityBuildings[name],connections=terminals.filter(terminal=>terminal.service===name);const {u,v,width,depth}=campusFootprint(name);return <g key={name}><IsoRoundedBox u={u} v={v} width={width} depth={depth} height={3} base={-3} radius={20} roof="#c3d890" front="#96b874" side="#81a56b"/>{[[u,v],[u+width-25,v],[u,v+depth-25],[u+width-25,v+depth-25]].map(([cornerU,cornerV],index)=><g key={index}><IsoRoundedBox u={cornerU} v={cornerV} width={25} depth={4} height={6} radius={2} roof="#ecdbad" front="#b4ad81" side="#969a72"/><IsoRoundedBox u={cornerU} v={cornerV} width={4} depth={25} height={6} radius={2} roof="#ecdbad" front="#b4ad81" side="#969a72"/></g>)}{connections.map(terminal=><polyline key={terminal.id} points={vertices([[building.u+building.width/2,building.v+building.depth],[terminal.u+terminal.width/2,terminal.v+terminal.depth/2]])} fill="none" stroke="#e6d4a0" strokeWidth="11"/>)}</g>;})}</>;}
