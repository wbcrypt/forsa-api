FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache curl python3 make g++
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/src/main"]
