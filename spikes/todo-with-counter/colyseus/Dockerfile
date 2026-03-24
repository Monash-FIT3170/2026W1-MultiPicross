FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache git
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 2567
CMD ["npm", "start"]
