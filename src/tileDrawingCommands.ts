export type DrawingCommand={tag:string;attributes:Record<string,string>;children:DrawingCommand[]};
export type DrawingLayer={commands:DrawingCommand[];masks:Record<string,DrawingCommand[]>};
export function tileDrawingCommands(markup:string):DrawingLayer{
 const document=new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,'image/svg+xml');
 if(document.querySelector('parsererror'))throw new Error('Cannot parse static map artwork.');
 const masks:Record<string,DrawingCommand[]>={};
 const convert=(element:Element):DrawingCommand=>{
  const tag=element.localName;
  if(!['g','path','polygon','polyline','rect','defs','mask'].includes(tag))throw new Error(`Unsupported static map artwork: ${tag}.`);
  const attributes=Object.fromEntries([...element.attributes].map(attribute=>[attribute.name,attribute.value]));
  const children=[...element.children].map(convert);
  if(tag==='mask')masks[attributes.id]=children;
  return {tag,attributes,children};
 };
 return {commands:[...document.documentElement.children].map(convert),masks};
}
