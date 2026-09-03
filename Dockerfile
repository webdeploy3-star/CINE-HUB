FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    ffmpeg

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY frontend/package*.json ./frontend/

RUN cd frontend && npm install --legacy-peer-deps

COPY . .

RUN npm --prefix frontend run build

ENV NODE_ENV=production

EXPOSE 8000

CMD ["npm", "start"]
