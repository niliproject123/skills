import type {Broker,PartitionPlacement} from './scenarioTypes';
export const demoBrokers:Broker[]=Array.from({length:5},(_,index)=>({id:`broker-${index+1}`,name:`Broker ${index+1}`,rack:`rack-${Math.floor(index/2)+1}`,zone:`az-${'abc'[Math.floor(index/2)]}`}));
export const ordersPlacement:PartitionPlacement[]=[
 {partitionId:0,leaderBrokerId:'broker-1',replicaBrokerIds:['broker-1','broker-3','broker-5'],inSyncReplicaBrokerIds:['broker-1','broker-3','broker-5']},
 {partitionId:1,leaderBrokerId:'broker-2',replicaBrokerIds:['broker-2','broker-4','broker-5'],inSyncReplicaBrokerIds:['broker-2','broker-4','broker-5']},
 {partitionId:2,leaderBrokerId:'broker-2',replicaBrokerIds:['broker-1','broker-2','broker-5'],inSyncReplicaBrokerIds:['broker-1','broker-2','broker-5']},
 {partitionId:3,leaderBrokerId:'broker-3',replicaBrokerIds:['broker-2','broker-3','broker-4'],inSyncReplicaBrokerIds:['broker-2','broker-3','broker-4']}
];
