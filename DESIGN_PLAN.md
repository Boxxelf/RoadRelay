# RoadRelay — website and dashboard redesign

## Approved direction

Create an English-language company homepage inspired by https://unitedcarriers.com/. The homepage is the default entry point. Its top-right **Demo** button opens the working RoadRelay dashboard at `/dashboard`.

Reference characteristics: an expansive black opening, oversized geometric typography, a luminous dotted globe and routes, compact navigation, white editorial sections, transportation illustrations, and scroll-driven scenes. Translate these into original RoadRelay content and visual assets. Do not reuse United Carriers branding, claims, testimonials, or partner logos.

## Company positioning

RoadRelay is a prototype-stage road monitoring company concept. Its proposed product turns routine fleet journeys into road observations for maintenance teams. Start with campuses and industrial sites that manage both fleets and roads; municipalities are the longer-term market.

- **Mission:** Make routine journeys useful to the people who maintain our roads.
- **Vision:** A road network where emerging problems reach the right team before disruption grows.
- **Value:** Collect impact observations, consolidate repeated evidence, and support human inspection and maintenance decisions.
- **Business model:** Proposed hardware setup plus a recurring workspace subscription; start with a scoped paid pilot. Pricing and demand are not yet validated.
- **Potential collaborators:** Campus facilities, industrial-site operators, municipal fleets and public works, road asset owners, and maintenance contractors. These are intended collaborators, not signed partners.
- **Demonstrated:** Toy-car impact sensing, local telemetry, evidence recording, and a local inspection workflow.
- **Simulated:** Position and the 20-vehicle fleet scenario. No actual GPS, field accuracy, repair savings, customer deployments, or automated dispatch is claimed.

## Visual system

| Token | Value / role |
| --- | --- |
| Night | `#08090B`, hero and closing section |
| Paper | `#FFFFFF`, primary reading and operating surfaces |
| Mist | `#F0F1F3`, secondary surfaces |
| Ink | `#121418`, body and titles |
| Relay blue | `#234DFF`, routes and key actions |
| Signal orange | `#EF8650`, decorative route endpoints |

Use geometric display typography, tight headline spacing, and a clear sans-serif body. Prefer locally available or bundled fonts and offline assets. Numerals use tabular figures. Keep diagnostic red/amber/green distinct from decorative blue/orange. Use a locally rendered dot globe and original vector fleet artwork, avoiding external media dependencies.

## Homepage composition

1. **Navigation and hero:** ROADRELAY wordmark, Company / How it works / Collaborators / Vision anchors, top-right Demo. Hero statement: “Every route. A road worth knowing.” A blue/orange dotted globe with route arcs supplies the main visual. A compact note distinguishes the conceptual visual from real fleet positions.
2. **Company / mission:** Oversized black typography on white; introduce routine-journey sensing and maintenance decisions. An original service-vehicle scene bridges the hero and process.
3. **How it works:** A sticky illustrated road scene with three scroll-linked stages: Collect, Review, Relay. Functional stage selectors support keyboard and reduced-motion use.
4. **Collaboration:** An editorial role list describing who drives, reviews, owns, and repairs. All relationships clearly labeled as intended pilot collaborators.
5. **Vision and pilot model:** Mission and vision statements, campus-first approach, and a credible proposed subscription model without invented pricing or traction.
6. **Prototype / Demo:** Explain live sensing versus simulated position and fleet scale. Link to the working console. Footer with section navigation and prototype attribution.

```
ROADRELAY       Company / How it works / Collaborators        Demo

            EVERY ROUTE.             [dotted globe]
            A ROAD WORTH KNOWING.     [blue / orange routes]

ROUTINE JOURNEYS.                     Mission and company copy
EARLIER OBSERVATIONS.                 [service vehicle / road]

[sticky road and vehicle]             Collect / Review / Relay

BUILT AROUND                         Fleet / Facilities / Owners /
THE PEOPLE ON THE ROAD.              Maintenance contractors

Mission / Vision                     Campus pilot + business model

SEE THE SIGNAL.                      Open the demo
```

## Dashboard upgrade

Preserve the existing Python/SQLite APIs, stored observations, firmware, USB bridge, and optional AI integration. Keep the same plain HTML/CSS/JavaScript stack.

- Use matching wordmark, stronger black/white typography, blue selection states, and quieter containers.
- Move recording controls above the map so the primary workflow is visible.
- Rename the user-facing Checkpoint selector to **Demo location**, Start pass to **Start recording**, and Finish pass to **Finish recording**. Preserve pass counting and aggregation semantics.
- Distinguish connected but not recording, recording with no above-threshold observation, and offline states.
- Keep live and synthetic data separate and all location labels explicit.
- Keep waveform, evidence replay, CSV export, inspection drawer, and local assignment fully operational.
- Dashboard brand link returns to the company homepage.

## Motion and accessibility

One coordinated hero entrance, restrained globe rotation, route pulses, and a scroll-linked service vehicle. Use transforms/opacity, pause offscreen animation, and respect reduced-motion preferences. No blocking intro loader, scroll hijacking, or fake live telemetry. Provide keyboard navigation, visible focus, readable contrast, and responsive layouts down to 390px.

## Implementation and verification

1. Save this design document before implementation.
2. Add homepage assets and explicit local routes; retain `/dashboard` for the console.
3. Restyle the dashboard and improve recording-state copy.
4. Verify JavaScript syntax, backend tests, static routes and integration behavior.
5. Visually inspect desktop/mobile homepage, anchor navigation, process controls, Demo navigation, dashboard empty/recording states, and browser errors.
6. Preserve the existing database and real sensor evidence. Any generated test packets use an isolated temporary database.

This is a local website. Public deployment is outside the present request.

## Implementation status

Implemented: separate company homepage at `/`, dashboard at `/dashboard`, original canvas globe and SVG service vehicle, scroll-linked workflow and manual step controls, mission/vision and intended collaborator content, matching dashboard styling, and recording controls above the map.

Verified: 12 receiver/workflow unit tests, isolated HTTP/UDP integration tests including all new static routes, JavaScript syntax, desktop and 390px mobile layouts, Demo navigation, workflow step selection, motion pause, and viewing the existing live observation. Browser checks reported no console errors. Existing live data remained at two recorded passes, with one inspection candidate, during verification. No test packets were sent to the real workspace.

Motion respects reduced-motion preferences and pauses when the globe leaves the viewport or the tab is hidden. All website art and code are served locally. The company concept and proposed partnerships remain explicitly labeled.
