# Kafka City skill bundle

Extract the ZIP. Install Node.js 20.19 or newer. From the extracted `kafka-city` folder:

```sh
node scripts/run.mjs
```

Open the printed URL, normally http://localhost:8787/?live=1. This starts the map and ingestion API together. No npm install, Vite, Docker or Kafka client library is needed to run the map. Docker/Kafka/provider libraries may be needed for your chosen collector.

Tell your coding assistant:

> Use SKILL.md in this folder to connect Kafka City to my system using the data sources available here. Create and verify the collector in my workspace.

For Codex skill discovery, place this entire folder in your skills directory, normally `~/.codex/skills/kafka-city`, then start a session that can discover it and invoke `$kafka-city`. For another assistant, provide the folder and ask it to read SKILL.md.

Options: `--port 8788` changes the shared map/API port. `--data ./my-cluster-data` chooses a separate data directory for this cluster. Run `--help` for details. The generated ingestion credential and saved snapshot are in that data directory; never commit it. Optional environment variables: KAFKA_CITY_PORT, KAFKA_CITY_DATA_DIRECTORY and KAFKA_CITY_INGEST_TOKEN.

The map starts waiting for real observations. The collector contract is in `references/collector-setup.md`, also available through the product's setup-instructions link. Collector code/configuration belongs in your workspace, separate from these bundled runtime files. Keep this server local; remote access needs a secured tunnel/gateway.

The ZIP ships built artwork/renderer and the Node API. It excludes installed packages, Git history, credentials, saved observations and project-specific collector code. Third-party licenses are included. Source-based maintenance and repackaging use `npm run package:skill` in the source repository.

Verified locally on Windows with Node 20.19 and Chromium. The runner uses portable Node APIs, but macOS/Linux execution and real Kafka/Prometheus/AWS integrations still need verification in the using environment. Source metrics used in local bundle checks are explicitly synthetic. Topology limits and large-map performance limitations still apply; see the collector contract.
