import type {Bridge,Point} from './scenarioTypes';
type Shape=Pick<Bridge,'u'|'v'|'start'|'ramp'|'deck'|'height'|'axis'>;
export const bridgeAxis=(bridge:Pick<Bridge,'axis'>)=>bridge.axis??'v';
export const bridgeEnd=(bridge:Shape)=>bridge.start+bridge.ramp*2+bridge.deck;
export const bridgePosition=(bridge:Shape,point:Point)=>bridgeAxis(bridge)==='u'?point.u:point.v;
export const bridgeAcross=(bridge:Shape,point:Point)=>bridgeAxis(bridge)==='u'?point.v-bridge.v:point.u-bridge.u;
export const bridgePoint=(bridge:Shape,along:number,across=0):Point=>bridgeAxis(bridge)==='u'?{u:along,v:bridge.v+across}:{u:bridge.u+across,v:along};
export function bridgeHeight(bridge:Shape,along:number){return Math.max(0,Math.min(1,(along-bridge.start)/bridge.ramp,(bridgeEnd(bridge)-along)/bridge.ramp))*bridge.height;}
