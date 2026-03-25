FROM node:22-alpine
# install git (and bash just in case)
RUN apk add --no-cache git bash
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 2567
CMD ["npm", "start"]
