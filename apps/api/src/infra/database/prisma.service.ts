import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

export function resolvePrismaDatasourceUrl(env = process.env) {
  const directUrl = env.DIRECT_URL?.trim();
  const databaseUrl = env.DATABASE_URL?.trim();
  return directUrl || databaseUrl || undefined;
}

function describeDatasourceUrl(url: string | undefined) {
  if (!url) {
    return {
      mode: "unset",
      host: "unknown",
      port: "unknown"
    };
  }

  try {
    const parsed = new URL(url);
    return {
      mode: parsed.port === "5432" ? "direct" : parsed.searchParams.get("pgbouncer") === "true" || parsed.port === "6543" ? "pooler" : "custom",
      host: parsed.hostname || "unknown",
      port: parsed.port || "default"
    };
  } catch {
    return {
      mode: "custom",
      host: "unparsed",
      port: "unknown"
    };
  }
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const datasourceUrl = resolvePrismaDatasourceUrl();
    super(
      datasourceUrl
        ? {
            datasources: {
              db: {
                url: datasourceUrl
              }
            }
          }
        : undefined
    );
  }

  async onModuleInit() {
    const datasource = describeDatasourceUrl(resolvePrismaDatasourceUrl());
    this.logger.log(
      `Connecting Prisma client in background using ${datasource.mode} datasource (${datasource.host}:${datasource.port}).`
    );
    void this.$connect()
      .then(() => {
        this.logger.log("Prisma client connected.");
      })
      .catch(error => {
        this.logger.error("Prisma client connection failed during startup.", error instanceof Error ? error.stack : String(error));
      });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
