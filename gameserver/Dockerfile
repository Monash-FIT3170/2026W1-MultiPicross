FROM node:25-alpine AS base

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

FROM base AS dev

EXPOSE 2567
CMD ["npm", "start"]

FROM base AS build

RUN npm run build

FROM node:25-alpine AS prod

WORKDIR /app
COPY --from=build /app/build ./build
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./

EXPOSE 2567
CMD ["node", "build/index.js"]
