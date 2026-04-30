# Locksmith documentation

Source for [docs.getlocksmith.dev](https://docs.getlocksmith.dev) (Docusaurus + OpenAPI).

## Repository

This site lives in **[github.com/locksmith-app/docs](https://github.com/locksmith-app/docs)**.

## Build

```bash
npm install
npm run build
```

`build` runs `write:openapi` (see below), generates API pages, then compiles the site.

### OpenAPI spec

- **In the full Locksmith monorepo:** if `../../frontend` exists next to this package (e.g. `apps/docs` under the same root as `frontend/`), `write:openapi` runs the TypeScript export there so the spec matches `LOCKSMITH_OPENAPI`.
- **In this repo alone:** the spec is downloaded from `OPENAPI_URL` (default `https://getlocksmith.dev/api/openapi`).

For a pinned or offline build, place `static/openapi.json` yourself (it is gitignored) and ensure `write:openapi` still populates it—or set `OPENAPI_URL` to a stable JSON endpoint.

## Develop

```bash
npm start
```

(You still need `static/openapi.json` and generated API docs; run `npm run write:openapi` and `npm run gen-api-docs` once, or full `npm run build` first.)
