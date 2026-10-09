---
name: kafka-city
description: Run the bundled Kafka City map and connect it to a user's Kafka environment through a collector using their available monitoring or application sources.
---

# Kafka City

Use this skill when the user wants to visualize their Kafka system with the bundled isometric map. It contains a runnable product and a provider-independent ingestion contract. Do not replace the renderer or require direct broker access when another authorized source is available.

## Run the product

From this skill folder, run `node scripts/run.mjs --data <user-chosen-data-directory>`. Node.js 20.19+ is required; the downloadable ZIP contains the compiled map and needs no npm install or Vite. Use `--port <number>` when 8787 is occupied. Keep the process running for the user; use a hidden process/service for background execution. Open the printed URL ending in `/?live=1`.

If this is a source checkout rather than the downloadable bundle, run `npm run package:skill` from the repository root and extract its ZIP first. Missing runtime assets are a packaging error, not a reason to substitute a different implementation.

## Adapt to the user's system

Read [the collector contract](references/collector-setup.md) before implementing an adapter. Inspect authorized sources such as Prometheus, CloudWatch/MSK, Kafka APIs, application instrumentation or existing configuration. Establish service/topic/group relationships from actual evidence or user-provided mapping. Ask only for access or mappings that are missing; don't infer complete producer relationships from topic names.

Create the collector in the user's workspace, outside this skill's runtime assets. Its job is to convert their sources to complete version-1 snapshots and PUT them to `/api/v1/map` with the ingestion token. Document sources, collection interval, units, configured versus observed instance counts and topology scope. Keep Kafka/cloud credentials in that environment; the map only needs its local ingestion token.

Unavailable measurements must be null, not invented or retained under a fresh timestamp. Collection failures must send an explicit degraded/error status. Preserve stable IDs, increasing sequence numbers across restarts and true observation timestamps. The map retains strict topology/layout limits; scope oversized systems explicitly rather than silently truncating or weakening road constraints.

## Verify the result

Check `/api/v1/health`, the accepted `/api/v1/map` snapshot, the live browser map and selected-item values. Verify updates and lag against actual observations; verify failure/stale behavior when practical within the user's authorization. Use [the Docker validation task](references/docker-kafka-handoff.md) only when the user asks to create a test cluster.

Report the startup command, map URL, data/token location, collector files, actual sources and unavailable fields. Distinguish real-source verification from synthetic checks. Report errors and unverified behavior; do not claim that a working HTTP upload proves a correct Kafka mapping.
