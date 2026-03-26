import {
  DocumentRunFailedStage,
  DocumentRunStatus,
  DocumentRunTrigger,
  Prisma
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { ListDocumentRunsInput, ListKnowledgeBaseDocumentRunsInput } from "../documents/document.schemas";

@Injectable()
export class DocumentRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async getKnowledgeBaseRunSummary(
    knowledgeBaseId: string,
    input?: Pick<
      ListKnowledgeBaseDocumentRunsInput,
      "documentId" | "sourceType" | "status" | "trigger" | "issueOnly" | "sinceHours"
    >
  ) {
    const startedAt = this.resolveStartedAtFilter(input?.sinceHours);
    const runs = await this.prisma.documentRun.findMany({
      where: {
        documentId: input?.documentId,
        startedAt,
        status: input?.status,
        trigger: input?.trigger,
        document: {
          kbId: knowledgeBaseId,
          sourceType: input?.sourceType
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
    const filteredRuns = input?.issueOnly
      ? runs.filter(run => this.matchesIssueOnlyFilter(run.status, this.buildFailureSummary(run.diagnosticsJson, run.failedStage)))
      : runs;

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
    const latestCompletedRuns = this.getLatestCompletedRunsByDocument(filteredRuns);

    for (const run of filteredRuns) {
      byStatus[run.status] += 1;
      byTrigger[run.trigger] += 1;
      bySourceType[run.document.sourceType] = (bySourceType[run.document.sourceType] ?? 0) + 1;
    }

    for (const run of latestCompletedRuns) {
      const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);

      if (!this.shouldCountFailureSummary(run.status, failureSummary) || !failureSummary) {
        continue;
      }

      if (failureSummary.failedStage) {
        failureByStage[failureSummary.failedStage] = (failureByStage[failureSummary.failedStage] ?? 0) + 1;
      }

      if (failureSummary.retryable) {
        retryableFailures += 1;
      } else {
        nonRetryableFailures += 1;
      }
    }

    const latestFailure = this.findLatestRunAnchor(
      latestCompletedRuns,
      run => this.shouldCountFailureSummary(run.status, this.buildFailureSummary(run.diagnosticsJson, run.failedStage))
    );
    const latestRetryableFailure = this.findLatestRunAnchor(latestCompletedRuns, run => {
      const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);
      return this.shouldCountFailureSummary(run.status, failureSummary) && failureSummary?.retryable === true;
    });
    const latestSkipped = this.findLatestRunAnchor(runs, run => run.status === DocumentRunStatus.skipped);
    return {
      totalRuns: filteredRuns.length,
      latestRunAt: filteredRuns[0]?.startedAt ?? null,
      latestFinishedAt:
        filteredRuns.reduce<Date | null>((latest, run) => {
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
      latestRetryableFailure: latestRetryableFailure ? this.buildRunSummaryAnchor(latestRetryableFailure) : null,
      latestSkipped: latestSkipped ? this.buildRunSummaryAnchor(latestSkipped) : null,
      latestFailure: latestFailure ? this.buildRunSummaryAnchor(latestFailure) : null
    };
  }

  async listKnowledgeBaseRuns(knowledgeBaseId: string, input: ListKnowledgeBaseDocumentRunsInput) {
    const startedAt = this.resolveStartedAtFilter(input.sinceHours);
    const queryWhere = {
      documentId: input.documentId,
      startedAt,
      status: input.status,
      trigger: input.trigger,
      document: {
        kbId: knowledgeBaseId,
        sourceType: input.sourceType
      }
    } satisfies Prisma.DocumentRunWhereInput;
    const querySelect = {
      id: true,
      documentId: true,
      version: true,
      trigger: true,
      status: true,
      failedStage: true,
      diagnosticsJson: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
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
    } satisfies Prisma.DocumentRunSelect;

    const toListedEntry = (run: Prisma.DocumentRunGetPayload<{ select: typeof querySelect }>) => {
      const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);
      return {
        run,
        failureSummary,
        result: {
          id: run.id,
          documentId: run.documentId,
          version: run.version,
          trigger: run.trigger,
          status: run.status,
          failedStage: this.resolveOutputFailedStage(run.status, run.failedStage, failureSummary),
          failureSummary,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          document: run.document
        }
      };
    };

    const listedRuns = !input.issueOnly
      ? (
          await this.prisma.documentRun.findMany({
            where: queryWhere,
            select: querySelect,
            take: input.limit,
            orderBy: [{ startedAt: "desc" }, { version: "desc" }]
          })
        ).map(toListedEntry)
      : await this.listIssueOnlyRuns(queryWhere, querySelect, input.limit, toListedEntry);

    return listedRuns.map(({ run, result }) => {
      if (input.includeDiagnostics) {
        return {
          ...result,
          diagnosticsJson: run.diagnosticsJson
        };
      }

      return result;
    });
  }

  private async listIssueOnlyRuns<
    S extends Prisma.DocumentRunSelect & {
      id: true;
      documentId: true;
      version: true;
      trigger: true;
      status: true;
      failedStage: true;
      diagnosticsJson: true;
      startedAt: true;
      finishedAt: true;
      createdAt: true;
      updatedAt: true;
      document: {
        select: {
          sourceType: true;
          sourceName: true;
        };
      };
    }
  >(
    where: Prisma.DocumentRunWhereInput,
    select: S,
    limit: number,
    toListedEntry: (run: Prisma.DocumentRunGetPayload<{ select: S }>) => {
      run: Prisma.DocumentRunGetPayload<{ select: S }> & {
        status: DocumentRunStatus;
        trigger: DocumentRunTrigger;
        failedStage: DocumentRunFailedStage | null;
        diagnosticsJson: Prisma.JsonValue | null;
        startedAt: Date;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        document: {
          sourceType: string;
          sourceName: string;
        };
      };
      failureSummary: ReturnType<DocumentRunsService["buildFailureSummary"]>;
      result: {
        id: string;
        documentId: string;
        version: number;
        trigger: DocumentRunTrigger;
        status: DocumentRunStatus;
        failedStage: DocumentRunFailedStage | null;
        failureSummary: ReturnType<DocumentRunsService["buildFailureSummary"]>;
        startedAt: Date;
        finishedAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
        document: {
          id: string;
          kbId: string;
          sourceType: string;
          sourceName: string;
          title: string;
          status: string;
          processingStage: string;
          version: number;
        };
      };
    }
  ) {
    const batchSize = 100;
    let offset = 0;
    const listedRuns: Array<ReturnType<typeof toListedEntry>> = [];

    while (listedRuns.length < limit) {
      const runs = await this.prisma.documentRun.findMany({
        where,
        select,
        take: batchSize,
        skip: offset,
        orderBy: [{ startedAt: "desc" }, { version: "desc" }]
      });

      if (runs.length === 0) {
        break;
      }

      for (const run of runs) {
        const entry = toListedEntry(run);
        if (!this.matchesIssueOnlyFilter(entry.run.status, entry.failureSummary)) {
          continue;
        }

        listedRuns.push(entry);
        if (listedRuns.length >= limit) {
          break;
        }
      }

      if (runs.length < batchSize) {
        break;
      }

      offset += runs.length;
    }

    return listedRuns;
  }

  async listDocumentRuns(documentId: string, input: ListDocumentRunsInput) {
    const runs = await this.prisma.documentRun.findMany({
      where: {
        documentId
      },
      ...(input.limit === undefined ? {} : { take: input.limit }),
      orderBy: [{ startedAt: "desc" }, { version: "desc" }]
    });

    return runs.map(run => ({
      ...run,
      failedStage: this.resolveOutputFailedStage(
        run.status,
        run.failedStage,
        this.buildFailureSummary(run.diagnosticsJson, run.failedStage)
      ),
      failureSummary: this.buildFailureSummary(run.diagnosticsJson, run.failedStage)
    }));
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

  markRunProcessing(documentId: string, version: number, diagnosticsJson: Prisma.InputJsonValue | null = null) {
    return this.reopenRunIfEligible(documentId, version, diagnosticsJson);
  }

  markRunCompleted(documentId: string, version: number, diagnosticsJson: Prisma.InputJsonValue | null = null) {
    return this.updateRun(documentId, version, {
      status: DocumentRunStatus.ready,
      failedStage: null,
      diagnosticsJson: diagnosticsJson ?? Prisma.JsonNull,
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

  private async reopenRunIfEligible(
    documentId: string,
    version: number,
    diagnosticsJson: Prisma.InputJsonValue | null
  ) {
    const run = await this.prisma.documentRun.findUnique({
      where: {
        documentId_version: {
          documentId,
          version
        }
      },
      select: {
        status: true,
        diagnosticsJson: true
      }
    });

    if (!run) {
      return { count: 0 };
    }

    const canReopen =
      run.status === DocumentRunStatus.pending ||
      (run.status === DocumentRunStatus.failed && this.isRetryableDiagnostics(run.diagnosticsJson));

    if (!canReopen) {
      return { count: 0 };
    }

    return this.prisma.documentRun.updateMany({
      where: {
        documentId,
        version
      },
      data: {
        status: DocumentRunStatus.processing,
        failedStage: null,
        diagnosticsJson: diagnosticsJson ?? Prisma.JsonNull,
        finishedAt: null
      }
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

  private getDiagnosticsCode(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return typeof value.code === "string" ? value.code : null;
  }

  private buildFailureSummary(value: Prisma.JsonValue | null, failedStage: DocumentRunFailedStage | null) {
    const code = this.getDiagnosticsCode(value);
    const message = this.getDiagnosticsMessage(value);
    const diagnosticsFailedStage =
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof value.failedStage === "string" &&
      this.isDocumentRunFailedStage(value.failedStage)
        ? value.failedStage
        : null;
    const normalizedFailedStage = failedStage ?? diagnosticsFailedStage;
    const retryable = this.isRetryableDiagnostics(value);

    if (!code && !message && !normalizedFailedStage && !retryable) {
      return null;
    }

    return {
      code,
      failedStage: normalizedFailedStage,
      retryable,
      message
    };
  }

  private isDocumentRunFailedStage(value: string): value is DocumentRunFailedStage {
    return Object.values(DocumentRunFailedStage).includes(value as DocumentRunFailedStage);
  }

  private buildRunSummaryAnchor(run: {
    documentId: string;
    version: number;
    trigger: DocumentRunTrigger;
    status: DocumentRunStatus;
    failedStage: DocumentRunFailedStage | null;
    diagnosticsJson: Prisma.JsonValue | null;
    finishedAt: Date | null;
    document: {
      sourceType: string;
      sourceName: string;
    };
  }) {
    const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);

    return {
      documentId: run.documentId,
      version: run.version,
      trigger: run.trigger,
      failedStage: this.resolveOutputFailedStage(run.status, run.failedStage, failureSummary),
      sourceType: run.document.sourceType,
      sourceName: run.document.sourceName,
      message: failureSummary?.message ?? null,
      finishedAt: run.finishedAt,
      failureSummary
    };
  }

  private shouldCountFailureSummary(
    status: DocumentRunStatus,
    failureSummary: ReturnType<DocumentRunsService["buildFailureSummary"]>
  ) {
    if (!failureSummary) {
      return false;
    }

    return status === DocumentRunStatus.failed || status === DocumentRunStatus.ready;
  }

  private matchesIssueOnlyFilter(
    status: DocumentRunStatus,
    failureSummary: ReturnType<DocumentRunsService["buildFailureSummary"]>
  ) {
    return this.shouldCountFailureSummary(status, failureSummary);
  }

  private resolveOutputFailedStage(
    status: DocumentRunStatus,
    failedStage: DocumentRunFailedStage | null,
    failureSummary: ReturnType<DocumentRunsService["buildFailureSummary"]>
  ) {
    if (failedStage) {
      return failedStage;
    }

    if (status === DocumentRunStatus.pending || status === DocumentRunStatus.processing) {
      return null;
    }

    return failureSummary?.failedStage ?? null;
  }

  private findLatestRunAnchor<T extends { finishedAt: Date | null; startedAt: Date; version: number }>(
    runs: T[],
    predicate: (run: T) => boolean
  ) {
    return runs.reduce<T | null>((latest, run) => {
      if (!predicate(run)) {
        return latest;
      }

      if (!latest) {
        return run;
      }

      const runAnchorAt = run.finishedAt ?? run.startedAt;
      const latestAnchorAt = latest.finishedAt ?? latest.startedAt;

      if (runAnchorAt > latestAnchorAt) {
        return run;
      }

      if (runAnchorAt.getTime() === latestAnchorAt.getTime() && run.version > latest.version) {
        return run;
      }

      return latest;
    }, null);
  }

  private getLatestCompletedRunsByDocument<
    T extends { documentId: string; status: DocumentRunStatus; finishedAt: Date | null; startedAt: Date; version: number }
  >(runs: T[]) {
    const latestRuns = new Map<string, T>();

    for (const run of runs) {
      if (run.status === DocumentRunStatus.pending || run.status === DocumentRunStatus.processing) {
        continue;
      }

      const latest = latestRuns.get(run.documentId);
      if (!latest) {
        latestRuns.set(run.documentId, run);
        continue;
      }

      const runAnchorAt = run.finishedAt ?? run.startedAt;
      const latestAnchorAt = latest.finishedAt ?? latest.startedAt;

      if (runAnchorAt > latestAnchorAt) {
        latestRuns.set(run.documentId, run);
        continue;
      }

      if (runAnchorAt.getTime() === latestAnchorAt.getTime() && run.version > latest.version) {
        latestRuns.set(run.documentId, run);
      }
    }

    return Array.from(latestRuns.values());
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
