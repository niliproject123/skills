# Task for the next session: validate against Docker Kafka

Use this existing Kafka City product; do not replace its renderer or add provider-specific code to the browser. Read [collector-setup.md](collector-setup.md).

Create a local Docker Kafka cluster and real producer/consumer applications representing at least three named services and two topics. Establish service relationships from those applications' actual configuration. Implement a collector in that environment using authorized Kafka/monitoring/application sources. Send real observations to the existing version-1 HTTP ingestion endpoint, including topic rates and group offset lag. Keep credentials and transient collector state out of Git.

Verify startup, discovery/mapping, sustained updates, a deliberately slowed consumer increasing lag, recovery, a stopped source becoming unknown/degraded, and stale detection after collector shutdown. Inspect the live map and selected-item values. Include topology changes if possible. Confirm sequence continuity after restarting your collector. Explain any offset-delta approximations or unavailable measurements.

Do not report locally generated fixture data as Kafka data. Do not weaken road rules to fit a topology. Report errors, exact commands to run the cluster/apps/collector, required credentials, provenance, actual verification results and remaining limitations. Any creation or integration not actually executed remains explicitly unverified.
