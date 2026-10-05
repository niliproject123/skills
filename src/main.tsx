import {VehicleGallery} from './VehiclePreview';
import {moveCampus} from './scenarioActions';
import React,{useState,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {CanvasCity} from './CanvasCity';
import {SelectionPanel} from './SelectionPanel';
import type {Selection} from './model';
import './style.css';
import {StyleTest} from './StyleTest';
const ScenarioDrawer=lazy(()=>import('./CityEditor').then(module=>({default:module.CityEditor})));
import {currentScenario,applyScenario} from './scenarioRuntime';
import {invalidateSpriteCache} from './canvasSprites';
import type {ScenarioConfig} from './scenarioTypes';
import {RuntimeNotice} from './RuntimeNotice';
function KafkaCity(){
 const [configuration,setConfiguration]=useState(()=>structuredClone(currentScenario)),[drawerOpen,setDrawerOpen]=useState(false),[generation,setGeneration]=useState(0),[layoutMode,setLayoutMode]=useState(false);
 const apply=(next:ScenarioConfig)=>{applyScenario(next);invalidateSpriteCache();setConfiguration(structuredClone(next));setGeneration(value=>value+1);setSelection(null);setReset(value=>value+1);};
 const [paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[selection,setSelection]=useState<Selection|null>(null),[reset,setReset]=useState(0);
 return <main><RuntimeNotice/><header><div><h1>KAFKA CITY<span>SIMULATED</span></h1><p><i/>{configuration.metadata.name}</p></div><nav><button onClick={()=>setDrawerOpen(true)}>Configure</button><button onClick={()=>setPaused(!paused)}>{paused?'▶ Play':'Ⅱ Pause'}</button><label>Speed <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><button onClick={()=>setReset(value=>value+1)}>Reset view</button></nav></header>
 {new URLSearchParams(location.search).has('vehicle-gallery')?<div className="development-gallery"><VehicleGallery maxTrailers={configuration.visualization.maxTrailers} accent="#de7952"/></div>:new URLSearchParams(location.search).has('style-test')?<svg className="world" viewBox="0 0 1500 1000"><StyleTest/></svg>:<CanvasCity key={generation} paused={paused} speed={speed} selected={selection} onSelect={value=>{setSelection(value);setDrawerOpen(true);}} reset={reset} layoutMode={layoutMode} onMoveCampus={(id,u,v)=>{const next=structuredClone(configuration);moveCampus(next,id,u,v);apply(next);}}/>}
 <Suspense fallback={drawerOpen?<div className="canvas-message">Loading configuration...</div>:null}><ScenarioDrawer open={drawerOpen} configuration={configuration} selected={selection} onApply={apply} onClose={()=>{setDrawerOpen(false);setLayoutMode(false);}} layoutMode={layoutMode} onLayoutMode={setLayoutMode}/></Suspense>
 <SelectionPanel selection={drawerOpen?null:selection} onClose={()=>setSelection(null)}/><div className="bottom"><span>Drag open space to pan · Scroll to zoom · Select roads, buildings & gates</span><div><b>Traffic</b><span>▰ Car</span><span>▰ Van</span><span>▰ Truck</span><span>▰ Semi</span><span className="queue-key">▰ Waiting</span></div></div></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><KafkaCity/></React.StrictMode>);
