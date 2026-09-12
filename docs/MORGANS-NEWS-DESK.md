# Big News Morgans — flying blimp

Status: implemented in 0.9.0 as a blimp and imported briefing workspace. Interactive Chrome capture/import is supported; unattended collection is not implemented or scheduled. Automatic Robin/Nami routing and live source connections below remain design directions.

## Confirmed presentation and browser

User corrected the visual concept: Morgans operates from a flying blimp above the island, not a ground-level news desk. Use a matching pixel-art blimp with gentle movement, a new-briefing indicator and click-to-open briefings. Respect reduced motion. News-delivery animations must reflect actual new captured items.

Chrome is the user's chosen browser. On 2026-09-12, both X Home (For you) and LinkedIn Feed (For you) were opened successfully in the connected Chrome session and displayed signed-in feed posts. This confirms interactive read access for this session, not an unattended feed connection inside Sunny. No posting, messaging or account changes were performed.

## Outcome

Turn news and opportunities into a short, sourced briefing relevant to Quintin's projects and job search. Morgans has an energetic newspaper-editor personality while separating verified source claims, opinions and suggested actions. A report does not automatically authorize project changes or communications.

## Sources and access

- Personal X and LinkedIn feeds: first verify access in the user's chosen signed-in browser. A browser session is distinct from an unattended integration inside Sunny. Mark partial captures and unavailable sources explicitly.
- X's official home timeline requires an approved application and user authentication. It is reverse chronological, so it must not be presented as an exact copy of the For You feed.
- LinkedIn's standard self-service permissions do not provide home-feed reading. No direct LinkedIn or X connector is currently available in this Codex session.
- Public inputs: selected official product updates, repository releases, engineering articles, company career pages and public job listings. Feed sources and project interests should be editable.
- Shared post links or pasted excerpts provide a usable manual input when personal-feed access is unavailable. Preserve attribution and capture time.

## Blimp briefings

1. Project signals: relevant tools, release changes, useful implementations and concrete improvement ideas.
2. Career opportunities: roles filtered by the user's target title, experience and location. Link to the employer listing and distinguish original posting time from discovery time; flag unverified availability.
3. Learning priorities: a small number of skills connected to actual project gaps or target roles.
4. Saved research: searchable sources and dismissed/saved items, with explicit controls to remove saved captures.

Every item carries its source URL, capture time, available publication date, short summary, relevance explanation, suggested next step and verification status. Group duplicate links/stories and prioritize useful evidence over social engagement. Use concise excerpts rather than retaining entire feeds.

## Crew handoff

Morgans gathers signals. Robin verifies claims. Nami helps prioritize. A user-selected **Discuss with Luffy** action opens a bounded mission draft containing the source and proposed outcome. Luffy delegates under the existing execution and review controls. Job applications, outreach and public posts need a separate explicit user request.

## Runtime and cost

Start with an on-demand briefing. Cache sources, deduplicate before model calls, cap the number of items per brief and show whether results are fresh, partial or unavailable. Background collection and cadence should be configured only after a working source connection and user preference are established. Do not describe browser-only reads as an always-on feed integration.

## Missing input

- Target roles, experience level and location/remote preference for job matching.

## Verified documentation

- X home timeline: https://docs.x.com/x-api/posts/timelines/quickstart/reverse-chron-quickstart
- LinkedIn API permissions: https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access

