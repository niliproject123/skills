# Kafka City

A local isometric Kafka map with a small ingestion API and instructions for a coding assistant to adapt it to your monitoring environment.

[Download the runnable skill bundle](https://github.com/niliproject123/skills/raw/refs/heads/codex/kafka-city/releases/kafka-city-skill-v0.1.0.zip)

Extract it, install Node.js 20.19+ and run this from the extracted `kafka-city` folder:

```sh
node scripts/run.mjs
```

Open http://localhost:8787/?live=1. No npm install or Vite is required for the download. Tell your Codex/Claude session to read the included SKILL.md and connect the map to your system using available data sources. The session creates a collector in your workspace; Kafka City accepts a common snapshot format instead of requiring any particular Kafka/cloud SDK.

Use `--port 8788` or `--data ./my-cluster-data` to change the shared map/API port or state directory. Keep credentials and observations out of Git. The service listens locally; remote access requires a secured tunnel/gateway. The ZIP includes install instructions, collector contract, runtime, licenses and a file manifest. Its SHA-256 is in [the checksum file](releases/kafka-city-skill-v0.1.0.zip.sha256).

For Codex discovery, copy the complete extracted folder into `~/.codex/skills/kafka-city`, start a session that discovers it, and invoke `$kafka-city`. Other assistants can read its SKILL.md directly.

For source development: `npm ci`, then `npm run server` and `npm run dev`. For a standalone source build: `npm run build`, then `npm start`. For release packaging: `npm run package:skill`. Build/runtime errors are explicit; missing data displays as unknown rather than simulated values in live mode.

The Windows/Node/Chromium bundle was checked using synthetic observations through the actual extracted runtime. Real Kafka/Prometheus/AWS integration and other operating systems remain to be verified by the using session. Current limits include 16 services, 64 topics, 128 rendered connections and strict layout constraints. Large overview rendering currently does not reliably reach 60 fps.

See [collector setup](discussions/kafka-city/collector-setup.md) and [Docker Kafka validation](discussions/kafka-city/docker-kafka-handoff.md).
