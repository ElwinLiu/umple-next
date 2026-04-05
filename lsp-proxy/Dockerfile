FROM node:22-alpine

RUN apk add --no-cache openjdk17-jre-headless

RUN npm install -g umple-lsp-server@latest

WORKDIR /app

COPY lsp-proxy/package.json lsp-proxy/package-lock.json* ./
RUN npm ci --production

COPY lsp-proxy/server.js .
COPY jars/umplesync.jar /jars/umplesync.jar

EXPOSE 9999

CMD ["node", "server.js"]
