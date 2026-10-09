import {fileURLToPath} from 'node:url';
import {runProduct} from '../assets/app/server/runProduct.mjs';
await runProduct({appDirectory:fileURLToPath(new URL('../assets/app/dist/',import.meta.url)),instructionsFile:fileURLToPath(new URL('../references/collector-setup.md',import.meta.url))});
