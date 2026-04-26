FROM node:22-alpine AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

FROM base AS build

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter @rag-system/shared build
RUN pnpm --filter @rag-system/api build
RUN VITE_APP_BASE_PATH=/ragora/ pnpm --filter @rag-system/web build

FROM build AS prod-deps

RUN pnpm --filter @rag-system/api --prod deploy --legacy /prod/api
RUN prisma_client_dir="$(find /prod/api/node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' | head -n 1)" \
  && build_prisma_client_dir="$(find /app/node_modules/.pnpm -maxdepth 1 -type d -name '@prisma+client@*' | head -n 1)" \
  && mkdir -p "$prisma_client_dir/node_modules/.prisma" \
  && cp -R "$build_prisma_client_dir/node_modules/.prisma/client" "$prisma_client_dir/node_modules/.prisma/"

FROM node:22-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

RUN apk add --no-cache nginx

COPY --from=prod-deps /prod/api/package.json ./apps/api/package.json
COPY --from=prod-deps /prod/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/scripts ./apps/api/scripts
COPY --from=build /app/apps/web/dist ./apps/web/dist

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/start.sh /app/docker/start.sh

RUN chmod +x /app/docker/start.sh

EXPOSE 8080

CMD ["/app/docker/start.sh"]
