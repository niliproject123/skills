import {useEffect,useState} from 'react';
export function RuntimeNotice(){
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
 const report=(event:ErrorEvent)=>setError(event.message);
 const rejected=(event:PromiseRejectionEvent)=>setError(String(event.reason));
 window.addEventListener('error',report);window.addEventListener('unhandledrejection',rejected);
 return()=>{window.removeEventListener('error',report);window.removeEventListener('unhandledrejection',rejected);};
 },[]);
 return error?<div role="alert" style={{position:'absolute',top:95,left:32,right:32,zIndex:10,background:'#fff1df',color:'#8d3028',padding:16,border:'2px solid #c35a43',borderRadius:8}}>City error: {error}. Reload after the issue is resolved.</div>:null;
}
