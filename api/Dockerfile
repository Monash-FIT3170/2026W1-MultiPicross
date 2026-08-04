FROM node:25-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM base AS dev

EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm run build

# Runtime deps only, keeps tsx/typescript/drizzle-kit out of the prod image.
FROM base AS deps-prod

RUN npm ci --omit=dev

FROM node:25-alpine AS prod

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
# db/migrate.ts reads ./drizzle, db/import-puzzles.ts reads ./imgs, at startup
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/imgs ./imgs

EXPOSE 3000
CMD ["node", "dist/index.js"]
