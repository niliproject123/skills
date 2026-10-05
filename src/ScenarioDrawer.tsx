import {useEffect,useState} from 'react';
import type {ScenarioConfig} from './scenarioTypes';
import type {Selection} from './model';
import {createPreset,presetNames,type PresetName} from './scenarioPresets';
import {validateScenario} from './scenarioValidation';
import {ScenarioTopologyEditor} from './ScenarioTopologyEditor';
import {ScenarioStateEditor} from './ScenarioStateEditor';
import {ScenarioLayoutEditor} from './ScenarioLayoutEditor';
import {ScenarioVisualEditor} from './ScenarioVisualEditor';
export function ScenarioDrawer({open,configuration,selected,onApply,onClose}:{open:boolean;configuration:ScenarioConfig;selected:Selection|null;onApply:(config:ScenarioConfig)=>void;onClose:()=>void}){
 const [draft,setDraft]=useState(()=>structuredClone(configuration)),[baseline,setBaseline]=useState(()=>createPreset('Demo')),[preset,setPreset]=useState<PresetName>('Demo'),[tab,setTab]=useState('TOPOLOGY'),[error,setError]=useState(''),[message,setMessage]=useState('');
 useEffect(()=>{if(open){setDraft(structuredClone(configuration));setError('');setMessage('');}},[open]);
 if(!open)return null;
 const edit=(change:(config:ScenarioConfig)=>void)=>{try{const copy=structuredClone(draft);change(copy);setDraft(copy);setError('');setMessage('Unapplied changes');}catch(reason){setError(String(reason));}};
 const apply=(config:ScenarioConfig)=>{try{const valid=validateScenario(config);onApply(valid);setDraft(valid);setError('');setMessage('Snapshot applied');}catch(reason){setError(String(reason));}};
 const exportJson=()=>{try{const valid=validateScenario(draft),url=URL.createObjectURL(new Blob([JSON.stringify(valid,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=`${valid.metadata.id}.json`;link.click();URL.revokeObjectURL(url);setMessage('Exported draft configuration');setError('');}catch(reason){setError(String(reason));}};
 return <aside className="scenario-drawer" role="dialog" aria-modal="false" aria-label="Scenario configuration"><div className="scenario-heading"><h2>Scenario configuration</h2><button aria-label="Close configuration" onClick={onClose}>×</button></div><div className="scenario-preset"><label>Preset<select aria-label="Scenario preset" value={preset} onChange={event=>setPreset(event.target.value as PresetName)}>{presetNames.map(name=><option key={name}>{name}</option>)}</select></label><button onClick={()=>{const next=createPreset(preset);setBaseline(structuredClone(next));setDraft(next);setError('');setMessage('Preset loaded into draft. Apply to update the city.');}}>Load preset</button></div>
 {selected&&<p className="scenario-help">Selected: {selected.kind==='terminal'?selected.id:selected.name} <button onClick={()=>setTab('LAYOUT')}>Edit layout</button></p>}
 <div className="scenario-tabs" role="tablist">{['TOPOLOGY','STATE','LAYOUT','VISUALS'].map(section=><button role="tab" aria-selected={section===tab} key={section} onClick={()=>setTab(section)}>{section}</button>)}</div>
 <div className="scenario-content" role="tabpanel">{tab==='TOPOLOGY'?<ScenarioTopologyEditor config={draft} edit={edit}/>:tab==='STATE'?<ScenarioStateEditor config={draft} edit={edit}/>:tab==='LAYOUT'?<ScenarioLayoutEditor config={draft} edit={edit}/>:<ScenarioVisualEditor config={draft} edit={edit}/>}</div>
 {error&&<div className="scenario-error" role="alert">{error}</div>}{message&&<p className="scenario-message" role="status">{message}</p>}
 <footer className="scenario-actions"><button onClick={()=>apply(draft)}>Apply</button><button onClick={()=>apply(structuredClone(baseline))}>Reset preset</button><button onClick={exportJson}>Export JSON</button><label className="import-button">Import JSON<input aria-label="Import JSON" type="file" accept=".json,application/json" onChange={async event=>{const file=event.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('Configuration JSON must be smaller than 1 MB');const imported=validateScenario(JSON.parse(await file.text()));setDraft(imported);setBaseline(structuredClone(imported));setError('');setMessage('JSON imported into draft. Apply to update the city.');}catch(reason){setError(String(reason));}event.target.value='';}}/></label></footer>
 </aside>;
}
