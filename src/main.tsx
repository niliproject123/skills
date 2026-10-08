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
import {currentScenario,applyScenario,applyMeasurements} from './scenarioRuntime';
import {invalidateSpriteCache} from './canvasSprites';
import type {ScenarioConfig} from './scenarioTypes';
import {RuntimeNotice} from './RuntimeNotice';
import {prepareScenario,cancelScenarioPreparation} from './scenarioPreparation';
import {liveSnapshot,setLiveSnapshot,scenarioFromSnapshot} from './liveData';
import {useLiveConnection} from './useLiveConnection';
import {LiveStatus} from './LiveStatus';
import {ViewControls} from './ViewControls';
import {defaultViewOptions,type ViewOptions} from './viewOptions';
import type {MapSnapshot} from '../shared/mapProtocol.mjs';
function KafkaCity(){
 const [configuration,setConfiguration]=useState(()=>structuredClone(currentScenario)),[drawerOpen,setDrawerOpen]=useState(false),[generation,setGeneration]=useState(0),[layoutMode,setLayoutMode]=useState(false);
 const [preparing,setPreparing]=useState(''),[preparationError,setPreparationError]=useState('');
 const preparationNumber=useRef(0);
 const [liveEnabled,setLiveEnabled]=useState(()=>new URLSearchParams(location.search).get('live')==='1'),[viewOptions,setViewOptions]=useState<ViewOptions>(defaultViewOptions);
 const liveActive=useRef(false);liveActive.current=liveEnabled;
 const demoConfiguration=useRef(configuration),liveTopology=useRef('');
 const apply=async(next:ScenarioConfig,snapshot:MapSnapshot|null=null)=>{const number=++preparationNumber.current;setPreparationError('');try{const model=await prepareScenario(next,setPreparing);if(snapshot&&!liveActive.current)throw new Error('Live connection was closed during preparation.');setLiveSnapshot(snapshot);applyScenario(next,model);invalidateSpriteCache();setConfiguration(structuredClone(next));setGeneration(value=>value+1);setSelection(null);setViewOptions(previous=>({...previous,topics:previous.topics.filter(id=>next.topology.topics.some(item=>item.id===id)),services:previous.services.filter(id=>next.topology.services.some(item=>item.id===id))}));setReset(value=>value+1);}catch(reason){if(number===preparationNumber.current){setPreparationError(String(reason));console.error(reason);}throw reason;}finally{if(number===preparationNumber.current)setPreparing('');}};
 const connection=useLiveConnection(liveEnabled,async snapshot=>{const next=scenarioFromSnapshot(snapshot,liveSnapshot?.cluster.id===snapshot.cluster.id?currentScenario:undefined),key=JSON.stringify([snapshot.cluster.id,next.topology]);if(liveTopology.current!==key){await apply(next,snapshot);liveTopology.current=key;}else{applyMeasurements(next);setLiveSnapshot(snapshot);setConfiguration(structuredClone(next));}});
 const [paused,setPaused]=useState(false),[speed,setSpeed]=useState(1),[selection,setSelection]=useState<Selection|null>(null),[reset,setReset]=useState(0);
 return <main><RuntimeNotice/><header><div><h1>KAFKA CITY<span>{liveEnabled?connection.stale?'STALE':connection.snapshot?'LIVE':'WAITING':'SIMULATED'}</span></h1><p><i/>{configuration.metadata.name}</p></div><nav><button onClick={()=>{if(liveEnabled){setLiveEnabled(false);liveTopology.current='';void apply(demoConfiguration.current).catch(()=>{});}else{demoConfiguration.current=configuration;liveTopology.current='';setDrawerOpen(false);setSelection(null);setLiveEnabled(true);}}}>{liveEnabled?'Demo mode':'Connect live'}</button><ViewControls configuration={configuration} view={viewOptions} onChange={setViewOptions}/>{!liveEnabled&&<details className="demo-tools"><summary>Demo tools</summary><button onClick={()=>setDrawerOpen(true)}>Configure</button></details>}<button onClick={()=>setPaused(!paused)}>{paused?'▶ Play':'Ⅱ Pause'}</button><label>Speed <select value={speed} onChange={event=>setSpeed(Number(event.target.value))}><option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option></select></label><button onClick={()=>setReset(value=>value+1)}>Reset view</button></nav></header>
 <LiveStatus connection={connection}/>
 {liveEnabled&&!liveSnapshot?<div className="live-empty">Connect your Kafka environment using the collector setup instructions.</div>:new URLSearchParams(location.search).has('vehicle-gallery')?<div className="development-gallery"><VehicleGallery maxTrailers={configuration.visualization.maxTrailers} accent="#de7952"/></div>:new URLSearchParams(location.search).has('style-test')?<svg className="world" viewBox="0 0 1500 1000"><StyleTest/></svg>:<CanvasCity key={generation} paused={paused} speed={speed} selected={selection} onSelect={setSelection} reset={reset} viewOptions={viewOptions} layoutMode={layoutMode} onMoveCampus={(id,u,v)=>{const next=structuredClone(configuration);moveCampus(next,id,u,v);void apply(next).catch(()=>{});}}/>}
 {preparing&&<div className="canvas-message city-preparation" role="status">{preparing}<button onClick={cancelScenarioPreparation}>Cancel</button></div>}{preparationError&&<div className="scenario-error preparation-error" role="alert">{preparationError}</div>}
 <Suspense fallback={drawerOpen||selection?<div className="canvas-message">Loading configuration...</div>:null}><ScenarioDrawer open={drawerOpen} configuration={configuration} selected={null} onApply={apply} onClose={()=>{setDrawerOpen(false);setLayoutMode(false);}} layoutMode={layoutMode} onLayoutMode={setLayoutMode}/><ItemTabs configuration={configuration} selected={selection} onSelect={setSelection} onApply={apply}/></Suspense>
 <div className="bottom"><span>Drag to pan · Scroll to zoom · Click an item for current values</span><TrafficLegend visual={configuration.visualization}/></div></main>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><KafkaCity/></React.StrictMode>);
