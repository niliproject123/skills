const host=document.getElementById('root');
if(!host)throw new Error('Kafka City requires its root element.');
host.textContent='Loading Kafka City…';
void import('./main').catch(reason=>{
 console.error('Kafka City startup failed:',reason);
 const message=document.createElement('section');
 message.setAttribute('role','alert');
 message.style.cssText='margin:32px;padding:24px;font:16px system-ui;background:#fff1df;color:#8d3028;border:2px solid #c35a43;border-radius:8px;white-space:pre-wrap';
 const title=document.createElement('h1');title.textContent='Kafka City could not start';
 const details=document.createElement('p');details.textContent=reason instanceof Error?reason.message:String(reason);
 const reload=document.createElement('button');reload.textContent='Reload';reload.onclick=()=>location.reload();
 message.append(title,details,reload);host.replaceChildren(message);
});
