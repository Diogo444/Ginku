# Ginku

Application web (frontend Vue + backend Node) qui consomme l’API `api.ginko.voyage` via un backend “proxy” (ajout de la clé API + cache).

## Stack technique

- Frontend : Vue 3, Vite, Vue Router, Tailwind CSS, Axios
- Backend : Node.js, Express, Axios, dotenv, cors
- Tooling : pnpm workspaces, ESLint, Prettier
- Déploiement : Docker (multi-stage), Caddy (serveur statique + reverse proxy)

## Architecture (comment ça marche)

- `front/` est une SPA Vue 3.
  - Le frontend appelle le backend via `VITE_API_BASE_URL` (ex: `http://localhost:3000/api` en dev).
- `backend/` est un serveur Express qui expose des routes REST sous `/api/*`.
  - Il appelle l’API amont `https://api.ginko.voyage` en ajoutant `APIKEY`.
  - Il met en cache certaines réponses (TTL ~ 60s) pour limiter les appels.
- En production (Docker), le frontend est buildé puis servi en statique par Caddy.
  - Un reverse proxy Caddy (voir `Caddyfile` à la racine) route :
    - `/api*` et `/health` → `backend:3000`
    - le reste (`/`) → `frontend:5173`

## Prérequis

- Node.js 20+
- pnpm (recommandé via Corepack) : `corepack enable`
- (Optionnel) Docker + Docker Compose pour le déploiement conteneurisé

## Installation (mode développement local)

1. Installer les dépendances à la racine :

   ```sh
   pnpm install
   ```

2. Configurer la clé API backend (au choix) :
   - `backend/.env` (ou `.env` à la racine) :

     ```env
     APIKEY=<votre_cle_api>
     PORT=3000
     ```

3. Lancer front + backend :

   ```sh
   pnpm dev
   ```

4. Accès :
   - Front : `http://localhost:5173`
   - Back : `http://localhost:3000/health`

## Variables d’environnement

### Backend

- `APIKEY` (obligatoire) : clé pour `api.ginko.voyage`
- `PORT` (optionnel, défaut `3000`)

### Frontend

Le frontend lit `VITE_API_BASE_URL` :

- `front/.env.development` (dev) : `http://localhost:3000/api`
- `front/.env.production` (build) : `/api` (prévu pour fonctionner derrière le reverse proxy Caddy)

## Commandes utiles

À la racine :

- `pnpm dev` : lance `front` + `backend` en parallèle
- `pnpm build` : build le front (et les workspaces qui ont un build)
- `pnpm lint` : lint (frontend) / placeholder (backend)
- `pnpm typecheck` : si disponible dans les workspaces

## Déploiement avec Docker

1. Créer le réseau externe attendu par `docker-compose.yml` (à faire une seule fois) :

   ```sh
   docker network create caddy_net
   ```

2. Définir la variable `APIKEY` (dans un fichier `.env` à la racine, ou en variable d’environnement) :

   ```env
   APIKEY=<votre_cle_api>
   ```

3. Build + run :

   ```sh
   docker compose up --build
   ```

4. Reverse proxy Caddy :
   - Le `docker-compose.yml` connecte les services au réseau `caddy_net`, mais ne lance pas de conteneur Caddy “reverse proxy”.
   - Utilisez votre Caddy existant sur `caddy_net` et montez le `Caddyfile` à la racine, ou ajoutez un service Caddy dans votre stack d’infra.

## Structure du repo

- `front/` : SPA Vue 3 (Vite + Tailwind)
- `backend/` : API Express (proxy `api.ginko.voyage`)
- `docker-compose.yml` : services `frontend` + `backend` (réseau `caddy_net` externe)
- `Caddyfile` : reverse proxy (entrée HTTP :80) vers `frontend`/`backend`
