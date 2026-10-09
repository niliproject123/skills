import {createServer} from 'node:http';
import {timingSafeEqual,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {validateMapSnapshot,PayloadError} from '../shared/mapProtocol.mjs';
import {serveStatic} from './staticFiles.mjs';
import {fileURLToPath} from 'node:url';

export async function startMapServer({port=8787,token,storageDirectory=resolve('.kafka-city'),appDirectory,instructionsFile=fileURLToPath(new URL('../discussions/kafka-city/collector-setup.md',import.meta.url))}={}){
 await mkdir(storageDirectory,{recursive:true});
 if(!token){const tokenPath=resolve(storageDirectory,'access-token.txt');try{token=(await readFile(tokenPath,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw new Error(`Cannot read ingestion token: ${error.message}`);token=randomBytes(32).toString('hex');await writeFile(tokenPath,token,{mode:0o600});}}
 if(token.length<24)throw new Error('KAFKA_CITY_INGEST_TOKEN must contain at least 24 characters.');
 let latest=null,receivedAt=null;const subscribers=new Set();
 const savedPath=resolve(storageDirectory,'snapshot.json');
 try{const saved=JSON.parse(await readFile(savedPath,'utf8'));latest=validateMapSnapshot(saved.snapshot,Date.parse(saved.snapshot.observedAt));receivedAt=saved.receivedAt;if(!Number.isFinite(Date.parse(receivedAt)))throw new Error('Invalid persisted receipt timestamp');}catch(error){if(error.code!=='ENOENT')throw new Error(`Cannot load saved map: ${error.message}`);}
 const envelope=()=>({snapshot:latest,receivedAt});
 const send=(response,code,value)=>{response.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(JSON.stringify(value));};
 const matches=supplied=>{const a=Buffer.from(supplied??''),b=Buffer.from(`Bearer ${token}`);return a.length===b.length&&timingSafeEqual(a,b);};
 const server=createServer(async(request,response)=>{
  try{
   const origin=request.headers.origin,currentPort=server.address().port;if(origin&&!['http://localhost:5173','http://127.0.0.1:5173',`http://localhost:${currentPort}`,`http://127.0.0.1:${currentPort}`].includes(origin)){send(response,403,{error:'Origin is not allowed.'});return;}
   const path=new URL(request.url,'http://localhost').pathname;
   if(path==='/api/v1/health'&&request.method==='GET'){send(response,200,{ok:true,hasSnapshot:!!latest,receivedAt,subscribers:subscribers.size});return;}
   if(path==='/api/v1/map'&&request.method==='GET'){send(response,200,envelope());return;}
   if(path==='/api/v1/instructions'&&request.method==='GET'){const instructions=await readFile(instructionsFile,'utf8');response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});response.end(instructions);return;}
   if(path==='/api/v1/events'&&request.method==='GET'){
    if(subscribers.size>=32){send(response,503,{error:'Too many live viewers.'});return;}
    response.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Content-Type-Options':'nosniff'});response.write(`event: snapshot\ndata: ${JSON.stringify(envelope())}\n\n`);subscribers.add(response);request.on('close',()=>subscribers.delete(response));return;
   }
   if(!path.startsWith('/api/')&&appDirectory&&await serveStatic(response,path,appDirectory,request.method))return;
   if(path!=='/api/v1/map'||request.method!=='PUT'){send(response,404,{error:'Unknown endpoint or method.'});return;}
   if(!matches(request.headers.authorization)){send(response,401,{error:'A valid ingestion bearer token is required.'});return;}
   if(!request.headers['content-type']?.startsWith('application/json')){send(response,415,{error:'Content-Type must be application/json.'});return;}
   let size=0;const chunks=[];for await(const chunk of request){size+=chunk.length;if(size>1024*1024){send(response,413,{error:'Snapshot exceeds 1 MiB.'});return;}chunks.push(chunk);}
   let candidate;try{candidate=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new PayloadError('Body must be valid JSON.');}
   const snapshot=validateMapSnapshot(candidate);
   if(latest&&snapshot.cluster.id!==latest.cluster.id){send(response,409,{error:'This server belongs to another cluster. Use a separate storage directory/server.'});return;}
   if(latest&&snapshot.sequence<=latest.sequence){send(response,409,{error:`sequence must be greater than ${latest.sequence}.`});return;}
   if(latest&&Date.parse(snapshot.observedAt)<Date.parse(latest.observedAt)){send(response,409,{error:'observedAt must not move backward.'});return;}
   const receipt=new Date().toISOString(),next={snapshot,receivedAt:receipt};
   await writeFile(`${savedPath}.tmp`,JSON.stringify(next));await rename(`${savedPath}.tmp`,savedPath);
   latest=snapshot;receivedAt=receipt;
   for(const viewer of subscribers){if(!viewer.write(`event: snapshot\ndata: ${JSON.stringify(next)}\n\n`)){viewer.destroy();subscribers.delete(viewer);}}
   send(response,200,{accepted:true,sequence:snapshot.sequence,receivedAt});
  }catch(error){const code=error instanceof PayloadError?400:500;if(code===500)console.error('Map server request failed:',error);if(!response.headersSent)send(response,code,{error:error.message});else response.destroy();}
 });
 // Serialize writes: sequence checking and atomic persistence are one transaction.
 let saving=false;
 const handler=server.listeners('request')[0];server.removeAllListeners('request');server.on('request',(request,response)=>{if(request.method==='PUT'){if(saving){send(response,409,{error:'An update is being saved. Retry this sequence.'});return;}saving=true;Promise.resolve(handler(request,response)).finally(()=>{saving=false;});}else void handler(request,response);});
 const heartbeat=setInterval(()=>{for(const viewer of subscribers)if(!viewer.write(': heartbeat\n\n')){viewer.destroy();subscribers.delete(viewer);}},15000);heartbeat.unref();
 await new Promise((accept,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',accept);});
 return {server,port:server.address().port,async close(){clearInterval(heartbeat);for(const viewer of subscribers)viewer.end();await new Promise((accept,reject)=>server.close(error=>error?reject(error):accept()));}};
}
