FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm
RUN apk add --no-cache curl

COPY pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json ./backend/

RUN pnpm install --frozen-lockfile --prod --filter ./backend...

COPY backend ./backend

CMD ["node", "backend/serveur.js"]
