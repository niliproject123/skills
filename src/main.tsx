import {VehicleGallery} from './VehiclePreview';
import {moveCampus} from './scenarioActions';
import React,{useState,useRef,lazy,Suspense} from 'react';
import {createRoot} from 'react-dom/client';
import {CanvasCity} from './CanvasCity';
import {TrafficLegend} from './TrafficLegend';
import type {Selection} from './model';
import './style.css';
import {StyleTest} from './StyleTest';
const ScenarioDrawer=lazy(()=>import('./CityEditor').then(module=>({default:module.CityEditor})));
const ItemTabs=lazy(()=>import('./ObjectConfiguration').then(module=>({default:module.ObjectConfiguration})));
import {currentScenario,applyScenario} from './scenarioRuntime';
import {invalidateSpriteCache} from './canvasSprites';
import type {ScenarioConfig} from './scenarioTypes';
import {RuntimeNotice} from './RuntimeNotice';
import {prepareScenario,cancelScenarioPreparation} from './scenarioPreparation';
function KafkaCity(){
 const [configuration,setConfiguration]=useState(()=>structuredClone(currentScenario)),[drawerOpen,setDrawerOpen]=useState(false),[generation,setGeneration]=useState(0),[layoutMode,setLayoutMode]=useState(false);
 const [preparing,setPreparing]=useState(''),[preparationError,setPreparationError]=useState('');
 const preparationNumber=useRef(0);
 const apply=async(next:ScenarioConfig)=>{const number=++preparationNumber.current;setPreparationError('');try{const model=await prepareScenario(next,setPreparing);applyScenario(next,model);invalidateSpriteCache();setConfiguration(structuredClone(next));setGeneration(value=>value+1);setSelection(null);setReset(value=>value+1);}catch(reason){if(number===preparationNumber.current){setPreparationError(String(reason));console.error(reason);}throw reason;}finally{if(number===preparationNumber.current)setPreparing('');}};
 const [paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[selection,setSelection]=useState<Selection|null>(null),[reset,setReset]=useState(0);
 return <main><RuntimeNotice/><header><div><h1>KAFKA CITY<span>SIMULATED</span></h1><p><i/>{configuration.metadata.name}</p></div><nav><button onClick={()=>setDrawerOpen(true)}>Configure</button><button onClick={()=>setPaused(!paused)}>{paused?'▶ Play':'Ⅱ Pause'}</button><label>Speed <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><button onClick={()=>setReset(value=>value+1)}>Reset view</button></nav></header>
 {new URLSearchParams(location.search).has('vehicle-gallery')?<div className="development-gallery"><VehicleGallery maxTrailers={configuration.visualization.maxTrailers} accent="#de7952"/></div>:new URLSearchParams(location.search).has('style-test')?<svg className="world" viewBox="0 0 1500 1000"><StyleTest/></svg>:<CanvasCity key={generation} paused={paused} speed={speed} selected={selection} onSelect={setSelection} reset={reset} layoutMode={layoutMode} onMoveCampus={(id,u,v)=>{const next=structuredClone(configuration);moveCampus(next,id,u,v);void apply(next).catch(()=>{});}}/>}
 {preparing&&<div className="canvas-message city-preparation" role="status">{preparing}<button onClick={cancelScenarioPreparation}>Cancel</button></div>}{preparationError&&<div className="scenario-error preparation-error" role="alert">{preparationError}</div>}
 <Suspense fallback={drawerOpen||selection?<div className="canvas-message">Loading configuration...</div>:null}><ScenarioDrawer open={drawerOpen} configuration={configuration} selected={null} onApply={apply} onClose={()=>{setDrawerOpen(false);setLayoutMode(false);}} layoutMode={layoutMode} onLayoutMode={setLayoutMode}/><ItemTabs configuration={configuration} selected={selection} onSelect={setSelection} onApply={apply}/></Suspense>
 <div className="bottom"><span>Drag to pan · Scroll to zoom · Click an item to configure</span><TrafficLegend visual={configuration.visualization}/></div></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><KafkaCity/></React.StrictMode>);
