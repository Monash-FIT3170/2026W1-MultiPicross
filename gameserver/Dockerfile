FROM node:25-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM base AS dev

EXPOSE 2567
CMD ["npm", "start"]

FROM base AS build

RUN npm run build

# Runtime deps only, keeps tsx/typescript out of the prod image.
FROM base AS deps-prod

RUN npm ci --omit=dev

FROM node:25-alpine AS prod

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/build ./build
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 2567
CMD ["node", "build/index.js"]
