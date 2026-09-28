# Artem Semkin Header Engine for Elementor

<!-- Badges activate when the repo goes public:
[![Tests](https://img.shields.io/github/actions/workflow/status/artkrsk/header-engine-for-elementor/test.yml?style=flat-square&logo=githubactions&logoColor=white&label=tests)](https://github.com/artkrsk/header-engine-for-elementor/actions/workflows/test.yml)
[![WordPress](https://img.shields.io/badge/WordPress-6.0+-21759b?style=flat-square&logo=wordpress&logoColor=white)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-8.0+-777bb4?style=flat-square&logo=php&logoColor=white)](https://www.php.net/)
And once live on wp.org: version / installs / rating badges (shields.io wordpress endpoints). -->

A header engine for Elementor: sticky, fixed, and reveal modes with admin-bar-aware offsets. Part of the free plugin collection at [artemsemkin.com/plugins/header-engine-for-elementor/](https://artemsemkin.com/plugins/header-engine-for-elementor/).

Submitted to WordPress.org; in review.

## Development

```bash
pnpm install && composer install
cp .env.example .env   # set DEV_TARGET to your Local site's plugin dir
```

| Command | What |
|---|---|
| `pnpm dev` | browser harness (Vite playground) |
| `pnpm dev:plugin` | watch-compile + mirror the plugin to `DEV_TARGET` |
| `pnpm build` | release build into `dist/` |
| `pnpm test` / `pnpm test:coverage` | Vitest |
| `pnpm release <patch\|minor\|major>` | bump, stamp, validate changelog, commit, tag |

Everything else (lint, typecheck, phpstan, phpcs, knip, fallow) runs via `pnpm exec` — see the [tooling docs](https://github.com/artkrsk/wp-plugin-tooling).

## License

GPL-3.0-or-later.

## TypeScript package entries

Themes integrating with the installed WordPress plugin use `@arts/header/contract` for public
types and passive values. This entry does not import the engine, initialize browser globals,
load assets, install listeners, or depend on producer build defines. Keep the existing optional
browser discovery checks: updating these compile-time imports does not require a newer installed
WordPress plugin.

The package root `@arts/header` remains the passive library entry with its existing named
factory API and root type exports. Direct library hosts explicitly create and initialize engines;
WordPress continues to boot through its separate `boot.ts` bundle. The package ships TypeScript
source for linked consumers, so a host needs a TypeScript-aware compiler. Existing
`/package.json`, `/src/ts/*`, and `/src/styles/*` paths remain available for compatibility.

`pnpm exec vitest run tests/ts/packageEntries.test.ts` checks isolated consumers with
`skipLibCheck: false`, inspects bundled contract graphs, and invokes the public root factory
without building or synchronizing WordPress assets.

```ts
import { EVENTS } from '@arts/header/contract'
import type { IHeader, IHeaderApp, IHeaderEventDetail } from '@arts/header/contract'
```

`EVENTS` reuses the engine's canonical event names. Older installed Header versions can lack
`getInstance`; retain capability detection before using that optional integration.
