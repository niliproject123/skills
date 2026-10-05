# Kafka City scenario configuration

Open **Configure**. Use SERVICES, TOPICS, CONSUMER GROUPS, LAYOUT, VISUALS, SCENARIOS or ADVANCED JSON, then press **Apply**. Changes are validated before replacing the running snapshot. Reset preset restores the last loaded preset. Loading or importing a scenario prepares a draft; Apply installs it. JSON export saves the draft. No server, credentials or page reload is required.

`ScenarioConfig` has four independent sections:

- `topology`: services, topics, partition counts, producer connections and consumer-group subscriptions. Counts determine physical bays.
- `state`: topic messages/second, optional partition overrides, group total consumption rate and explicit lag. Producer/consumer counts do not multiply rates. Unspecified partitions equally divide the remaining topic rate.
- `layout`: optional service and terminal coordinates, campus sides, visible bay walls, topic trunks, branches, route waypoints and elevated crossings. Missing placements use automatic layout. Route keys are `producerId/groupId`.
- `visualization`: absolute vehicle thresholds and capacities, trailer capacity/count, traffic limits, queue batch size, topic colors and service styling.

Animation never advances or changes the configured snapshot. Lag determines queue length; the incoming/consumption comparison separately determines catching up, stable or falling behind. Visual queues and moving traffic are capped without changing the underlying metrics. Trailer limits include the semi's first trailer.

Presets: Demo, Normal, Hot partition, Consumer lag, Recovering consumer, High throughput and Many groups. Default artwork, neutral asphalt, topic trim colors and Canvas caching are retained.

Identifiers must start with a letter and contain only letters, digits, underscores, periods or hyphens. The supported limits include 16 services/topics, 32 partitions/bays, eight trailers and 500 vehicle heads. Excessive layouts/cache sizes produce an error. Missing references, invalid rates, inconsistent partition totals and invalid waypoint/bridge geometry also produce visible errors. Automatic routing is a starting layout; use manual waypoints and overpasses to control crossings precisely.

Implementation: `src/scenarioTypes.ts` defines the schema; validation, encoding, layout and derivation each have separate modules. `scenarioRuntime.ts` installs the validated derived model; Canvas rendering and the editors consume that model/configuration. Six preset scenarios plus the retained demo are defined in `scenarioPresets.ts`.

Validation: `npm test` executes actual application modules, including all presets, JSON roundtrip, invalid configurations, eight partitions with a hot P6, twelve producers, added groups, changed visual settings, arbitrary service/topic identifiers and zero-consumption animation. Mocked data: none.

## Guided editing and campus placement

Create services and topics using their named forms. Save producer connections with service/topic pickers and a producer count. Consumer groups use a receiving-service picker, topic subscriptions, count, consumption rate and lag. Search lists and duplicate controls preserve stable identifiers and copy the relevant state. Empty scenarios are supported.

Click a building, terminal or topic road to open its editor. In LAYOUT, enable **Move campuses on map**, then drag a building or terminal. The entire campus moves; owned manual terminals retain their relative positions and related roads reroute on drop. **Reset to auto layout** removes placement overrides when applied. Coordinates and road waypoints remain under Advanced.

Automatic layout groups connected services into districts, places sources, processors and sinks in neighboring areas, and uses shared topic trunks with receiving branches. Automatic crossings use elevated straight sections where sufficient ramp/landing clearance exists. Manual route and overpass overrides remain available for complex topology. The isolated `mapLayout.computeLayout(topology, layoutOverrides)` API returns the infrastructure geometry.

Service signs use explicit dedicated ground anchors and screen offsets. Default pole placement checks the actual chimney, antenna, roof-cap and coin geometry. Consumer-group and producer labels stay hidden until selection or close zoom. Optional `layout.labels` entries use namespaced keys: `service-ID`, `topic-ID`, `terminal-ID`, with `labelAnchor: {x,y}` in world coordinates and `labelOffset: {x,y}` in screen pixels.

VISUALS uses the same sprite components as the Canvas world. It previews cars, vans, box trucks, semis and extra trailers alongside capacities, thresholds, topic colors and queue settings. Draft previews update immediately; Apply installs world changes. The development gallery is available at `/?vehicle-gallery`. Each articulated vehicle follows one lane path using per-segment distance and tangent sampling.

SCENARIOS provides preset loading, naming, duplication, reset and import/export. ADVANCED JSON edits the same configuration used by the guided forms and validates before applying. Export saves the draft configuration.
