# Kafka City prototype

## Canvas performance renderer

The default world now uses two Canvas 2D elements and no live SVG/world-object DOM nodes. Existing vector artwork is serialized only during startup, decoded to raster sprites, and cached once. The complete static scene is pre-rendered to an offscreen canvas. Camera changes redraw this image once; traffic and highlights draw on the transparent foreground. Ground-depth sorting and destination-out scenery sprites occlude vehicles without per-vehicle scratch canvases. HTML retains HUD, native hover descriptions, and selection panels.

Camera position lives in a ref, with no React render per drag event. Pan is bounded; zoom is limited to 0.65â€“1.8. Offscreen traffic is culled. Default traffic is capped at 50 orders vehicles and 23 payments vehicles, including queues. Explicit /?stress=200 runs the actual simulation with 200 vehicles for performance checks; the absolute cap is 200.

Chromium in-app preview at 1280Ã—720, 200 visible vehicles: final saved sample averaged 3.24 ms draw time, 6.20 ms p95, 3.95 ms draw time on camera-change frames, and 16.65 ms requestAnimationFrame intervals (~60 fps). These are local preview measurements, not a guarantee for every device. Evidence: canvas-performance.json. The first per-vehicle masking attempt missed the frame budget and was replaced. The sprite generation syntax error and React title serialization errors were fixed; subsequent browser checks captured no warnings/errors.

Browser verified road and gate selection, pause retaining simulation time, pan, zoom to 1.8, culling from 200 to 173 visible vehicles, reset, and playback. Tests execute actual projection, layout, simulation, and canvas hit-testing modules; mocked data: none. The demo data remains intentionally simulated. Screenshot: kafka-city-canvas.jpg. No packages were installed for this change.

Build a React + TypeScript SVG city using deterministic simulated Kafka traffic. Four services, shared four-lane orders infrastructure, two-lane payments infrastructure, physical producer/consumer gates, moving vehicles, and distinct consumer queues. Support selection, pause, speed, pan, and zoom.

No Kafka connection or credentials required. Start: npm run dev -- --port 5173. Validate: npm run build.

Simulation data is intentionally synthetic, as requested. Numeric lag is a fixed illustrative metric; vehicles represent message batches. Queue positions advance on consumption intervals. Logical topology, layout coordinates, simulation, and visual components are separate modules.

Validation: npm install completed with zero vulnerabilities; npm run build passed. Browser verified orders selection, pause/play, animated vehicle transforms, 87 total vehicles, 19 queued vehicles, and no captured console warnings/errors. No test mocks were introduced. Browser viewport inspection used the narrow in-app preview; full desktop performance and pan/zoom have not been measured automatically.

Environment: Windows PowerShell, Node 20.19.0, npm 10.8.2; Vite bound to 127.0.0.1:5173 with strict port selection. Branch: codex/kafka-city. Credentials: none.

## Isometric rework

### Rounded kids-game artwork

Rounded building footprints are created in ground coordinates and then projected, including curved wall shading and roof trims. Loading bays have arched openings. Vehicle bodies and cabins use the same rounded geometry. Trees now have full shaded leaf canopies, rounded trunks, and 2:1 ground shadows; shrubs and building signs are softer. No new packages or changes to the simulated topology. Screenshot: kafka-city-rounded.jpg.

Built and visually inspected the isolated style area before implementing the full scene. Available at /?style-test; screenshot: style-test.jpg.

The active renderer is CityWorld. All geometry uses project(u,v,height) = (u-v, (u+v)/2-height). Ground coordinates are separate from logical service/topic information. IsoBuilding, IsoGate, IsoRoad, IsoCar, IsoVan, IsoTruck, IsoSemi, IsoTree, and IsoRoadSign share this projection. Vehicles use four directional sprite variants without screen-space rotation. Ground-depth sorting includes moving vehicles, buildings, and trees. Roads have physically separate 4/2 lanes. Embedded bays include dark recesses, frames, lintels, aprons, and short drives. Rooftop details distinguish dispatch, payment, analytics, and notification buildings.

Reworked simulation: 74 total vehicles, five Analytics queue vehicles, fourteen Notification queue vehicles, no persistent Payment queue. Queue units advance to gates and recycle to the tail on deterministic consumption intervals. Simulated batches and illustrative metrics remain deliberately simplified; this is not a Kafka execution model.

Validation: npm test executes actual application modules with no mocked data. It checks the exact 2:1 projection, road axis/lane invariants, shared branch, receiving-wall endpoints, 60 simulated seconds with finite positions, and continuous queue advancement across consumption intervals. Browser checks confirm 13 gates, 74 vehicles, 19 waiting vehicles, pause retaining positions, gate and physical-road selection, pan, and zoom. No new packages installed. The TypeScript depth-sort inference error was corrected with an explicit Element|null type. Screenshot: kafka-city-isometric.jpg.


## Canvas renderer and physical Kafka terminals — October 5, 2026

Retained rounded 2:1 artwork and implemented two Canvas 2D layers. Static terrain, roads, campuses, buildings, terminals and trees are rasterized and cached once; moving vehicles use cached directional sprites. Camera transforms, viewport culling, requestAnimationFrame and reused draw records replace world DOM updates. Default traffic is capped; ?stress=200 runs an explicit stress scenario.

Kafka producer depots and consumer groups are separate physical terminals. Receiving yards include paved approaches, low curbs, intake markings and receiving booths; depots have loading bays and yellow departure markings. Campus grass, connecting paths and curb corners group each service property. Payment has zero waiting heads, Analytics five, Notification fourteen. Partition-specific vehicle classes include four-trailer semi batches; trailers follow road bends independently. Payments rises across an actual bridge above orders, including supports and shadow, with no intersection connection.

Default world text is limited to four compact service names and two lowercase topic labels. Group names and partitions appear only at close zoom or through hover/selection. Roads have subtle orange orders and lavender payments edge strips. Consumer-yard selection exposes actual simulated topology metrics.

Validation: npm test and npm run build passed. Mocked data: none; tests execute actual application modules using the intentionally simulated demo topology. Browser verified six visible default labels, receiving-yard selection, and no captured console warnings/errors. At 1280x720 with 200 visible vehicle heads, sampled draw mean 4.35ms, p95 6.20ms and frame interval 16.80ms; measured pan draw mean 5.37ms across nine frames. Evidence: receiving-yards-performance.json and kafka-city-physical-yards.jpg. No packages installed.

The demo now demonstrates two separate Analytics consumer-group yards and two distinct Orders depots producing orders and payments. Main buildings remain in place. Additional terminal routes merge into the existing topic trunks. Stress traffic allocation scales across all routes without changing the total head cap.

Branch: codex/kafka-city. Discussion folder: discussions/kafka-city. Task file: discussions/kafka-city/task.md. Environment: Windows PowerShell, Node 20.19.0, npm 10.8.2. Vite: 127.0.0.1:5173. Credentials: none.

Final validation also selected analytics-audit from its physical receiving booth. Default simulation has 72 vehicle heads. Fixed the TypeScript unreachable truck-kind comparison identified during the final build; subsequent build passed. Removed the decorative SERVICE HOUSE text from default building sprites.


## Anchored signs and road/dock clearance — October 5, 2026

Kept neutral asphalt, adding subtle orange/lavender topic edge stripes, repeating small road markers, matching terminal trim and sign accents. Compact screen-horizontal sign plates have thin poles ending at projected rooftop or roadside origins. Group signs are hidden by default and revealed for hovered/selected yards or close zoom.

Road rectangles now stop at their endpoints; rounded joins exist only at interior bends. This removes asphalt extending beneath dock walls. Receiving approaches finish against bay faces. Shifted the realtime Analytics yard 35 ground units to clear the neighboring audit approach. Payments turns at v=850, leaving 70 ground units after the bridge ramp ends at v=780. Ramp/deck/ramp geometry and asphalt match the continuous neutral topic road. Extended the terrain and cache bounds to contain the new turn.

Tests execute actual road geometry, layouts and simulation, without mocked data. New checks prove paved footprints and bend bounds do not intersect solid buildings and verify straight bridge landing clearance and the four ramp/deck heights. Browser verified six default anchored signs and a seventh consumer-group sign on selection, with the correct consumer-group metrics. No new packages installed. Screenshot: kafka-city-anchored-signs.jpg.


## Terminal apron/driveway sequence and topic vehicle families — October 5, 2026

Every producer/consumer terminal now has a warm concrete loading/receiving apron and a separate gray driveway. Driveways taper into neutral asphalt through flared curb cuts and merge markings. Asphalt starts/ends 60 ground units from bay walls, preserving 28 units of apron plus 32 units of driveway. Shifted the orders trunk from v=365 to v=400 to preserve straight clearance before the Payment approach. Producers depart from individual bay positions; receivers converge across the connection toward their actual bay positions.

Orders vehicles use orange/red cabs and roof bands; payments vehicles use blue/purple equivalents. Body panels stay cream/neutral. Cars, vans, trucks, semis and all articulated trailers retain their distinct silhouettes. Waiting batches retain their topic colors and use a small amber marker. A shared topic theme supplies vehicle, road, bridge and terminal accents. Both topic families are pre-rasterized for each orientation and waiting state; no extra per-frame vector drawing.

Validation: npm test and production build passed. Mocked data: none. Tests execute actual geometry/layout/simulation, prove apron/driveway separation from asphalt, and sample trailer turning over actual simulated movement. Corrected an initially missing sprite-cache parenthesis and replaced the former fixed-initial-position bend assertion after the longer source approach changed the vehicle's initial position. Browser inspected every terminal connection and neutral topic-colored vehicle bodies, with no captured warnings/errors. Files remain under 600 lines. No packages installed. Evidence: kafka-city-topic-traffic.jpg and topic-traffic-performance.json. Pan timing records pointer-driven camera changes separately from initial cache painting.

## Snapshot scenario configuration â€” October 5, 2026

Added ScenarioConfig topology/state/layout/visualization sections, centralized validation and derived render model, configurable partition distribution and absolute vehicle encoding, capped traffic, automatic/manual layout, and a closed-by-default four-tab editor. Apply/Reset preserves Canvas rendering and snapshot values without page reload. Added six scenario presets plus Demo and validated JSON import/export.

Tests pass using actual application configuration, layout, encoding and simulation modules. Mocked data: none. Browser verified 8 partitions, 12 physical producer bays, hot-P6 editing, Apply/Reset and visible invalid-rate rejection preserving the world. Default Demo restored; no captured browser console errors/warnings. No packages installed. Configuration documentation: scenario-configuration.md. Screenshot: kafka-city-configuration.png.

Corrected TypeScript errors, a UTF-8 file-reading error and an oversized bundle warning during implementation. The drawer now loads as a separate chunk. No silent replacement of invalid configurations is used.

Branch: codex/kafka-city. Discussion folder: discussions/kafka-city. Task file: discussions/kafka-city/task.md. Environment: Windows PowerShell, Node 20.19.0, npm 10.8.2. Vite: 127.0.0.1:5173. Credentials: none.

## Continuous roads, linked articulated traffic and campus signs â€” October 5, 2026

Added reusable curved centerlines, offset road ribbons and shared T/cross-branch polygons. Asphalt, accents and partition markings follow continuous curves; picking and highlights use the same curved road geometry. Straight-piece/circular bend assembly is no longer used by the active renderer.

Precomputed partition lane paths include physical bay approaches. Articulated traffic uses a tractor plus linked trailers: each axle is constrained against the previous axle along the same lane. First separation is 29 ground units; subsequent separations are 35. Tractors/trailers use 32 rasterized isometric orientations, and visible couplers join their attachment positions. Chain computation is sequential, avoiding repeated independent trailer positioning.

Service signs use dedicated campus-edge ground anchors, screen-facing plates and one thin neutral pole. Anchors lie outside the campus/building silhouette, and plates are raised above the service roofline without attaching to art or roof props.

Validation: npm test and npm run build pass. Mocked data: none. Actual High throughput preset exercises multi-trailer linkage over 60 simulated seconds; checks cover axle separation, curved road ribbons, shared branches, arbitrary configurations and sign clearance. Fixed duplicate trimmed waypoints and a tight-turn linkage assertion failure. Removed the initial 500KB bundle warning by dynamically importing the sprite rasterizer. Build main chunk: 296.54KB; rasterizer chunk: 204.38KB. No packages installed; files remain under 600 lines.

Browser: inspected default and High throughput traffic with no captured console errors/warnings. High throughput sample draw mean 7.56ms, p95 12.80ms; frame interval 24.77ms on this machine. Evidence: kafka-city-linked-trailers.png and kafka-city-continuous-roads.png. Restored Demo before completion.

Branch: codex/kafka-city. Discussion folder: discussions/kafka-city. Task file: discussions/kafka-city/task.md. Environment: Windows PowerShell, Node 20.19.0, npm 10.8.2. Vite: 127.0.0.1:5173. Credentials: none.

## 2026-10-05 guided editor and visual-system iteration

Implemented the supplied 40-section continuation specification: dedicated campus signs with rooftop clearance, shared playful vehicle previews, path-linked trailers, guided services/topics/groups forms, map selection, whole-campus dragging, automatic connected-district layout and shared-trunk routing, and unified JSON/scenario actions. Existing Canvas rendering and building artwork retained.

Verification uses actual application modules and explicitly simulated product scenarios; mocked data: none. Browser checks created Orders/Payment, a four-partition orders topic, four producer bays and a three-consumer group with configured throughput, consumption and lag without JSON. Browser campus movement updated the service and both owned terminals together and removed affected manual route overrides. Automatic reset and shared Visuals gallery verified. Browser selector mismatch and a focus timeout were reported, inspected and resolved; Browser automatic reset exposed a real sign-placement error: a viewport clamp placed the pole origin inside rooftop geometry. Removed the clamp and expanded the dedicated perimeter-anchor search; automatic reset then rendered successfully. Added automatic-campus pole checks. File lookups for cameraTransform.ts and scenarioFiles.ts used nonexistent names and were reported; no file mutation resulted. Export succeeded to Downloads/kafka-city-demo.json; the automation download-event waiter timed out despite the completed file.

Environment: branch codex/kafka-city; Node 20.19.0; npm 10.8.2; Vite 6.4.3; localhost port 5173; credentials none; no packages installed.

Final verification: npm test and npm run build passed after the viewport-clamp correction. Mocked data: none. JSON export file was parsed successfully (four services, two topics). Live preview changed configured maximum from four to five trailers immediately, then was restored to four. Screenshots: kafka-city-guided-editor.png and kafka-city-campus-signs.png. Preview left on Demo at port 5173.

## 2026-10-05 requested visual changes and publication

Ground now encloses all campuses and road geometry. Default road detours replaced by shortest orthogonal obstacle-avoiding paths between paved driveways. Topic vehicle paint covers body panels with grey streaks; both road edges and dashed partition markings use topic color. Signs use long straight vertical poles anchored at object centers. Partition labels removed. Consumer terminals have roof-mounted lag gauges colored green, amber or red from the configured snapshot.

User requested code only: no tests, build, browser inspection or runtime execution performed for these changes. Remote supplied by the user is the same as C:/dev/skills: https://github.com/niliproject123/skills.git. Publication branch: codex/kafka-city. Environment: Windows; Node 20.19.0; npm 10.8.2; Vite 6.4.3 port 5173; application credentials none.

## 2026-10-05 seven-service terrain, crossings and cache corrections

Added Inventory, Shipping and Fraud with physical receiving terminals and lag snapshots. Terrain uses a beveled infrastructure hull, with tree clusters and paths around the expanded campuses. Automatic routing reserves separate corridors for parallel roads of different topics; crossing routes can receive route-specific elevated decks with ramps. Sprite loading is configuration-revision aware and stale builds are cancelled; failed cache loads are discarded for subsequent explicit retries. Moving traffic is limited by physical lane length to avoid compressed overlapping vehicle groups on short routes.

No tests or build run, following the user's code-only instruction. Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3, port 5173; application credentials none.

## 2026-10-05 dock setbacks, bridge ground spans and four-topic presets

Added one 96-unit straight cell between dock approaches and road corner clearance. Shared road stretches now form one deduplicated road graph before corners are rounded. Bridge ground-level spans are removed from the elevated route while the perpendicular lower road remains drawn; vehicles sharing an elevated physical segment receive matching elevation. Crossing landing corners can move outward into available space before bridge creation.

The seven-service demo now includes four connected topics: orders, payments, inventory and fulfilments. Presets change subscriptions, partition counts and producer/consumer bay counts as well as rates and lag. Added inventory and fulfilment producers and receiving groups.

No tests or build run, following the user's code-only instruction. Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-05 startup repair

The requested startup check found two TypeScript errors (road-piece join typing and missing TerminalLayout.name) and real route initialization errors from expanded driveway ports, hard parallel-road reservations, overlapping manual/automatic terminal placement and tightly packed receiving rows. Fixed the types and gauge label; parallel spacing is a routing cost rather than an impossible exclusion; automatic bays reserve existing manual placements and receiving rows allow the complete driveway setback. Non-demo example campuses were repositioned to clear their wider producer bays. Raster cache quality is 1 and the memory estimate includes all retained full-world layers.

Added tools/check-startup.mjs, which transpiles actual application modules and initializes Demo, Normal, Hot partition, Consumer lag, Recovering consumer, High throughput and Many groups. All seven passed, each with seven services and four topics. Mocked data: none. Production build passed and Vite returned HTTP 200 on port 5173. Browser verification could not run because the browser-control tool failed with a missing kernel-assets path.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 junctions, multi-pass bridges and vehicle turns

Bridge planning groups all perpendicular road passes along each straight elevated run into one deck, using full lower-road widths and curb clearance. Adjacent bridge spans on the same topic corridor merge. Landing corners move outward where available; deck clearance is preserved when ramps are fitted. Supports and shadows are rasterized beneath ground roads; decks remain in the elevated depth layer. Ground-level elevated-road spans remain removed.

Added reusable junction geometry, neutral junction pavement and marking masks; actual perpendicular intersections become shared graph nodes. Free road ends receive explicit turnaround surfaces instead of square stubs. Receiving yards render turning-loop geometry also used by vehicle paths. Queued delivery heads unload then turn through the yard; moving arrivals continue through the loop. All vehicle classes now use 32 cached orientation variants sampled from their lane tangents, and shared previews use the same sprites.

Verification: npx tsc --noEmit passed. Only TypeScript errors were checked, as requested; no build, runtime, browser or unit tests were run. Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 sprite preparation and dock approach corrections

Replaced individual vehicle raster images with cached per-paint/per-kind sprite sheets. Each sheet contains all 32 orientations and both waiting states in one decoded image and one canvas; Canvas draws source rectangles directly. Only configured vehicle types on connected topics are prepared. Paint-keyed sheets and size-keyed trees survive configuration rebuilds, with bounded caches and failed entries discarded while errors continue to reach the rendering alert. Preparation yields between uncached sheets. Road marking masks now use scene geometry bounds instead of a 40,000 by 40,000 area.

Removed circular road caps, receiving-yard circulation loops and circular selection highlights. Vehicles terminate at receiving gates rather than following a return loop. Shortest-path routing rejects first/last edges that reverse the dock direction. Bridge landing extensions cannot introduce a collinear reversal or independently shift shared topic waypoints into duplicate parallel roads.

A separate logical route is currently generated for each producer/consumer-group connection. Multiple routes of the same topic represent fan-out to independent consumer groups, not opposing traffic directions; coincident stretches share their physical pavement.

Verification: only npx tsc --noEmit; no runtime, performance, browser, build or unit tests. CPU improvement is architectural and has not been benchmarked under the user's verification restriction. Mocked data: none.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 route search and bridge mutation correction

The spacing preference previously charged five times the distance alongside another topic, causing large detours. Reduced that factor to 1.15. Same-topic centerlines now participate in the visibility grid and receive a modest reuse discount so related connections prefer shared pavement. Added a direction-aware search with separate arrival headings, a meaningful corner cost, prohibited immediate reversals and explicit dock direction constraints. The prior cell-only search could discard paths arriving with a more suitable heading.

Bridge planning no longer changes route waypoints after the routing pass. This removes the post-routing corner movement that produced long extensions and inconsistent shared branches. Same-topic intersections remain ground-level junctions; bridge detection considers different-topic crossings, retaining full lower-road-width spans and fitted ramps on the existing straight geometry.

Verification: npx tsc --noEmit passed; no build, runtime, browser, unit or performance tests were run, following the user's restriction. Mocked data: none. Visual output has not been verified in the browser.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 shared topic trees, campus spacing and both bridge axes

Automatic topic routing now creates one connected physical tree per topic. Producer and receiving driveway ports attach once to the nearest existing network; attachments stop at first contact to avoid redundant reconnections and cycles. Logical producer/group vehicle paths are recovered from that shared tree, so fan-out uses a common trunk and actual branches instead of separately routed parallel roads. Explicit route/trunk overrides remain authoritative.

Spread the seven default service coordinates and removed old absolute dock coordinates so docks follow their campuses. Presets inherit the same spacing. Automatic districts calculate campus envelopes from building sizes, producer/group counts, receiving rows, topic partition widths and driveway setbacks, with collision errors surfaced when placement cannot be resolved. Producer bays accumulate the depths of preceding bays rather than multiplying their own size by their index, fixing unequal-bay overlap.

Added an optional bridge axis (u or v, preserving existing v-axis configurations). Both orientations share point, height and span geometry across deck rendering, supports, ground-road removal, vehicle elevation/depth, picking, sprite bounds, validation and the layout editor. Crossing detection can select either orientation when there is room for a deck and ramps; same-topic junctions stay at ground level. Bridge planning preserves completed route coordinates.

Verification: only npx tsc --noEmit. An invalid comparison in the bridge-direction editor was reported and corrected; the final TypeScript check passed. No build, runtime, browser, performance or unit tests were run. Mocked data: none. A source read for src/App.tsx failed; the actual entry src/main.tsx was then read. Visual output is unverified under the requested check restriction.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 hard road-width and corner clearance

Different-topic parallel road segments are now hard routing exclusions rather than a spacing penalty. Minimum centerline separation includes both road half-widths plus a 28-world-unit gap, with extended endpoint bounds and rounded-corner envelopes. Turns and branch attachment points reserve the turning ribbon and bridge-ramp space; perpendicular straight passes remain available for bridge planning. Same-topic road sharing remains allowed.

Road reservations trim terminal approaches to their actual paved connection and reserve every other topic's fixed driveway before the first network is planned. Reservations use configured partition counts and deduplicate repeated physical edges. The visibility grid includes clearance-boundary coordinates so blocked corridors can be bypassed. Direction-aware search now uses an admissible distance priority to reduce grid exploration. Unrouteable terminals and unsafe first-contact branch joins produce explicit placement errors; constraints are never silently relaxed.

Verification: npx tsc --noEmit passed before the final explicit branch guard; the final TypeScript check is recorded by the completion response. No build, browser, runtime, unit or performance tests were run, following the user's restriction. Mocked data: none.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 physical junction classification and bridge lane membership

Root causes: bridge planning used individual logical producer/group route segments, hiding intermediate shared-topic junctions; vehicle height depended only on topic and proximity to a bridge rectangle. A turning route could therefore leave the deck sideways and abruptly lose elevation.

Added physicalRoadRuns: paved terminal approaches are normalized, coincident topic edges are deduplicated and split at shared nodes, and straight runs stop at all physical corners and junctions. Bridges are planned against those runs, so no deck or ramp can cover a same-topic branch. Automatic bridge spans preserve corner and landing clearance; merging cannot join separate physical runs through a junction. Invalid manual bridges and diagonal dock connections produce explicit geometry errors.

Vehicle bridge travel is now precomputed per route and partition from the actual sampled lane path. A carriage is elevated only while traversing the full straight span from one ramp to the other, using lane-distance entry/exit intervals. Each trailer receives its own continuous ramp elevation. Road highlights retain a separate display-only elevation lookup.

Verification: final npx tsc --noEmit only, following the user's restriction. No build, browser, runtime, unit or performance tests were run. Mocked data: none. Visual behavior has not been verified in the browser.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.

## 2026-10-06 startup recovery

Started one Vite server on port 5173 after stopping the two verified duplicate project Vite processes. The default scene previously failed during module initialization because road-width restrictions trapped dock approaches and the branch search could choose an unreachable nearest attachment.

Reserved full future driveways, widened automatic dock spacing, gave multi-topic receiving yards separate topic approach positions, and made the road search consider all safe attachment candidates. Nearby terminal ports attach before distant branches. Added a bootstrap that displays the actual startup exception and a Reload button instead of leaving a blank page.

Reduced Canvas memory use: bridge structures and decorative props use bounded sprites, and only two composed focus worlds remain cached. Normal now stays within the existing memory budget.

Verification: npx tsc --noEmit passed. The user explicitly requested starting Vite and checking startup; the actual default and Normal models initialize successfully, and localhost page/bootstrap/main requests return HTTP 200. Mocked data: none. The startup diagnostic still fails for Hot partition at analytics-fulfilments; later presets remain unverified. Routing spacing/order experiments also produced payment-orders and notification-delivery errors and were reverted. These errors are unresolved for larger preset layouts; no constraints are silently relaxed.

Browser inspection failed because the browser tool could not write its kernel assets (missing path, error 3), so rendered output is unverified. One source read used the incorrect CityCanvas.tsx filename; the correct CanvasCity.tsx was subsequently read. No packages were installed and no build, unit or performance tests were run.

Branch codex/kafka-city; discussion discussions/kafka-city; task task.md; Windows / Node 20.19.0 / npm 10.8.2 / Vite 6.4.3; port 5173; application credentials none.
