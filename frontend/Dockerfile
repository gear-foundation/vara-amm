FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat

RUN corepack enable

WORKDIR /app

COPY package.json yarn.lock* ./

RUN yarn install --frozen-lockfile

FROM base AS builder

RUN corepack enable

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

COPY . .

ARG VITE_NODE_ADDRESS
ARG VITE_FACTORY_PROGRAM_ID
ARG VITE_EXPLORER_URL

ENV VITE_NODE_ADDRESS=$VITE_NODE_ADDRESS
ENV VITE_FACTORY_PROGRAM_ID=$VITE_FACTORY_PROGRAM_ID
ENV VITE_EXPLORER_URL=$VITE_EXPLORER_URL

RUN npm install -g serve

RUN yarn build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN npm install -g serve

COPY --from=builder /app/dist ./build

EXPOSE 3000

ENV PORT=3000

CMD ["serve", "-s", "build", "-l", "3000"] 
