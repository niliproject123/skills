# Large-map strategy — 2026-10-08

Status: source review and proposed architecture. No application behavior changed in this review. The user reports a cache-budget error and an unresponsive page. No runtime profiling or browser tests were performed under the TypeScript-only testing restriction.

## What currently goes wrong

1. `scenarioRuntime.applyScenario` calls `deriveScenario` synchronously on the UI thread. Derivation runs layout, every topic's road search and bridge planning before evaluating the rendering cache budget. A rejected scene can therefore consume substantial CPU before its error becomes visible. This is a plausible explanation for the reported freeze, not a measured timing result.
2. `computeLayout` can repeat routing for four globally expanded placements. `shortestRoad` combines obstacle/reservation coordinates into a columns-by-rows grid. `searchRoadGrid` allocates four heading states per cell; each explored edge checks obstacles and roads. This work grows with geometry complexity, not simply the number of services.
3. `spatialLayout` allocates conservative campus footprints and sums road widths across grid boundaries. It preserves clearance, but does not optimize service graph placement or minimize actual corridor occupancy. Global expansion further increases world area.
4. `canvasSprites` allocates a full-world terrain image, up to two full-world focus composites, and a rectangular road image per topic. Long or diagonal routes leave large transparent areas inside those rectangles. Cropping to topic bounds helps small maps but still scales poorly.
5. `worldCacheScale` and `deriveScenario` use pixel counts as their budget unit. RGBA8 backing storage is approximately four bytes per pixel: 100 million pixels alone represent about 400 MB, before decoding, temporary images, GPU copies, sprites and old/new scene overlap. The limits are not an accurate total-byte memory budget.
6. Hovering a topic can build another full-world composite synchronously inside the animation frame. Sprite cancellation is checked only near the end of preparation, so superseded work may continue allocating resources.
7. Applying any scenario change reruns geometry derivation and invalidates the scene sprite cache. A lag, rate, label or paint edit should not need to reroute roads.
8. Automatic accepted placement is held only in one in-memory entry. JSON export saves the configuration, not a complete accepted automatic road/bridge solution. Reloading an automatic scenario therefore repeats expensive calculations.
9. Camera pan/zoom bounds were designed around the small demo. A larger map also needs navigation sufficient to reach every campus at a useful viewing scale.

Increasing the allocation limit or shrinking service spacing is not the proposed solution. Preserve road width, separation, turn, driveway and bridge rules.

## Separate authoritative data from derived work

| Data | Lifetime and invalidation |
| --- | --- |
| Topology and user configuration | Authoritative saved input: services, topics, partitions, producer/group relationships, visual settings and manual overrides. |
| Accepted spatial solution | Persist service/terminal positions, topic network graph, branch attachments, bridges and terrain boundary. Key by topology, geometry-affecting overrides, physical bay counts and routing-rule version. |
| Lane geometry | Reuse continuous lane paths and bridge spans from the accepted solution. Keep the existing linked trailer behavior. |
| Kafka state | Rates and lag update gauges, queues and vehicle distribution. They do not invalidate layout or static road geometry. |
| Art assets | Shared building, tree and vehicle atlases. Key by art version, kind, palette and resolution; keep world position out of the key. |
| Render tiles | Disposable cache keyed by geometry version, affected style and zoom resolution. Never treat an image as authoritative map data. |

Ship a versioned, precomputed accepted spatial solution with each built-in preset, including Large city. Opening a matching preset should not run road searches. Generate that solution through the same strict planner, not by storing invalid hand-drawn roads.

For custom maps, persist accepted solutions in IndexedDB and optionally export them alongside configuration. Verify versions, input identity and geometry validity before reuse. A stale solution must trigger an explicit recalculation state; corrupt data or storage failures must be reported. Saving coordinates alone is insufficient: roads and bridges must also be saved. Saved layout improves subsequent loads but does not solve raster memory or first-time calculation.

## Option A: preserve the current visual detail

### Calculation and responsiveness

- Extract layout/routing into pure functions with explicit input and output. Run them in a dedicated Web Worker, without importing mutable active-scene globals.
- Show progress, allow cancellation, reject obsolete results by request ID, and enforce explicit search-work limits. Terminate superseded worker work instead of waiting for it to finish. Worker failure must be visible; never rerun the same expensive job synchronously as a hidden fallback.
- A worker moves CPU work away from the UI; it does not reduce total search cost or memory. Reduce those separately with indexed obstacles/reservations, a sparse corridor graph and refinement around terminals, turns and crossings.
- Place connected services near each other, allocate corridor capacity and route a coarse topic network before refining lane geometry. Expand only conflicted areas rather than every campus. Revalidate all physical clearance and bridge-fit rules after every affected change.
- Distinguish geometry edits, art edits and state updates. Reuse accepted geometry for state or paint changes; invalidate only affected assets/tiles for art changes. Start with whole-map worker recalculation for structural edits, then add local rerouting where dependency checks are reliable.

### Rendering and cache

- Replace full-world canvases and topic-wide raster rectangles with sparse tiles. Render only visible tiles plus a small surrounding margin, and evict least recently used tiles under a byte budget.
- A possible initial tile is 512 by 512 backing pixels: about 1 MiB for one RGBA8 layer, excluding gutters/temporary allocations. Tile count is governed by viewport, pixel density and layers, not the logical map's area. The exact budget needs measurement before claiming a supported map size.
- At full-map overview, use a screen-resolution overview/appropriate zoom level. Rendering all full-resolution tiles for a zoomed-out map would defeat the memory bound. At close zoom, generate crisp tiles for the actual screen pixel density. This changes cache resolution according to visibility, not the close-up art style.
- Keep terrain and ground roads tiled. Keep buildings, trees and bridge decks as reusable sprites in the existing depth-sorted scene so trucks can still pass behind buildings and beneath bridges. Do not flatten bridge decks into ground tiles.
- Clip continuous road geometry into tiles with padded gutters; preserve markings across boundaries. Draw only the central tile area to avoid seam gaps and duplicated translucent edges. Include tall objects and long bridge spans in the visibility index.
- Draw focus dimming and hover arrows in viewport-sized layers using cached geometry. Do not allocate another map-sized image for each selection. Maintain topic ownership within tile drawing data so overlapping bridges dim correctly.
- Reuse authored raster atlases or precompiled drawing commands. Current `raster` uses React markup, `document` and `Image`, so it cannot simply be moved unchanged into a worker. An OffscreenCanvas worker needs worker-compatible drawing/assets and explicit bitmap disposal.
- Account for backing bytes, atlases, decode buffers, pending tiles, both visible canvases and scene handover. Bound concurrent jobs and retained resources; release obsolete canvases/bitmaps promptly. Disk image compression does not reduce decoded canvas allocation.
- Keep the current vehicle cap initially. Index paths and objects by visible regions before creating/sampling poses; preserve global route progress and queue counts for offscreen traffic. Offscreen vehicles must reappear in consistent positions.
- Make navigation bounds derive from the world and viewport; add fit-to-city and zoom-to-service actions. Label placement should query visible signs rather than repeatedly scanning every label.

Expected benefit: current art, road meaning, bridge geometry and vehicle silhouettes remain. Costs: implementation complexity, asynchronous loading, and tile preparation during initial navigation. Performance improvement is an architectural expectation, not a verified benchmark.

## Option B: accept visible simplification

Use Option A's worker and bounded cache first; simplification alone does not remove synchronous road-search freezes.

| Change | Benefit | Visible cost |
| --- | --- | --- |
| Lower static tile resolution | Fewer pixels and smaller cache | Soft roads/terrain when enlarged; retain full-resolution selected campus. |
| Fewer trees, shrubs and small props | Less raster preparation and fewer draw items | Sparser scenery. |
| Fewer vehicle orientation frames | Smaller atlases and faster creation | More abrupt rotation on curves. |
| Fewer moving vehicles with larger batches | Less pose/sort/draw work | Less dense traffic; disclose batch mapping and preserve exact Kafka numbers. |
| Lower traffic animation frequency | Less animation work | Less smooth traffic; keep camera rendering independently responsive. |
| Simplified shadows/roof details at distance | Less drawing/raster work | Reduced detail while zoomed out. |
| District overview with detailed campus drill-down | Limits visible geometry | No simultaneous detailed full-city view. Represent every hidden connection explicitly. |
| Bundled topic roads in overview only | Less road clutter | Individual topic/partition lanes disappear until expanded; requires clear bundle counts and selection. |

Keep simplification an explicit quality/overview mode. Do not silently remove topics, alter queue totals, reduce road clearance, remove bridges, or disguise a routing failure as a cheaper display.

## Recommended implementation order

1. Introduce asynchronous worker layout with progress, cancellation and explicit failures; separate geometry invalidation from state changes.
2. Persist complete accepted layouts and ship precomputed preset solutions. Add sparse/indexed route search to bound first-time planning cost.
3. Replace whole-map caches with viewport tiles, shared atlases and correct byte accounting; preserve bridge depth ordering and hover path elevation.
4. Fix world-based navigation and add selective tile/asset invalidation.
5. Add optional lower-quality modes only if the above still misses measured hardware targets.

Each step should have a concrete acceptance condition: cancellable UI during calculation; repeat load without rerouting; cache allocation bounded independently of world area; preserved lanes, ramps, queue order, signs and close-up art. Performance and visual acceptance remain unverified until the user's testing restriction permits those checks. Continue only TypeScript error checks during implementation unless that restriction changes.

## Browser API references

- [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) — background calculation, messages, worker termination and DOM restrictions.
- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — asynchronous persistent structured data.
- [MDN: Optimizing canvas](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas) — reusable pre-rendered assets and layered rendering.
- [MDN: OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas) — Canvas rendering outside the main thread.

Inspection diagnostics: an initial search named nonexistent `src/canvasRenderer.ts` and `src/scenarioStorage.ts`; both reported missing-file errors. The actual implementation was then inspected in `CanvasCity.tsx`, `canvasSprites.tsx`, `scenarioRuntime.ts` and `CityEditor.tsx`. No packages were installed and no tests or runtime measurements were run. Mocked data: none.
