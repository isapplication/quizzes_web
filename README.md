# quizplayo-web

The Quizplayo web app: landing page, school registration, teacher screens (library and starter shelf, AI Studio, live game
host), student play screens, school setup, Brand settings and the platform console. Next.js 15, React 19,
TypeScript. Deployed to **Vercel**.

It talks to the Quiz API from the **`quizplayo-platform`** repository: `next.config.ts` forwards `/api`, `/oauth2`,
`/login/oauth2` and `/logout` to `ISQUIZ_API_URL`, so the sign-in cookie stays on this site. Live games connect
straight to the game server address the API hands out.

## Run locally

Clone `quizplayo-platform` next to this folder and start its services (VS Code "Quizplayo: all", or
`../quizplayo-platform/scripts/start.sh`, which also starts this app). On its own:

```bash
npm install
ISQUIZ_API_URL=http://localhost:8100 npm run dev   # http://localhost:7100
```

The web app listens on 7100 (the Quiz API on 8100, the game server on 9100: the same on every machine).
`PORT` picks another port, e.g. `PORT=7200 npm run start` for a second copy on a server.

## Checks

```bash
npm run typecheck && npm test && npm run build
```

## Vercel

Root Directory `.`; Node 22; region `bom1` (in `vercel.json`). Set `ISQUIZ_API_URL` per environment:
Production (`main`) → `https://api.quizplayo.com`, Preview `uat` → `https://uat-api.quizplayo.com`,
Preview `develop` → `https://dev-api.quizplayo.com`. Changing it needs a redeploy (it is read at build time).
The full plan is `docs/repos-and-environments.md` in `quizplayo-docs`.
