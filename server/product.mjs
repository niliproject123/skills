import {fileURLToPath} from 'node:url';
import {runProduct} from './runProduct.mjs';
await runProduct({appDirectory:fileURLToPath(new URL('../dist/',import.meta.url)),instructionsFile:fileURLToPath(new URL('../discussions/kafka-city/collector-setup.md',import.meta.url))});
