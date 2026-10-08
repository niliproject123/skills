import type {LiveConnection} from './useLiveConnection';
export function LiveStatus({connection}:{connection:LiveConnection}){
 if(!connection.enabled)return null;
 const failure=connection.error||connection.snapshot?.status.state!=='ok'&&connection.snapshot?.status.message;
 return <div className="live-status" role={failure||connection.stale?'alert':'status'}><strong>{connection.waiting?'Waiting for your collector':!connection.connected?'Disconnected':connection.stale?'Stale data':'Live data'}</strong>
 {connection.snapshot&&<span>{connection.snapshot.cluster.name} · observed {new Date(connection.snapshot.observedAt).toLocaleTimeString()} · #{connection.snapshot.sequence}</span>}
 {failure&&<span>{failure}</span>}{connection.stale&&<span>No fresh observation within 30 seconds. Values are historical.</span>}
 {connection.waiting&&<span>Send a snapshot to PUT /api/v1/map. <a href="/discussions/kafka-city/collector-setup.md" target="_blank" rel="noreferrer">Collector setup instructions</a></span>}
 </div>;
}
