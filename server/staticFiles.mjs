import {readFile,stat} from 'node:fs/promises';
import {resolve,relative,isAbsolute,extname} from 'node:path';
const contentTypes={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2'};
export async function serveStatic(response,pathname,directory,method){
 if(!['GET','HEAD'].includes(method))return false;
 let decoded;try{decoded=decodeURIComponent(pathname);}catch{response.writeHead(400);response.end('Invalid URL encoding.');return true;}
 if(decoded.includes('\0')||decoded.includes('\\')){response.writeHead(400);response.end('Invalid file path.');return true;}
 const target=resolve(directory,`./${decoded==='/'?'index.html':decoded}`),inside=relative(directory,target);
 if(inside.startsWith('..')||isAbsolute(inside)){response.writeHead(403);response.end('File is outside the application directory.');return true;}
 const type=contentTypes[extname(target)];if(!type){response.writeHead(404);response.end('Unknown application file.');return true;}
 try{
  const information=await stat(target);if(!information.isFile()){response.writeHead(404);response.end('Application file not found.');return true;}
  const data=method==='HEAD'?null:await readFile(target);
  response.writeHead(200,{'Content-Type':type,'Content-Length':information.size,'Cache-Control':extname(target)==='.html'?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff'});response.end(data);
 }catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;response.writeHead(404);response.end('Application file not found.');}
 return true;
}
