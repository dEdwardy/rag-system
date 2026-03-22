import {
  DocumentRunFailedStage,
  DocumentRunStatus,
  DocumentRunTrigger,
  Prisma
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { ListKnowledgeBaseDocumentRunsInput } from "../documents/document.schemas";

@Injectable()
export class DocumentRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKnowledgeBaseRunSummary(knowledgeBaseId: string, input?: Pick<ListKnowledgeBaseDocumentRunsInput, "sinceHours">) {
    const startedAt = this.resolveStartedAtFilter(input?.sinceHours);
    const runs = await this.prisma.documentRun.findMany({
      where: {
        startedAt,
        document: {
          kbId: knowledgeBaseId
        }
      },
      orderBy: [{ startedAt: "desc" }, { version: "desc" }],
      select: {
        documentId: true,
        version: true,
        trigger: true,
        status: true,
        failedStage: true,
        diagnosticsJson: true,
        startedAt: true,
        finishedAt: true,
        document: {
          select: {
            sourceType: true,
            sourceName: true
          }
        }
      }
    });

    const byStatus = {
      pending: 0,
      processing: 0,
      ready: 0,
      failed: 0,
      skipped: 0
    };
    const byTrigger = {
      upload: 0,
      reindex: 0,
      external_resync: 0
    };
    const bySourceType: Record<string, number> = {};
    const failureByStage: Record<string, number> = {};
    let retryableFailures = 0;
    let nonRetryableFailures = 0;

    for (const run of runs) {
      byStatus[run.status] += 1;
      byTrigger[run.trigger] += 1;
      bySourceType[run.document.sourceType] = (bySourceType[run.document.sourceType] ?? 0) + 1;

      if (run.status === DocumentRunStatus.failed) {
        if (run.failedStage) {
          failureByStage[run.failedStage] = (failureByStage[run.failedStage] ?? 0) + 1;
        }

        if (this.isRetryableDiagnostics(run.diagnosticsJson)) {
          retryableFailures += 1;
        } else {
          nonRetryableFailures += 1;
        }
      }
    }

    const latestFailure = runs.find(run => run.status === DocumentRunStatus.failed);
    const latestRetryableFailure = runs.find(
      run => run.status === DocumentRunStatus.failed && this.isRetryableDiagnostics(run.diagnosticsJson)
    );
    const latestSkipped = runs.find(run => run.status === DocumentRunStatus.skipped);
    const latestFailureMessage = this.getDiagnosticsMessage(latestFailure?.diagnosticsJson ?? null);

    return {
      totalRuns: runs.length,
      latestRunAt: runs[0]?.startedAt ?? null,
      latestFinishedAt:
        runs.reduce<Date | null>((latest, run) => {
          if (!run.finishedAt) {
            return latest;
          }

          if (!latest || run.finishedAt > latest) {
            return run.finishedAt;
          }

          return latest;
        }, null) ?? null,
      byStatus,
      byTrigger,
      bySourceType,
      retryableFailures,
      nonRetryableFailures,
      failureByStage,
      latestRetryableFailure: latestRetryableFailure
        ? {
            documentId: latestRetryableFailure.documentId,
            version: latestRetryableFailure.version,
            trigger: latestRetryableFailure.trigger,
            failedStage: latestRetryableFailure.failedStage,
            sourceType: latestRetryableFailure.document.sourceType,
            sourceName: latestRetryableFailure.document.sourceName,
            message: this.getDiagnosticsMessage(latestRetryableFailure.diagnosticsJson),
            finishedAt: latestRetryableFailure.finishedAt
          }
        : null,
      latestSkipped: latestSkipped
        ? {
            documentId: latestSkipped.documentId,
            version: latestSkipped.version,
            trigger: latestSkipped.trigger,
            failedStage: latestSkipped.failedStage,
            sourceType: latestSkipped.document.sourceType,
            sourceName: latestSkipped.document.sourceName,
            message: this.getDiagnosticsMessage(latestSkipped.diagnosticsJson),
            finishedAt: latestSkipped.finishedAt
          }
        : null,
      latestFailure: latestFailure
        ? {
            documentId: latestFailure.documentId,
            version: latestFailure.version,
            trigger: latestFailure.trigger,
            failedStage: latestFailure.failedStage,
            sourceType: latestFailure.document.sourceType,
            sourceName: latestFailure.document.sourceName,
            message: latestFailureMessage,
            finishedAt: latestFailure.finishedAt
          }
        : null
    };
  }

  listKnowledgeBaseRuns(knowledgeBaseId: string, input: ListKnowledgeBaseDocumentRunsInput) {
    const startedAt = this.resolveStartedAtFilter(input.sinceHours);

    return this.prisma.documentRun.findMany({
      where: {
        documentId: input.documentId,
        startedAt,
        status: input.status,
        trigger: input.trigger,
        document: {
          kbId: knowledgeBaseId,
          sourceType: input.sourceType
        }
      },
      include: {
        document: {
          select: {
            id: true,
            kbId: true,
            sourceType: true,
            sourceName: true,
            title: true,
            status: true,
            processingStage: true,
            version: true
          }
        }
      },
      take: input.limit,
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    });
  }

  listDocumentRuns(documentId: string) {
    return this.prisma.documentRun.findMany({
      where: {
        documentId
      },
      orderBy: [{ version: "desc" }, { startedAt: "desc" }]
    });
  }

  createRun(input: {
    documentId: string;
    version: number;
    trigger: DocumentRunTrigger;
  }) {
    const startedAt = new Date();

    return this.prisma.documentRun.upsert({
      where: {
        documentId_version: {
          documentId: input.documentId,
          version: input.version
        }
      },
      update: {
        trigger: input.trigger,
        status: DocumentRunStatus.pending,
        failedStage: null,
        diagnosticsJson: Prisma.JsonNull,
        startedAt,
        finishedAt: null
      },
      create: {
        documentId: input.documentId,
        version: input.version,
        trigger: input.trigger,
        status: DocumentRunStatus.pending,
        diagnosticsJson: Prisma.JsonNull,
        startedAt
      }
    });
  }

  markRunProcessing(documentId: string, version: number) {
    return this.updateRun(documentId, version, {
      status: DocumentRunStatus.processing,
      failedStage: null,
      diagnosticsJson: Prisma.JsonNull,
      finishedAt: null
    });
  }

  markRunCompleted(documentId: string, version: number) {
    return this.updateRun(documentId, version, {
      status: DocumentRunStatus.ready,
      failedStage: null,
      diagnosticsJson: Prisma.JsonNull,
      finishedAt: new Date()
    });
  }

  markRunFailed(
    documentId: string,
    version: number,
    input: {
      failedStage: DocumentRunFailedStage;
      diagnosticsJson: Prisma.InputJsonValue;
    }
  ) {
    return this.updateRun(documentId, version, {
      status: DocumentRunStatus.failed,
      failedStage: input.failedStage,
      diagnosticsJson: input.diagnosticsJson,
      finishedAt: new Date()
    });
  }

  markRunSkipped(
    documentId: string,
    version: number,
    input: {
      failedStage: DocumentRunFailedStage;
      diagnosticsJson: Prisma.InputJsonValue;
    }
  ) {
    return this.updateRun(documentId, version, {
      status: DocumentRunStatus.skipped,
      failedStage: input.failedStage,
      diagnosticsJson: input.diagnosticsJson,
      finishedAt: new Date()
    });
  }

  private updateRun(
    documentId: string,
    version: number,
    data: Prisma.DocumentRunUpdateManyMutationInput
  ) {
    return this.prisma.documentRun.updateMany({
      where: {
        documentId,
        version
      },
      data
    });
  }

  private getDiagnosticsMessage(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return typeof value.message === "string" ? value.message : null;
  }

  private isRetryableDiagnostics(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return value.retryable === true;
  }

  private resolveStartedAtFilter(sinceHours?: number) {
    if (sinceHours === undefined) {
      return undefined;
    }

    const cutoff = new Date(Date.now() - sinceHours * 60 * 60 * 1000);
    return {
      gte: cutoff
    } satisfies Prisma.DateTimeFilter;
  }
}
