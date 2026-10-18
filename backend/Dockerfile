# === STAGE 1 : build ===
FROM node:26-alpine AS build
WORKDIR /app

# Copier workspace + lockfile + config pnpm racine
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Utiliser la même version de pnpm en local et dans les images.
RUN npm install --global "$(node -p 'require("./package.json").packageManager.split("+")[0]')"
COPY backend/package.json ./backend/

# Install des deps backend uniquement
RUN pnpm install --frozen-lockfile --prod --filter ./backend...

# Copier le code
COPY backend ./backend

# === STAGE 2 : runtime (image ultra légère) ===
FROM node:26-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache curl

# Copier uniquement le dossier backend + node_modules filtrés
COPY --from=build /app/backend ./backend
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "backend/serveur.js"]
