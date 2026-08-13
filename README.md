# Arts Header for Elementor

<!-- Badges activate when the repo goes public:
[![Tests](https://img.shields.io/github/actions/workflow/status/artkrsk/header-for-elementor/test.yml?style=flat-square&logo=githubactions&logoColor=white&label=tests)](https://github.com/artkrsk/header-for-elementor/actions/workflows/test.yml)
[![WordPress](https://img.shields.io/badge/WordPress-6.0+-21759b?style=flat-square&logo=wordpress&logoColor=white)](https://wordpress.org)
[![PHP](https://img.shields.io/badge/PHP-8.0+-777bb4?style=flat-square&logo=php&logoColor=white)](https://www.php.net/)
And once live on wp.org: version / installs / rating badges (shields.io wordpress endpoints). -->

A header engine for Elementor: sticky, fixed, and reveal modes with admin-bar-aware offsets. Part of the free plugin collection at [artemsemkin.com/plugins/header-for-elementor/](https://artemsemkin.com/plugins/header-for-elementor/).

Not yet submitted to WordPress.org.

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
