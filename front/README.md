# Ginku

La version Web est une PWA installable avec notifications d'arrivée via Web Push.
Voir [la configuration et les essais](../docs/web-pwa-notifications.md), ainsi que
[les délais par favori et la modale accessible](../docs/notifications-par-favori.md).

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Environment Configuration

The API base URL is configured through Vite environment files:

- `.env.development` is used for `pnpm dev`.
- `.env.production` is used for builds.

Adjust `VITE_API_BASE_URL` in these files to switch between development and production backends.

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```
