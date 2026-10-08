import type {Bounds} from './canvasSprites';
import {overlaps} from './worldTiles';

type ObjectBounds={depth:number;bounds:Bounds};
export function indexMovingObjects(objects:ObjectBounds[],visible:Bounds){
 const cells=new Map<string,ObjectBounds[]>(),size=128;
 const keys=(bounds:Bounds)=>{const result:string[]=[];for(let row=Math.floor(bounds.y/size);row<Math.ceil((bounds.y+bounds.height)/size);row++)for(let column=Math.floor(bounds.x/size);column<Math.ceil((bounds.x+bounds.width)/size);column++)result.push(`${column}/${row}`);return result;};
 for(const object of objects)if(overlaps(object.bounds,visible))for(const key of keys(object.bounds)){let cell=cells.get(key);if(!cell){cell=[];cells.set(key,cell);}cell.push(object);}
 return (scenery:Bounds&{depth:number})=>{
  const found=new Set<ObjectBounds>();for(const key of keys(scenery))for(const object of cells.get(key)??[])if(object.depth<scenery.depth&&overlaps(object.bounds,scenery))found.add(object);
  return [...found].map(object=>object.bounds);
 };
}
