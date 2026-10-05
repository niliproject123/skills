import {renderModel} from './scenarioRuntime';
export type Camera={x:number;y:number;zoom:number;dirty:boolean};
export function cameraTransform(width:number,height:number,camera:Camera){
 const bounds=renderModel.worldBounds,scale=Math.min(width/bounds.width,height/bounds.height)*camera.zoom;
 return {scale,x:width/2-(bounds.x+bounds.width/2-camera.x)*scale,y:height/2-(bounds.y+bounds.height/2-camera.y)*scale};
}
export function zoomLevel(zoom:number):'far'|'medium'|'close'{return zoom<.8?'far':zoom>1.35?'close':'medium';}
