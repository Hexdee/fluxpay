FROM node:20-alpine AS build

WORKDIR /app

# Install deps (includes dev deps for TypeScript build)
COPY package.json package-lock.json ./
RUN npm ci

# Build
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Install prod deps only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# App bundle
COPY --from=build /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]

