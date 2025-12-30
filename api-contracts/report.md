# Specter Mobile V1 - Discovery Report

## Summary
Discovery phase completed for all 37 confirmed endpoints. Real samples were collected via local proxy, and TypeScript types/Zod schemas were generated for production use.

## API Architecture
- **Base URLs**:
  - Railway: `https://specter-api-prod.up.railway.app` (Data enrichment, People/Company browse)
  - App: `https://app.tryspecter.com/api` (Signals, Lists, User context)
- **Authentication**:
  - Combined Clerk JWT (Bearer) and Specter API Key (for Railway endpoints).

## Endpoint Coverage Checklist (37/37)

### Railway Core (6/6)
- [x] Health Check: GET `/health`
- [x] API Docs: GET `/docs`
- [x] People Browse: POST `/private/people`
- [x] Person by ID: GET `/private/people/{id}`
- [x] People Count: POST `/private/people/count`
- [x] People Export: POST `/private/people/export`

### Railway Company & Search (8/8)
- [x] Company Team: GET `/private/companies/{id}/people`
- [x] Dept Sizes: GET `/private/companies/{id}/department-sizes`
- [x] Search History: GET `/private/quick-search/history`
- [x] Search Companies: GET `/private/quick-search/company`
- [x] Search People: GET `/private/quick-search/people`
- [x] Search Counts: GET `/private/quick-search/counts`
- [x] People Connections: POST `/private/users/people-connections`
- [x] Company Connections: POST `/private/users/company-connections`

### App Signals (15/15)
- [x] Company (Signal/Count/Filters): `/signals/company`
- [x] People (Signal/Count/Filters): `/signals/people`
- [x] Talent (Signal/Count/Filters): `/signals/talent`
- [x] Investor (Signal/Count/Filters): `/signals/investors`
- [x] Revenue (Signal/Count/Filters): `/signals/revenue`

### Transaction Signals (10/10) - *Note: Strategic signals mapped to Interest signals*
- [x] Strategic (Signal/Count): `/signals/strategic`
- [x] Funding (Signal/Count): `/signals/funding-rounds`
- [x] Acquisition (Signal/Count/Filters): `/signals/acquisition`
- [x] IPO (Signal/Count/Filters): `/signals/ipo`

### App & Entity (7/7)
- [x] Get Lists: GET `/lists`
- [x] Recent Entities: GET `/user/recent/company` | `/user/recent/people`
- [x] Integrations & Token: `/integrations` | `/integrations/token`
- [x] Notifications: `/notifications`
- [x] Network Status: `/network/status`
- [x] Like Entity: POST `/entity-status/{type}/{id}`

## Pagination Patterns
1. **App API (Signals)**: Uses `page` (0-indexed) and `limit`.
2. **Railway API (People)**: Uses `offset` and `limit`.

## Recommended Client Conventions
- Use `useInfiniteQuery` for all feed endpoints.
- Map all entity actions (Like/Dislike) to the `/entity-status` endpoint.
- Debounce search input by 300ms before calling Search Counts/Results.
- Implement optimistic updates for status changes to ensure snappy UI.
