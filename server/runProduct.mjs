import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startMapServer} from './mapServer.mjs';

export async function runProduct({appDirectory,instructionsFile,arguments:argumentsList=process.argv.slice(2)}){
 const [major,minor]=process.versions.node.split('.').map(Number);if(major<20||major===20&&minor<19)throw new Error('Kafka City requires Node.js 20.19 or newer.');
 let port=Number(process.env.KAFKA_CITY_PORT??8787),storageDirectory=resolve(process.env.KAFKA_CITY_DATA_DIRECTORY??'.kafka-city');
 for(let index=0;index<argumentsList.length;index++){
  const option=argumentsList[index];
  if(option==='--help'){console.log('Kafka City: node scripts/run.mjs [--port 8787] [--data ./map-data]\nOpen the printed local URL. Token and saved map are stored in the data directory.\nOptional environment: KAFKA_CITY_PORT, KAFKA_CITY_DATA_DIRECTORY, KAFKA_CITY_INGEST_TOKEN.');return null;}
  if(!['--port','--data'].includes(option))throw new Error(`Unknown option ${option}. Use --help.`);
  const value=argumentsList[++index];if(!value||value.startsWith('--'))throw new Error(`${option} requires a value.`);
  if(option==='--port')port=Number(value);else storageDirectory=resolve(value);
 }
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Port must be an integer from 1 to 65535.');
 // Validate the package before generating credentials or opening a socket.
 await readFile(resolve(appDirectory,'index.html'));await readFile(instructionsFile);
 const running=await startMapServer({port,storageDirectory,token:process.env.KAFKA_CITY_INGEST_TOKEN,appDirectory,instructionsFile});
 console.log(`Kafka City: http://localhost:${running.port}/?live=1\nCollector endpoint: http://127.0.0.1:${running.port}/api/v1/map\nData directory: ${storageDirectory}\nIngestion credential: KAFKA_CITY_INGEST_TOKEN or ${resolve(storageDirectory,'access-token.txt')}\nPress Ctrl+C to stop.`);
 const stop=()=>{void running.close().catch(error=>{console.error('Kafka City could not stop:',error);process.exitCode=1;});};
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 return running;
}
