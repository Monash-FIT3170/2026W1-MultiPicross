FROM node:25-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM base AS dev

EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM base AS build

RUN npm run build

FROM node:25-alpine AS prod

WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 3000
CMD ["node", "dist/index.js"]
