import type {ScenarioConfig} from './scenarioTypes';
import type {SignMode,ViewOptions} from './viewOptions';
export function ViewControls({configuration,view,onChange}:{configuration:ScenarioConfig;view:ViewOptions;onChange:(view:ViewOptions)=>void}){
 const toggle=(field:'topics'|'services',id:string)=>onChange({...view,[field]:view[field].includes(id)?view[field].filter(value=>value!==id):[...view[field],id]});
 return <details className="view-controls"><summary>View & filters</summary><div className="view-controls-body">
 {(['serviceSigns','topicSigns','lagGauges'] as const).map((field,index)=><label key={field}>{['Service signs','Topic signs','Lag gauges'][index]}<select aria-label={['Service signs','Topic signs','Lag gauges'][index]} value={view[field]} onChange={event=>onChange({...view,[field]:event.target.value as SignMode})}><option value="automatic">Automatic</option><option value="always">Always</option><option value="hidden">Hidden</option></select></label>)}
 <fieldset><legend>Topics</legend>{configuration.topology.topics.map(item=><label key={item.id}><input type="checkbox" checked={view.topics.includes(item.id)} onChange={()=>toggle('topics',item.id)}/>{item.name}</label>)}</fieldset>
 <fieldset><legend>Services</legend>{configuration.topology.services.map(item=><label key={item.id}><input type="checkbox" checked={view.services.includes(item.id)} onChange={()=>toggle('services',item.id)}/>{item.name}</label>)}</fieldset>
 <p>No selections shows everything. Topics and services combine; unrelated objects are dimmed.</p><button onClick={()=>onChange({...view,topics:[],services:[]})}>Clear filters</button>
 </div></details>;
}
