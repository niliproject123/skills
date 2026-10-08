# Connect your environment to Kafka City

Give these instructions to the Codex/Claude session that can access your Kafka deployment. Kafka City does not require a provider SDK, broker changes, raw message access, or Kafka credentials. The session creates and runs a collector in your environment, using whichever monitoring sources you authorize.

## Start the product

From the Kafka City repository, run these in separate terminals:

```powershell
npm run server
npm run dev
```

Open http://localhost:5173/?live=1 to start directly in the live product, or open http://localhost:5173 and click **Connect live**. The ingestion API listens on **127.0.0.1:8787**. Vite proxies `/api` to it. This is a local development product; a production build needs a same-origin reverse proxy for the API and appropriate viewer authentication.

On first server startup without `KAFKA_CITY_INGEST_TOKEN`, the server generates an ingestion token in `.kafka-city/access-token.txt` and reuses it on later starts. This directory is ignored by Git. An environment-provided token must contain at least 24 characters. Never include the token in a committed file, browser bundle, URL, screenshot, or collector logs.

The server stays local. A collector running elsewhere can use an authenticated SSH tunnel to this endpoint. A Docker collector can run on the host or use an explicitly configured host/tunnel connection; `localhost` inside a container is not the host. Do not expose the ingestion server publicly without a secured gateway. One server/storage directory represents one cluster.

## Instructions for the using session

1. Inspect the available access: Prometheus queries/exporter labels, CloudWatch/MSK metrics, Kafka APIs, application instrumentation, configuration, or a custom source. Ask for missing credentials or authorization; keep them in the source environment.
2. Establish the actual topology: service → produced topic, and consumer group → service/subscribed topics. Use explicit application configuration or instrumentation where monitoring cannot identify producers. Do not invent service relationships from naming conventions. Mark provenance in your collector documentation.
3. Assign stable IDs starting with a letter, using letters, digits, dot, underscore, or hyphen, at most 80 characters. Preserve actual Kafka topic/group names in `name`. IDs need not equal Kafka names.
4. Create a small collector that sends a **complete snapshot** every 5–10 seconds. No provider-specific code belongs in the map. Use a sustained process/service; the agent session does not need to remain open.
5. Every topic and group must have a metrics record. Use `null` for unavailable values; use `0` only for an observed zero. Do not retain old measurements under a new timestamp after collection fails. Send nulls for failed fields and `status: degraded/error` with the reason. Keep the last verified topology when discovery fails, and explain that failure.
6. Use `PUT /api/v1/map`, `Content-Type: application/json`, `Authorization: Bearer TOKEN`. Read the response and report failures. On a 409, inspect the current sequence; do not silently switch clusters or discard validation errors. A simultaneous save returns a retryable 409 with an explicit message.
7. Verify the accepted snapshot with `GET /api/v1/map` and inspect the actual live map. Report which sources were used, unavailable fields, collection interval, topology scope, and any unverified behavior. **Never describe synthetic observations as real Kafka data.**

## Payload, version 1

```json
{
  "version": 1,
  "sequence": 1,
  "cluster": {"id": "my-cluster", "name": "My Kafka cluster"},
  "observedAt": "2026-10-08T12:00:00.000Z",
  "topology": {
    "services": [{"id": "checkout", "name": "Checkout"}, {"id": "billing", "name": "Billing"}],
    "topics": [{"id": "orders", "name": "orders", "partitionCount": 2}],
    "producers": [{"id": "checkout-orders", "serviceId": "checkout", "topicId": "orders", "producerCount": 1}],
    "consumerGroups": [{"id": "billing-orders", "name": "billing-orders", "serviceId": "billing", "topicIds": ["orders"], "consumerCount": 2}]
  },
  "metrics": {
    "topics": {"orders": {"messagesPerSecond": 180, "averageMessageBytes": 512, "source": "application-metrics"}},
    "consumerGroups": {"billing-orders": {"consumptionRate": 160, "lag": 120, "source": "consumer-monitoring"}}
  },
  "status": {"state": "ok", "message": ""}
}
```

This example is synthetic. Replace its timestamp, names, topology and measurements with real observations. `observedAt` is the observation time, not merely the upload time. All fields should describe the same collection interval. Timestamp must be within the last 24 hours and no more than 30 seconds in the future. `sequence` must strictly increase for the cluster, including after collector/server restarts. Read the latest saved sequence before resuming. Observation timestamps must not move backward.

`messagesPerSecond` is total topic production rate. `consumptionRate` is total group rate across its subscribed topics. `lag` is the summed nonnegative **offset distance** across that group's subscriptions/partitions, not necessarily a literal message count for compacted/transactional topics. `averageMessageBytes` is optional and nullable. State `source` briefly and accurately for each record. Rates may be fractional; lag must be an integer. Do not substitute time lag for offset lag or bytes/sec for messages/sec. If calculating offset deltas as a rate, document that approximation and resets; send null when it is invalid.

`producerCount` and `consumerCount` are known instance counts, from 0–32. A disconnected group can report 0 consumers. The map keeps at least one physical dock to represent its configured relationship, while the inspector displays the reported zero. If instance counts are unavailable, establish configured counts explicitly and document their meaning; do not guess current replicas.

Map limits: 16 services, 64 topics, 64 producers/groups each, 32 partitions/topic, 16 topics/group and 128 total producer-to-group rendered connections. Maximum payload 1 MiB. Submit an explicitly scoped topology if the cluster exceeds these limits; never silently truncate it. Layout retains all spacing/clearance rules and can reject topologies it cannot fit. API acceptance validates the data contract; the browser separately reports layout/rendering errors.

## Send a prepared JSON file

```powershell
$ingestionToken = (Get-Content .kafka-city/access-token.txt -Raw).Trim()
Invoke-RestMethod -Method Put -Uri http://127.0.0.1:8787/api/v1/map `
  -Headers @{Authorization="Bearer $ingestionToken"} `
  -ContentType application/json -InFile snapshot.json
```

GET `/api/v1/health` reports server readiness; GET `/api/v1/map` returns `{snapshot, receivedAt}`, initially null. GET `/api/v1/events` streams these envelopes as SSE `snapshot` events and heartbeat comments. Writes require the ingestion token. Read endpoints are accessible locally without a token; cross-origin browser access is denied except the local Vite origins. Saved snapshots are in `.kafka-city/snapshot.json`. Corrupt saved data stops startup with an error, rather than replacing it silently.

## What the product displays

The map explicitly distinguishes simulated demo mode and live mode. No fresh observation for 30 seconds marks the data stale. Collector failures and connection failures are visible. Unknown throughput suppresses illustrative traffic; unknown lag shows **Unknown**, never zero. Vehicles summarize throughput using configured visual capacities, not individual observed messages or measured message-size distributions. Average message bytes appear in the inspector; they do not currently determine vehicle silhouettes.

Selecting an object shows its latest reported values, source where available, timestamp and sequence. Topic throughput is shared; it is not attributed individually to producer services. Live mode has no scenario-editing controls. Demo mode keeps test configuration collapsed. View filters do not alter topology or layout, and sign/gauge visibility has Automatic/Always/Hidden controls.

Real Kafka/Prometheus/AWS integration is unverified in this repository until the using session actually runs and checks its collector against the environment. Local tests use explicitly synthetic data through the actual HTTP server and browser.
