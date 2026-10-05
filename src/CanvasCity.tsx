import {articulatedAngles} from './IsoArticulatedSprite';
import {renderModel} from './scenarioRuntime';
import {useEffect,useRef,useState} from 'react';
import {loadSpriteCache,context,mapBounds,type SpriteCache,type Bounds} from './canvasSprites';
import {CitySimulation,makeTrafficUnits} from './CitySimulation';
import {cityRoutes,roadSegments,cityBuildings} from './cityLayout';
import {services,topics,type Selection,type Topic} from './model';
import {project} from './isometric';
import {pick} from './canvasPicking';
import {cameraTransform,zoomLevel} from './canvasCamera';
import {CityLabels,placeLabels} from './CityLabels';
import {linked,drawHighlights} from './canvasHighlights';
import {groupById,producerById} from './kafkaTopology';

type DrawItem={depth:number;sprite:HTMLCanvasElement|null;bounds:Bounds;erase:boolean;opacity:number;connector?:{x:number;y:number;toX:number;toY:number}};
const overlap=(a:Bounds,b:Bounds)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function CanvasCity({paused,speed,selected,onSelect,reset,layoutMode=false,onMoveCampus}:{paused:boolean;speed:number;selected:Selection|null;onSelect:(selection:Selection)=>void;reset:number;layoutMode?:boolean;onMoveCampus?:(service:string,u:number,v:number)=>void}){
 const MAX_VEHICLES=renderModel.visualization.maxVehiclesTotal;
 const host=useRef<HTMLDivElement>(null),staticCanvas=useRef<HTMLCanvasElement>(null),movingCanvas=useRef<HTMLCanvasElement>(null);
 const options=useRef({paused,speed,selected,onSelect,layoutMode,onMoveCampus});options.current={paused,speed,selected,onSelect,layoutMode,onMoveCampus};
 const camera=useRef({x:0,y:0,zoom:1,dirty:true});
 const [error,setError]=useState<string|null>(null),[ready,setReady]=useState(false);
 const [hovered,setHovered]=useState<Selection|null>(null);
 useEffect(()=>{camera.current={x:0,y:0,zoom:1,dirty:true};},[reset]);
 useEffect(()=>{camera.current.dirty=true;},[selected]);
 useEffect(()=>{
 let cancelled=false,frame=0,cache:SpriteCache|null=null,width=0,height=0,pixelRatio=1,last=performance.now(),reported=0;
 const drawSamples:number[]=[],intervalSamples:number[]=[],panSamples:number[]=[];
 const drawPool:DrawItem[]=Array.from({length:MAX_VEHICLES*(renderModel.visualization.maxTrailers*2+1)+renderModel.terminals.length+renderModel.overpasses.length+Object.keys(services).length+64},()=>({depth:0,sprite:null,bounds:{x:0,y:0,width:0,height:0},erase:false,opacity:1}));
 const ordered:DrawItem[]=[];let used=0;
 function queueDraw(depth:number,sprite:HTMLCanvasElement,x:number,y:number,width:number,height:number,erase:boolean,opacity:number){const item=drawPool[used++];if(!item)throw new Error('Canvas draw capacity exceeded');item.connector=undefined;item.depth=depth;item.sprite=sprite;item.bounds.x=x;item.bounds.y=y;item.bounds.width=width;item.bounds.height=height;item.erase=erase;item.opacity=opacity;ordered.push(item);}
 const requested=new URLSearchParams(location.search).get('stress');
 const count=requested===null?cityRoutes.reduce((sum,route)=>sum+route.moving+route.queue,0):Number(requested);
 if(!Number.isInteger(count)||(requested!==null&&count<74)||count>MAX_VEHICLES)throw new Error('Stress traffic must be an integer between 74 and 200');
 const waiting=cityRoutes.reduce((sum,route)=>sum+route.queue,0),moving=count-waiting,totalMoving=cityRoutes.reduce((sum,route)=>sum+route.moving,0);
 let assigned=0;
 const routes=requested===null?cityRoutes:cityRoutes.map((route,index)=>{const vehicles=index===cityRoutes.length-1?moving-assigned:Math.floor(moving*route.moving/totalMoving);assigned+=vehicles;return {...route,moving:vehicles};});
 const trafficUnits=makeTrafficUnits(routes);
 const simulation=new CitySimulation(routes);
 const background=context(staticCanvas.current!),foreground=context(movingCanvas.current!);
 const sizes=()=>{const bounds=host.current!.getBoundingClientRect();width=bounds.width;height=bounds.height;pixelRatio=Math.min(2,devicePixelRatio);for(const canvas of [staticCanvas.current!,movingCanvas.current!]){canvas.width=Math.round(width*pixelRatio);canvas.height=Math.round(height*pixelRatio);}camera.current.dirty=true;};
 const observer=new ResizeObserver(sizes);observer.observe(host.current!);sizes();
 function transform(){return cameraTransform(width,height,camera.current);}
 let hoverSelection:Selection|null=null,hoverKey='';
 const worldPoint=(event:PointerEvent|WheelEvent)=>{const bounds=host.current!.getBoundingClientRect(),view=transform();return {x:(event.clientX-bounds.left-view.x)/view.scale,y:(event.clientY-bounds.top-view.y)/view.scale};};
 let panningChanged=false;
 let campusDrag:{service:string;start:{x:number;y:number};du:number;dv:number;travel:number;pointer:{x:number;y:number}}|null=null;
 let drag:{x:number;y:number;startX:number;startY:number;travel:number}|null=null;
 const down=(event:PointerEvent)=>{if(event.button!==0)return;host.current!.setPointerCapture(event.pointerId);if(options.current.layoutMode){const point=worldPoint(event),target=pick(point.x,point.y);if(target&&target.kind!=='topic'){campusDrag={service:target.name,start:point,du:0,dv:0,travel:0,pointer:{x:event.clientX,y:event.clientY}};element.dataset.movingCampus=target.name;return;}}drag={x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY,travel:0};};
 const move=(event:PointerEvent)=>{if(campusDrag){const point=worldPoint(event),dx=point.x-campusDrag.start.x,dy=point.y-campusDrag.start.y;campusDrag.du=dy+dx/2;campusDrag.dv=dy-dx/2;campusDrag.travel=Math.hypot(event.clientX-campusDrag.pointer.x,event.clientY-campusDrag.pointer.y);camera.current.dirty=true;return;}if(!drag){const point=worldPoint(event),target=pick(point.x,point.y);const key=target?JSON.stringify(target):'';if(key!==hoverKey){hoverKey=key;hoverSelection=target;setHovered(target);camera.current.dirty=true;}element.title=target?target.kind==='gate'?`${target.name} · ${target.producer?'Producer':'Consumer'} · ${target.topic} · lag ${services[target.name].lag}`:target.name:'';return;}const fit=Math.min(width/1500,height/1000);panningChanged=true;camera.current.x=Math.max(-600,Math.min(600,camera.current.x+(event.clientX-drag.x)/fit));camera.current.y=Math.max(-450,Math.min(450,camera.current.y+(event.clientY-drag.y)/fit));camera.current.dirty=true;drag.travel=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);drag.x=event.clientX;drag.y=event.clientY;};
 const up=(event:PointerEvent)=>{if(campusDrag){const moving=campusDrag;campusDrag=null;delete element.dataset.movingCampus;try{if(moving.travel>=5){const building=cityBuildings[moving.service];if(!options.current.onMoveCampus)throw new Error('Campus movement is unavailable');options.current.onMoveCampus(moving.service,Math.round(building.u+moving.du),Math.round(building.v+moving.dv));}}catch(reason){setError(String(reason));console.error(reason);}camera.current.dirty=true;return;}if(drag&&drag.travel<5){const point=worldPoint(event),selection=pick(point.x,point.y);if(selection)options.current.onSelect(selection);}drag=null;};
 const cancel=()=>{drag=null;campusDrag=null;delete element.dataset.movingCampus;camera.current.dirty=true;};
 const wheel=(event:WheelEvent)=>{event.preventDefault();camera.current.zoom=Math.max(.65,Math.min(1.8,camera.current.zoom*Math.exp(-event.deltaY*.001)));camera.current.dirty=true;};
 const element=host.current!;element.addEventListener('pointerdown',down);element.addEventListener('pointermove',move);element.addEventListener('pointerup',up);element.addEventListener('pointercancel',cancel);element.addEventListener('wheel',wheel,{passive:false});
 function animate(now:number){
 if(cancelled||!cache)return;
 if(options.current.paused&&!camera.current.dirty){last=now;frame=requestAnimationFrame(animate);return;}
 try{
 const started=performance.now(),interval=now-last,cameraMoved=panningChanged;panningChanged=false;if(!options.current.paused)simulation.advance(Math.min(.08,interval/1000)*options.current.speed);last=now;
 const view=transform(),visible:Bounds={x:-view.x/view.scale,y:-view.y/view.scale,width:width/view.scale,height:height/view.scale};
 const apply=(drawing:CanvasRenderingContext2D)=>drawing.setTransform(pixelRatio*view.scale,0,0,pixelRatio*view.scale,pixelRatio*view.x,pixelRatio*view.y);
 const focus=options.current.selected?options.current.selected:hoverSelection;
 if(camera.current.dirty){background.setTransform(1,0,0,1,0,0);background.clearRect(0,0,staticCanvas.current!.width,staticCanvas.current!.height);apply(background);const related=Object.keys(topics).filter(topic=>linked(topic,focus)),name=related.length===1?related[0]:'all';const world=cache.worldForFocus(name);background.drawImage(world,mapBounds.x,mapBounds.y,mapBounds.width,mapBounds.height);placeLabels(element,view,camera.current.zoom,width,height,focus);element.dataset.zoomLevel=zoomLevel(camera.current.zoom);camera.current.dirty=false;}
 foreground.setTransform(1,0,0,1,0,0);foreground.clearRect(0,0,movingCanvas.current!.width,movingCanvas.current!.height);apply(foreground);
 let rendered=0;
 ordered.length=0;used=0;
 for(const scenery of cache.scenery)if(overlap(scenery,visible))queueDraw(scenery.depth,scenery.image,scenery.x,scenery.y,scenery.width,scenery.height,true,1);
 for(const unit of trafficUnits){
 const chain=simulation.chain(unit);
 for(let index=1;index<chain.length;index++){const leading=chain[index-1],following=chain[index];if(!leading.visible||!following.visible)continue;const rear=index===1?13:20,front=20,cosA=Math.cos(leading.heading),sinA=Math.sin(leading.heading),cosB=Math.cos(following.heading),sinB=Math.sin(following.heading),item=drawPool[used++];if(!item)throw new Error('Canvas link capacity exceeded');item.sprite=null;item.erase=false;item.depth=(leading.depth+following.depth)/2;item.opacity=linked(cityRoutes[unit.route].topic,focus)?1:.18;item.connector={x:leading.x-(cosA-sinA)*rear,y:leading.y-(cosA+sinA)*rear/2-4,toX:following.x+(cosB-sinB)*front,toY:following.y+(cosB+sinB)*front/2-4};ordered.push(item);}

 for(let carriage=chain.length-1;carriage>=0;carriage--){const point=chain[carriage];if(!point.visible)continue;const kind=carriage>0?'trailer':unit.kind==='semi'?'tractor':unit.kind,orientation=((Math.round(point.heading/(Math.PI*2)*articulatedAngles)%articulatedAngles)+articulatedAngles)%articulatedAngles,sprite=cache.vehicles.get(`${cityRoutes[unit.route].topic}-${kind}-${orientation}-${unit.waiting}`);if(!sprite)throw new Error(`Missing cached vehicle ${kind}`);
 const bounds={x:point.x+sprite.x,y:point.y+sprite.y,width:sprite.width,height:sprite.height};if(!overlap(bounds,visible))continue;
 const relevant=linked(cityRoutes[unit.route].topic,focus)&&!(unit.waiting&&focus?.kind==='terminal'&&!focus.producer&&focus.id!==cityRoutes[unit.route].terminal);
 queueDraw(point.depth,sprite.image,bounds.x,bounds.y,bounds.width,bounds.height,false,relevant?1:.18);if(carriage===0)rendered++;}
 }
 ordered.sort((a,b)=>a.depth-b.depth);
 for(const item of ordered){if(item.connector){const link=item.connector;foreground.globalCompositeOperation='source-over';foreground.globalAlpha=item.opacity;foreground.strokeStyle='#596b62';foreground.lineWidth=3;foreground.lineCap='round';foreground.beginPath();foreground.moveTo(link.x,link.y);foreground.lineTo(link.toX,link.toY);foreground.stroke();continue;}if(!item.sprite)throw new Error('Uninitialized raster draw item');foreground.globalCompositeOperation=item.erase?'destination-out':'source-over';foreground.globalAlpha=item.opacity;foreground.drawImage(item.sprite,item.bounds.x,item.bounds.y,item.bounds.width,item.bounds.height);}
 foreground.globalCompositeOperation='source-over';
 foreground.globalAlpha=1;
 if(campusDrag){const offset=project(campusDrag.du,campusDrag.dv);foreground.globalAlpha=.65;for(const sprite of cache.scenery)if(sprite.name===campusDrag.service)foreground.drawImage(sprite.image,sprite.x+offset.x,sprite.y+offset.y,sprite.width,sprite.height);foreground.globalAlpha=1;}
 for(const [id,service] of Object.entries(services))if(service.art==='Notification'){const building=cityBuildings[id],antenna=project(building.u+building.width*.75,building.v+building.depth*.3,195);foreground.globalAlpha=.6+.4*Math.sin(now*.003);foreground.fillStyle='#ffce63';foreground.beginPath();foreground.arc(antenna.x,antenna.y,6,0,Math.PI*2);foreground.fill();foreground.globalAlpha=1;}
 const selection=focus;
 if(selection)drawHighlights(foreground,selection,view.scale);
 const cost=performance.now()-started;drawSamples.push(cost);intervalSamples.push(interval);if(cameraMoved)panSamples.push(cost);if(drawSamples.length>120){drawSamples.shift();intervalSamples.shift();}if(panSamples.length>120)panSamples.shift();
 if(now-reported>1000){const average=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;const sorted=drawSamples.slice().sort((a,b)=>a-b);element.dataset.timings=JSON.stringify({frames:drawSamples.length,drawMeanMs:average(drawSamples),drawP95Ms:sorted[Math.floor(sorted.length*.95)],frameMeanMs:average(intervalSamples),panDrawMeanMs:panSamples.length?average(panSamples):null,panFrames:panSamples.length});reported=now;}
 element.dataset.renderMs=cost.toFixed(2);element.dataset.visibleVehicles=String(rendered);element.dataset.simulationTime=simulation.elapsed.toFixed(3);element.dataset.camera=`${camera.current.x.toFixed(1)},${camera.current.y.toFixed(1)},${camera.current.zoom.toFixed(2)}`;
 frame=requestAnimationFrame(animate);
 }catch(reason){setError(String(reason));console.error(reason);}
 }
 loadSpriteCache().then(sprites=>{if(cancelled)return;cache=sprites;setReady(true);last=performance.now();frame=requestAnimationFrame(animate);}).catch(reason=>{if(!cancelled){setError(String(reason));console.error(reason);}});
 return()=>{cancelled=true;cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener('pointerdown',down);element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',up);element.removeEventListener('pointercancel',cancel);element.removeEventListener('wheel',wheel);};
 },[]);
 return <div ref={host} className={`canvas-world${layoutMode?' layout-editing':''}`} role="img" aria-label="Interactive isometric Kafka city. Drag to pan, scroll to zoom, click buildings, gates, and roads."><canvas ref={staticCanvas} aria-hidden="true"/><canvas ref={movingCanvas} aria-hidden="true"/><CityLabels/>{hovered?.kind==='terminal'&&<div className="terminal-tooltip"><strong>{hovered.id}</strong><span>{hovered.name} · {hovered.topic}</span><span>{hovered.producer?producerById(hovered.id).instances:groupById(hovered.id).instances} bays{!hovered.producer?` · lag ${groupById(hovered.id).lag.toLocaleString()}`:''}</span></div>}{!ready&&!error&&<div className="canvas-message">Preparing city sprites…</div>}{error&&<div className="canvas-message" role="alert">City rendering stopped: {error}</div>}</div>;
}
