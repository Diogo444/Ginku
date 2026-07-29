FROM node:26-alpine

WORKDIR /app

RUN corepack enable && apk add --no-cache curl

COPY MCP/package.json MCP/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY MCP/index.ts MCP/tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["pnpm", "start"]
