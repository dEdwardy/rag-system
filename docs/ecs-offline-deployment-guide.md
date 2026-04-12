# ECS 离线部署指南

这份文档面向你当前的部署约束：

- ECS 机器没有公网访问能力
- Docker 镜像需要在本地准备好后手动上传
- PostgreSQL 和 Redis 运行在同一台 ECS 上的 Docker 容器中
- 应用容器也运行在同一台 ECS 上，并通过共享 Docker 网络访问基础设施容器

## 一、部署前本地需要准备什么

本地需要准备并上传以下内容：

1. 基础 infra 目录：`docker/infra/`
2. 离线 Docker 镜像包：`docker/infra/rag-images-bundle.tar.gz`
3. 应用代码仓库当前版本

建议 ECS 上使用两个目录：

```text
/usr/pros/infra
/usr/pros/rag-system
```

## 二、仓库中已经准备好的文件

### 1. 基础 infra 目录

```text
docker/infra/
  docker-compose.yml
  .env.example
  README.md
  postgres/init/001-create-extensions.sql
```

### 2. 离线镜像包

```text
docker/infra/rag-images-bundle.tar.gz
```

这个包里已经包含以下镜像：

- `rag-system:latest`
- `pgvector/pgvector:pg16`
- `redis:7-alpine`

### 3. 应用生产环境模板

```text
apps/api/.env.production.example
```

## 三、把文件上传到 ECS

你需要把这些内容传到 ECS：

1. 整个 `docker/infra/` 目录上传到 `/usr/pros/infra`
2. `docker/infra/rag-images-bundle.tar.gz` 上传到 `/usr/pros/infra/rag-images-bundle.tar.gz`
3. 应用仓库上传到 `/usr/pros/rag-system`

最终目录建议长这样：

```text
/usr/pros/infra/docker-compose.yml
/usr/pros/infra/.env.example
/usr/pros/infra/postgres/init/001-create-extensions.sql
/usr/pros/infra/rag-images-bundle.tar.gz

/usr/pros/rag-system/docker-compose.yml
/usr/pros/rag-system/apps/api/.env.production.example
```

## 四、在 ECS 上导入 Docker 镜像

执行：

```bash
mkdir -p /usr/pros/infra/images
cd /usr/pros/infra
tar -xzf rag-images-bundle.tar.gz -C /usr/pros/infra/images

docker load -i /usr/pros/infra/images/rag-system-latest.tar
docker load -i /usr/pros/infra/images/pgvector-pg16.tar
docker load -i /usr/pros/infra/images/redis-7-alpine.tar
```

检查镜像是否导入成功：

```bash
docker images | grep -E 'rag-system|pgvector/pgvector|redis'
```

你应该能看到：

- `rag-system:latest`
- `pgvector/pgvector:pg16`
- `redis:7-alpine`

## 五、配置基础设施环境变量

进入 infra 目录：

```bash
cd /usr/pros/infra
cp .env.example .env
vi .env
```

至少填这几个值：

```env
POSTGRES_DB=rag_system
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<你的数据库强密码>

REDIS_PASSWORD=<你的 Redis 强密码>

DOCKER_SHARED_NETWORK=rag-infra-net
```

## 六、启动基础 infra

执行：

```bash
cd /usr/pros/infra
docker compose up -d
```

检查状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f
```

正常情况下应有两个服务：

- `infra-postgres`
- `infra-redis`

这个 compose 还会创建一个共享 Docker 网络：

```text
rag-infra-net
```

## 七、配置应用生产环境变量

进入应用 API 目录：

```bash
cd /usr/pros/rag-system/apps/api
cp .env.production.example .env.production
vi .env.production
```

下面这些值是必须改的。

### 1. 数据库 / Redis

因为 app 容器和基础设施容器在同一个 Docker 网络里，所以直接用容器名连接：

```env
DATABASE_URL=postgresql://postgres:<数据库密码>@infra-postgres:5432/rag_system
DIRECT_URL=postgresql://postgres:<数据库密码>@infra-postgres:5432/rag_system

QUEUE_PROVIDER=redis
REDIS_URL=redis://default:<Redis密码>@infra-redis:6379

VECTOR_STORE_PROVIDER=pgvector
VECTOR_STORE_PGVECTOR_DIMENSIONS=1024
QUEUE_MAX_CONCURRENT_TASKS=1
```

### 2. 鉴权

至少设置强随机 JWT 密钥：

```env
AUTH_ACCESS_JWT_SECRET=<一段足够长的随机密钥>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=Lax
```

### 3. OSS 对象存储

```env
STORAGE_PROVIDER=oss
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
OSS_ACCESS_KEY_ID=<你的值>
OSS_ACCESS_KEY_SECRET=<你的值>
OSS_BUCKET=<你的 bucket>
OSS_PREFIX=rag-system/prod
```

### 4. LLM / Embedding

```env
OPENAI_API_KEY=<你的 key>
OPENAI_BASE_URL=<你的 base url>
OPENAI_CHAT_MODEL=<你的 chat model>
OPENAI_EMBEDDING_MODEL=<你的 embedding model>
OPENAI_EMBEDDING_DIMENSIONS=1024
OPENAI_EMBEDDING_API_MODE=default
```

### 5. OAuth

确保这些地址和你的真实生产域名完全一致：

```env
AUTH_OAUTH_SUCCESS_REDIRECT_URI=https://你的域名/ragora/
AUTH_GITHUB_REDIRECT_URI=https://你的域名/ragora/api/auth/oauth/github/callback
```

如果你使用 Google 或 OIDC，也要把对应值填好。

## 八、启动应用容器

执行：

```bash
cd /usr/pros/rag-system
docker compose up -d app
```

检查状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f app
```

## 九、检查共享 Docker 网络

执行：

```bash
docker network inspect rag-infra-net
```

正常情况下，你应该能看到这些容器都在同一个网络里：

- `infra-postgres`
- `infra-redis`
- app 容器

## 十、执行数据库迁移

如果目标生产库还没有同步最新 schema，需要执行迁移。

推荐命令：

```bash
cd /usr/pros/rag-system
pnpm --filter @rag-system/api exec prisma migrate deploy
```

### 重要说明

你当前仓库的某些数据库环境不一定已经有 `_prisma_migrations` 表。

如果目标生产库以前不是按 Prisma migrate 管理的，那么：

- `migrate deploy` 可能会失败
- 不要在服务器上直接随意执行破坏性 SQL
- 先确认目标数据库当前 schema 基线，再决定是否需要手动补基线或单独执行某次 migration SQL

## 十一、最小验收检查

至少检查下面这些：

1. app 容器正常运行
2. app 能连上 `infra-postgres`
3. app 能连上 `infra-redis`
4. 域名 / 反向代理能访问到 app
5. 登录功能正常
6. 文档上传正常
7. 检索和问答能返回知识库内容

## 十二、常用命令

### 1. 基础 infra

```bash
cd /usr/pros/infra
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

### 2. 应用容器

```bash
cd /usr/pros/rag-system
docker compose ps
docker compose logs -f app
docker compose restart app
docker compose up -d app
docker compose down
```

## 十三、后续版本更新怎么做

如果后面发布新版本，建议按这个顺序：

1. 在本地重新构建镜像 tar
2. 把新的 tar 上传到 ECS
3. 重新执行 `docker load -i ...`
4. 更新 `/usr/pros/rag-system` 代码
5. 重启 app：

```bash
cd /usr/pros/rag-system
docker compose up -d app
```

通常基础 infra 不需要重建，除非 PostgreSQL / Redis 自身配置发生变化。

## 十四、最短检查清单

- `rag-system:latest` 已导入
- `pgvector/pgvector:pg16` 已导入
- `redis:7-alpine` 已导入
- `/usr/pros/infra/.env` 已填写真实密码
- `/usr/pros/rag-system/apps/api/.env.production` 已填写真实生产值
- `/usr/pros/infra` 下 `docker compose up -d` 已成功
- `/usr/pros/rag-system` 下 `docker compose up -d app` 已成功
- `rag-infra-net` 网络中同时存在 infra 和 app 容器
