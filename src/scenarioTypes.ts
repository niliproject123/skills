export type Point={u:number;v:number};
export type Placement=Point&{width?:number;depth?:number};
export type VehicleClass='car'|'van'|'truck'|'semi';
export type Broker={id:string;name:string;rack?:string;zone?:string};
export type PartitionPlacement={partitionId:number;leaderBrokerId:string|null;replicaBrokerIds:string[];inSyncReplicaBrokerIds:string[]|null};
export type ClusterConfig={brokers:Broker[];placementMode?:'demo'|'reported'};
export type ClusterModel={brokers:Broker[];partitions:Record<string,PartitionPlacement[]>;placementMode:'demo'|'reported'};
export type TopologyModel={
 services:{id:string;name:string}[];
 topics:{id:string;name:string;partitionCount:number;replicationFactor?:number;partitions?:PartitionPlacement[]}[];
 producers:{id:string;serviceId:string;topicId:string;producerCount:number}[];
 consumerGroups:{id:string;name:string;serviceId:string;topicIds:string[];consumerCount:number}[];
};
export type RuntimeSnapshot={
 topics:Record<string,{messagesPerSecond:number;partitionOverrides?:Record<string,number>}>;
 consumerGroups:Record<string,{consumptionRate:number;lag:number}>;
};
export type Bridge=Point&{axis?:'u'|'v';routeId?:string;id:string;topic:string;height:number;start:number;ramp:number;deck:number;depth:number;lanes:number};
export type LayoutModel={
 labels?:Record<string,{labelAnchor:{x:number;y:number};labelOffset:{x:number;y:number}}>;
 services:Record<string,Placement>;
 terminals:Record<string,Partial<Placement>&{wall?:'front'|'side';side?:'north'|'south'|'east'|'west';offset?:number}>;
 topics:Record<string,{waypoints?:Point[];branches?:Record<string,Point[]>}>;
 routes:Record<string,{waypoints:Point[];branch?:boolean}>;
 overpasses:Omit<Bridge,'depth'|'lanes'>[];
 terrainOutline?:number[][];
 worldBounds?:{x:number;y:number;width:number;height:number};
};
export type VisualEncodingConfig={
 labels?:{serviceSize:number;topicSize:number;poleLength:number;offsetX:number;offsetY:number};
 vehicles:Record<VehicleClass,{messagesPerVehicle:number}> & {trailer:{messagesPerTrailer:number}};
 thresholds:{car:number;van:number;truck:number;semi:number};
 maxTrailers:number;maxVehiclesPerLane:number;maxVehiclesPerTopic:number;maxQueueVehicles:number;maxVehiclesTotal:number;
 messagesPerQueueVehicle:number;trafficWindowSeconds:number;
 topicColors:Record<string,string>;
 serviceStyles:Record<string,{color:string;palette?:[string,string,string];art?:'Orders'|'Payment'|'Analytics'|'Notification'|'Office'}>;
};
export type ScenarioConfig={version:1;metadata:{id:string;name:string};cluster?:ClusterConfig;topology:TopologyModel;state:RuntimeSnapshot;layout:LayoutModel;visualization:VisualEncodingConfig};
export type LayoutConfiguration=Pick<ScenarioConfig,'topology'|'layout'>;
export type Terminal=Point&{topicOffsets?:Record<string,number>;id:string;name:string;width:number;depth:number;wall:'front'|'side';producer:boolean;service:string;topics:string[];instances:number};
export type Route={id:string;topic:string;destination:string;terminal:string;points:Point[];lanes:number;moving:number;queue:number;consumeEvery:number;laneTraffic:number[];queueLanes:number[]};
export type PartitionVisual={id:number;rate:number;kind:VehicleClass;trailers:number;frequency:number;messagesPerVehicle:number};
export type ServiceVisual={name:string;color:string;palette:[string,string,string];art:string;produces:string[];consumes:string[];producers:number;consumers:number;lag:number};
export type GroupVisual={id:string;name:string;service:string;topics:string[];instances:number;lag:number;consumptionRate:number;incomingRate:number;status:'catching up'|'stable'|'falling behind';waiting:number;consumeEvery:number};
export type DerivedRenderModel={
 cluster:ClusterModel;
 labelAnchors:Record<string,{u:number;v:number;rise:number;offsetX:number;offsetY:number}>;
 services:Record<string,ServiceVisual>;
 topics:Record<string,{name:string;partitions:number;throughput:string;messagesPerSecond:number;producers:number;groups:number}>;
 producers:{id:string;service:string;topic:string;instances:number}[];
 consumerGroups:GroupVisual[];
 partitionLoads:Record<string,PartitionVisual[]>;
 cityBuildings:Record<string,Point&{width:number;depth:number}>;
 terminals:Terminal[];cityRoutes:Route[];overpasses:Bridge[];
 themes:Record<string,{accent:string;front:string;side:string;light:string}>;
 terrainOutline:number[][];worldBounds:{x:number;y:number;width:number;height:number};
 visualization:VisualEncodingConfig;
};
