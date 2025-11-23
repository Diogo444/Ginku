# === STAGE 1 : build Vite ===
FROM node:20-alpine AS build
WORKDIR /app

# pnpm + outils
RUN npm install -g pnpm
RUN apk add --no-cache curl

# Copier les fichiers de workspace pour le cache
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY front/package.json ./front/

# Install des deps du front uniquement
RUN pnpm install --frozen-lockfile --filter ./front...

# Copier le code du front
COPY front ./front

# Build Vite en mode prod
RUN pnpm --filter ./front build

# === STAGE 2 : serveur statique (Caddy) ===
FROM caddy:alpine

WORKDIR /srv

# Copier le build (dist) depuis le stage précédent
COPY --from=build /app/front/dist /srv

EXPOSE 5173

# Serveur de fichiers statiques
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":5173"]
