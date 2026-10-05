import {IsoBuilding} from './IsoBuilding';
import {IsoRoad} from './IsoRoad';
import {IsoCar,IsoTruck,IsoSemi} from './IsoVehicle';
import {IsoTree,IsoRoadSign} from './IsoPrimitives';
import {screenPosition} from './isometric';
export function StyleTest(){return <g transform="translate(730,240) scale(1.4)"><IsoRoad label="Four partition style test" segments={[{from:{u:75,v:430},to:{u:75,v:125},lanes:4}]}/><IsoTree u={210} v={210}/><IsoRoadSign u={155} v={380} label="4 PARTITIONS"/>{[0,1,2,3,4].map(index=><g key={index} transform={screenPosition({u:44+(index%2)*22,v:160+Math.floor(index/2)*54})}>{index%2?<IsoTruck direction="north" waiting/>:<IsoCar direction="north" waiting/>}</g>)}<g transform={screenPosition({u:100,v:360})}><IsoSemi direction="north"/></g><g transform={screenPosition({u:100,v:285})}><IsoTruck direction="north"/></g><g transform={screenPosition({u:100,v:235})}><IsoCar direction="north"/></g><IsoBuilding name="Payment" gateCount={3} layout={{u:0,v:0,width:150,depth:110}} onSelect={()=>{}}/></g>;}
