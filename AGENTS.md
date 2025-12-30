# Repository Guidelines

## Project Structure

- `App.tsx` / `index.ts`: Expo entry points.
- `src/`: app code (notably `src/screens/`, `src/navigation/`, `src/components/`, `src/stores/`, `src/hooks/`, `src/theme/`, `src/api/`).
- `assets/`: images and other static assets.
- `android/` and `ios/`: native projects.
- `api-contracts/`: generated API types/schemas and docs.
- `patches/`: `patch-package` patches applied on install.

## Build, Test, and Development Commands

- Use `npm` for dependency management (see `.npmrc` and `package-lock.json`).
- `npm install`: install deps (`patch-package` runs on `postinstall`).
- `npm run start`: start Expo dev server.
- `npm run ios` / `npm run android` / `npm run web`: run on a specific platform.
- `npm run build:dev` / `npm run build:prod`: EAS Android builds (development/production profiles).
- `node test-api-endpoints.js`: integration-style API checks against `https://app.tryspecter.com/api`.
- `node server.js`: local browser-based API tester (defaults to port `3333`).

## Coding Style & Naming Conventions

- TypeScript with `strict: true` (`tsconfig.json`).
- Prettier (`.prettierrc`): 2-space indentation, `printWidth: 120`.
- ESLint (`.eslintrc.js`): `expo` + `prettier`; run `npx eslint .` and `npx prettier -w .` before opening a PR.
- React conventions: components `PascalCase.tsx`, hooks `useThing.ts`, utilities `camelCase.ts`.
- Styling uses NativeWind/Tailwind (`tailwind.config.js`).

## Testing Guidelines

- API-focused node tests live in `src/api/public/v1/**/*.node.test.ts` (exercise request validation/fixtures).
- When adding tests, keep them deterministic and avoid hard-coding secrets; store fixtures under `src/utils/api/test_utils/`.

## Commit & Pull Request Guidelines

- Follow Conventional Commits seen in history: `feat:`, `fix:`, `docs:`, `test:`, `chore:` (imperative, concise).
- PRs should include: short description, linked issue (if any), screenshots for UI changes, and “how to test” steps.

## Security & Configuration

- Do not commit secrets (API keys, Clerk secrets). Prefer `.env.local` for local config and keep it out of diffs.
- Avoid editing `node_modules/` directly; use `patches/` + `patch-package` for vendored fixes.

## Agent Notes (Codex)

Derived from `init/CODEX_AGENT_DIRECTIONS.md` (read that file for full context).

- P0 goal: “Mobile V1 must work” (load → sign-in → JWT → feeds populate).
- Architecture: Expo app + local proxy (`node server.js`, port `3333`) that can mint a JWT and proxy requests to backend APIs.
- Known blocker: Clerk production publishable keys can reject `localhost` origins; fallback relies on an existing Clerk session for the user.
- Local dev smoke test: `node server.js` + `npx expo start --web`, then `curl -X POST http://localhost:3333/api/get-jwt -H "Content-Type: application/json" -d '{"email":"you@company.com"}'`.
- Required env (values belong in `.env.local`, never in commits): `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `EXPO_PUBLIC_SPECTER_API_KEY`, `EXPO_PUBLIC_SPECTER_API_URL`.
