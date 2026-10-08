import {startMapServer} from './mapServer.mjs';
const port=Number(process.env.KAFKA_CITY_PORT??8787);
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('KAFKA_CITY_PORT must be an integer from 1 to 65535.');
const running=await startMapServer({port,token:process.env.KAFKA_CITY_INGEST_TOKEN,storageDirectory:process.env.KAFKA_CITY_DATA_DIRECTORY});
console.log(`Kafka City ingestion server: http://127.0.0.1:${running.port}. Ingestion token: environment variable or .kafka-city/access-token.txt. No Kafka credentials are stored here.`);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{void running.close().catch(error=>{console.error(error);process.exitCode=1;});});
