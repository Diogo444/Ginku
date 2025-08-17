FROM node:20-alpine
WORKDIR /app

# pnpm
RUN npm install -g pnpm
RUN apk add --no-cache curl


# Copier le workspace + manifests (pour le cache)
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY front/package.json ./front/

# IMPORTANT: filtre par chemin (nom de package non requis)
RUN pnpm install --frozen-lockfile --filter ./front...

# Copier le code du front
COPY front ./front

# Build
RUN pnpm --filter ./front build

# Lancer un serveur de preview (ok pour dev/recette)
WORKDIR /app/front
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]
