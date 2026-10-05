// World axes always project at ±26.565°; height stays vertical.
export type GroundPoint = {u:number;v:number};
export type Direction = 'east'|'west'|'south'|'north';
export const project = (u:number,v:number,height=0) => ({x:u-v,y:(u+v)/2-height});
export const vertices = (points:number[][]) => points.map(([u,v,height=0])=>{const point=project(u,v,height);return `${point.x},${point.y}`;}).join(' ');
export const screenPosition = (point:GroundPoint) => {const screen=project(point.u,point.v);return `translate(${screen.x},${screen.y})`;};
export function orient(long:number,across:number,direction:Direction):[number,number] {
 switch(direction){case 'east':return [long,across];case 'west':return [-long,-across];case 'south':return [-across,long];case 'north':return [across,-long];}
}
