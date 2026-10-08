import {useEffect,useRef,useState} from 'react';
import {validateMapSnapshot,type MapSnapshot} from '../shared/mapProtocol.mjs';
export type LiveConnection={enabled:boolean;connected:boolean;snapshot:MapSnapshot|null;receivedAt:string|null;error:string;stale:boolean;waiting:boolean};
export function useLiveConnection(enabled:boolean,onSnapshot:(snapshot:MapSnapshot)=>Promise<void>):LiveConnection{
 const [state,setState]=useState<LiveConnection>({enabled:false,connected:false,snapshot:null,receivedAt:null,error:'',stale:false,waiting:false});
 const handler=useRef(onSnapshot);handler.current=onSnapshot;
 useEffect(()=>{
  if(!enabled){setState({enabled:false,connected:false,snapshot:null,receivedAt:null,error:'',stale:false,waiting:false});return;}
  let stopped=false,busy=false,acceptedSequence=0,pending:{snapshot:MapSnapshot;receivedAt:string}|null=null;
  setState({enabled:true,connected:false,snapshot:null,receivedAt:null,error:'',stale:false,waiting:true});
  const stream=new EventSource('/api/v1/events');
  const process=async()=>{if(busy)return;busy=true;try{while(pending&&!stopped){const next=pending;pending=null;try{await handler.current(next.snapshot);if(stopped)return;acceptedSequence=next.snapshot.sequence;setState(previous=>({...previous,snapshot:next.snapshot,receivedAt:next.receivedAt,error:'',waiting:false}));}catch(reason){if(!stopped)setState(previous=>({...previous,error:`Cannot apply live map: ${String(reason)}`,waiting:false}));}}}finally{busy=false;}};
  stream.onopen=()=>{if(!stopped)setState(previous=>({...previous,connected:true,error:''}));};
  stream.onerror=()=>{if(!stopped)setState(previous=>({...previous,connected:false,error:'Live server connection failed. Reconnecting; displayed values may be stale.'}));};
  stream.addEventListener('snapshot',event=>{if(stopped)return;try{const envelope=JSON.parse((event as MessageEvent).data);if(envelope.snapshot===null){setState(previous=>({...previous,waiting:true}));return;}const snapshot=validateMapSnapshot(envelope.snapshot,Date.parse(envelope.snapshot.observedAt));if(!Number.isFinite(Date.parse(envelope.receivedAt)))throw new Error('Server receipt timestamp is invalid.');if(snapshot.sequence<=acceptedSequence)return;pending={snapshot,receivedAt:envelope.receivedAt};void process();}catch(reason){setState(previous=>({...previous,error:`Invalid server update: ${String(reason)}`}));}});
  const clock=setInterval(()=>setState(previous=>({...previous,stale:!!previous.snapshot&&Date.now()-Date.parse(previous.snapshot.observedAt)>30000})),1000);
  return()=>{stopped=true;pending=null;stream.close();clearInterval(clock);};
 },[enabled]);
 return state;
}
