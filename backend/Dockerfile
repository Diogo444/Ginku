# === STAGE 1 : build ===
FROM node:20-alpine AS build
WORKDIR /app

# Installer pnpm
RUN npm install -g pnpm

# Copier workspace + lockfile
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

# Install des deps backend uniquement
RUN pnpm install --frozen-lockfile --filter ./backend...

# Copier le code
COPY backend ./backend

# === STAGE 2 : runtime (image ultra légère) ===
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# Copier uniquement le dossier backend + node_modules filtrés
COPY --from=build /app/backend ./backend
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "backend/serveur.js"]
