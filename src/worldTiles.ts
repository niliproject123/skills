import type {Bounds,Sprite} from './canvasSprites';

export const tilePixels=512,tilePadding=4,tileBudgetBytes=96*1024*1024;
export const overlaps=(a:Bounds,b:Bounds)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
export function visibleTiles(bounds:Bounds,visible:Bounds,pixelsPerUnit:number){
 const resolution=2**Math.ceil(Math.log2(pixelsPerUnit)),size=tilePixels/resolution;
 const left=Math.max(bounds.x,visible.x),top=Math.max(bounds.y,visible.y);
 const right=Math.min(bounds.x+bounds.width,visible.x+visible.width),bottom=Math.min(bounds.y+bounds.height,visible.y+visible.height);
 const result:(Bounds&{resolution:number;key:string})[]=[];
 if(right<=left||bottom<=top)return result;
 for(let row=Math.floor(top/size);row<Math.ceil(bottom/size);row++)for(let column=Math.floor(left/size);column<Math.ceil(right/size);column++)result.push({x:column*size,y:row*size,width:size,height:size,resolution,key:`${resolution}/${column}/${row}`});
 return result;
}
type Tile=ReturnType<typeof visibleTiles>[number]&{focus:string};
export function createWorldTiles(bounds:Bounds,render:(tile:Tile)=>Promise<Sprite>){
 const images=new Map<string,Sprite>(),pending=new Set<string>();
 let queue:Tile[]=[],wanted=new Set<string>(),active=0,disposed=false,failure:Error|undefined;
 let updated=()=>{};
 const bytesPerTile=(tilePixels+tilePadding*2)**2*4;
 const maximum=Math.floor(tileBudgetBytes/bytesPerTile);
 const identity=(tile:Tile)=>`${tile.focus}/${tile.key}`;
 const release=(sprite:Sprite)=>{sprite.image.width=0;sprite.image.height=0;};
 function pump(){
  while(!disposed&&!failure&&active<2&&queue.length){
   const tile=queue.shift()!,key=identity(tile);if(!wanted.has(key)||images.has(key)||pending.has(key))continue;
   active++;pending.add(key);
   void render(tile).then(sprite=>{
    if(disposed||!wanted.has(key)){release(sprite);return;}
    while(images.size>=maximum){const oldest=[...images.keys()].find(item=>!wanted.has(item));if(!oldest)throw new Error('Visible map tiles exceed the cache byte budget. Reduce the browser window size.');release(images.get(oldest)!);images.delete(oldest);}
    images.set(key,sprite);
   }).catch(reason=>{if(disposed)return;failure=reason instanceof Error?reason:new Error(String(reason));console.error(failure);}).finally(()=>{active--;pending.delete(key);if(!disposed){updated();pump();}});
  }
 }
 return {
  draw(drawing:CanvasRenderingContext2D,visible:Bounds,pixelsPerUnit:number,focus:string,onUpdate:()=>void){
   if(failure)throw failure;
   if(disposed)throw new Error('Map tile cache was disposed.');
   updated=onUpdate;
   const tiles=visibleTiles(bounds,visible,pixelsPerUnit).map(tile=>({...tile,focus}));
   if(tiles.length>maximum)throw new Error('Visible map tiles exceed the cache byte budget. Reduce the browser window size.');
   wanted=new Set(tiles.map(identity));queue=tiles.filter(tile=>!images.has(identity(tile))&&!pending.has(identity(tile)));
   let missing=0;
   for(const tile of tiles){const key=identity(tile),sprite=images.get(key);if(!sprite){missing++;continue;}images.delete(key);images.set(key,sprite);drawing.drawImage(sprite.image,tilePadding,tilePadding,tilePixels,tilePixels,tile.x,tile.y,tile.width,tile.height);}
   pump();return {missing,bytes:images.size*bytesPerTile,pending:active};
  },
  dispose(){disposed=true;queue=[];for(const sprite of images.values())release(sprite);images.clear();},
 };
}
