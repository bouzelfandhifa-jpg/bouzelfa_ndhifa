FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY . .
RUN mkdir -p uploads
EXPOSE 3456
VOLUME ["/app/data.db", "/app/uploads"]
CMD ["node", "server.js"]
