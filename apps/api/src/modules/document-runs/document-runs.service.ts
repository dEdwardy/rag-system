import {
  DocumentRunFailedStage,
  DocumentRunStatus,
  DocumentRunTrigger,
  Prisma
} from "@prisma/client";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import {
  CompareKnowledgeBaseDocumentRunsInput,
  ListDocumentRunsInput,
  ListKnowledgeBaseDocumentRunsInput
} from "../documents/document.schemas";

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
    const bySourceFamily: Record<
      string,
      {
        totalRuns: number;
        failedRuns: number;
        retryableFailures: number;
        nonRetryableFailures: number;
        runsWithBoundaryHit: number;
      }
    > = {};
    const failureByStage: Record<string, number> = {};
    const boundaryStats = {
      runsWithBoundaryHit: 0,
      byReason: {} as Record<string, number>,
      droppedPageUrlCount: 0,
      droppedChildSitemapCount: 0,
      droppedFeedEntryCount: 0
    };
    let retryableFailures = 0;
    let nonRetryableFailures = 0;
    const latestCompletedRuns = this.getLatestCompletedRunsByDocument(filteredRuns);

    for (const run of filteredRuns) {
      const sourceFamily = this.resolveSourceFamily(run.document.sourceType);
      byStatus[run.status] += 1;
      byTrigger[run.trigger] += 1;
      bySourceType[run.document.sourceType] = (bySourceType[run.document.sourceType] ?? 0) + 1;
      bySourceFamily[sourceFamily] ??= {
        totalRuns: 0,
        failedRuns: 0,
        retryableFailures: 0,
        nonRetryableFailures: 0,
        runsWithBoundaryHit: 0
      };
      bySourceFamily[sourceFamily].totalRuns += 1;

      if (run.status === DocumentRunStatus.failed) {
        bySourceFamily[sourceFamily].failedRuns += 1;
      }
    }

    for (const run of latestCompletedRuns) {
      const sourceFamily = this.resolveSourceFamily(run.document.sourceType);
      const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);

      if (!this.shouldCountFailureSummary(run.status, failureSummary) || !failureSummary) {
        continue;
      }

      if (failureSummary.failedStage) {
        failureByStage[failureSummary.failedStage] = (failureByStage[failureSummary.failedStage] ?? 0) + 1;
      }

      if (failureSummary.retryable) {
        retryableFailures += 1;
        bySourceFamily[sourceFamily].retryableFailures += 1;
      } else {
        nonRetryableFailures += 1;
        bySourceFamily[sourceFamily].nonRetryableFailures += 1;
      }

      const boundarySummary = this.extractBoundarySummary(run.diagnosticsJson);
      if (boundarySummary) {
        boundaryStats.runsWithBoundaryHit += 1;
        bySourceFamily[sourceFamily].runsWithBoundaryHit += 1;
        boundaryStats.droppedPageUrlCount += boundarySummary.droppedPageUrlCount;
        boundaryStats.droppedChildSitemapCount += boundarySummary.droppedChildSitemapCount;
        boundaryStats.droppedFeedEntryCount += boundarySummary.droppedFeedEntryCount;

        for (const reason of boundarySummary.reasons) {
          boundaryStats.byReason[reason] = (boundaryStats.byReason[reason] ?? 0) + 1;
        }
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
    const latestPartialSourceFailure = this.findLatestRunAnchor(
      latestCompletedRuns,
      run => this.getDiagnosticsCode(run.diagnosticsJson) === "EXTERNAL_SOURCE_PARTIAL_SUCCESS"
    );
    const latestBoundaryHit = this.findLatestRunAnchor(latestCompletedRuns, run => this.isBoundaryHitDiagnostics(run.diagnosticsJson));
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
      bySourceFamily,
      retryableFailures,
      nonRetryableFailures,
      failureByStage,
      boundaryStats,
      latestRetryableFailure: latestRetryableFailure ? this.buildRunSummaryAnchor(latestRetryableFailure) : null,
      latestPartialSourceFailure: latestPartialSourceFailure ? this.buildRunSummaryAnchor(latestPartialSourceFailure) : null,
      latestBoundaryHit: latestBoundaryHit ? this.buildBoundaryRunSummaryAnchor(latestBoundaryHit) : null,
      latestSkipped: latestSkipped ? this.buildRunSummaryAnchor(latestSkipped) : null,
      latestFailure: latestFailure ? this.buildRunSummaryAnchor(latestFailure) : null
    };
  }

  async getKnowledgeBaseRunComparison(knowledgeBaseId: string, input: CompareKnowledgeBaseDocumentRunsInput) {
    if (typeof input.leftRunId === "string" && typeof input.rightRunId === "string") {
      const [leftRun, rightRun] = await Promise.all([
        this.getKnowledgeBaseRunById(knowledgeBaseId, input.leftRunId),
        this.getKnowledgeBaseRunById(knowledgeBaseId, input.rightRunId)
      ]);
      const leftSnapshot = this.buildRunComparisonSnapshot(leftRun);
      const rightSnapshot = this.buildRunComparisonSnapshot(rightRun);

      return {
        mode: "run",
        left: leftSnapshot,
        right: rightSnapshot,
        meaningfulDifferences: this.buildRunMeaningfulDifferences(leftSnapshot, rightSnapshot)
      };
    }

    const leftSinceHours = input.leftSinceHours as number;
    const rightSinceHours = input.rightSinceHours as number;
    const summaryFilters = {
      documentId: input.documentId,
      sourceType: input.sourceType,
      status: input.status,
      trigger: input.trigger,
      issueOnly: input.issueOnly
    } as const;
    const [leftSnapshot, rightSnapshot] = await Promise.all([
      this.getKnowledgeBaseRunSummary(knowledgeBaseId, {
        ...summaryFilters,
        sinceHours: leftSinceHours
      }),
      this.getKnowledgeBaseRunSummary(knowledgeBaseId, {
        ...summaryFilters,
        sinceHours: rightSinceHours
      })
    ]);

    return {
      mode: "snapshot",
      left: {
        sinceHours: leftSinceHours,
        summary: leftSnapshot
      },
      right: {
        sinceHours: rightSinceHours,
        summary: rightSnapshot
      },
      meaningfulDifferences: this.buildSummaryMeaningfulDifferences(leftSnapshot, rightSnapshot),
      sourceFamilyDeltas: this.buildSourceFamilyDeltas(leftSnapshot, rightSnapshot)
    };
  }

  private async getKnowledgeBaseRunById(knowledgeBaseId: string, runId: string) {
    const run = await this.prisma.documentRun.findFirst({
      where: {
        id: runId,
        document: {
          kbId: knowledgeBaseId
        }
      },
      select: {
        id: true,
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

    if (!run) {
      throw new NotFoundException(`Document run ${runId} not found.`);
    }

    return run;
  }

  private buildRunComparisonSnapshot(run: {
    id: string;
    documentId: string;
    version: number;
    trigger: DocumentRunTrigger;
    status: DocumentRunStatus;
    failedStage: DocumentRunFailedStage | null;
    diagnosticsJson: Prisma.JsonValue | null;
    startedAt: Date;
    finishedAt: Date | null;
    document: {
      sourceType: string;
      sourceName: string;
    };
  }) {
    const failureSummary = this.buildFailureSummary(run.diagnosticsJson, run.failedStage);
    const boundarySummary = this.extractBoundarySummary(run.diagnosticsJson);

    return {
      runId: run.id,
      documentId: run.documentId,
      version: run.version,
      trigger: run.trigger,
      status: run.status,
      failedStage: this.resolveOutputFailedStage(run.status, run.failedStage, failureSummary),
      failureSummary,
      sourceType: run.document.sourceType,
      sourceName: run.document.sourceName,
      boundarySummary,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt
    };
  }

  private buildRunMeaningfulDifferences(
    left: ReturnType<DocumentRunsService["buildRunComparisonSnapshot"]>,
    right: ReturnType<DocumentRunsService["buildRunComparisonSnapshot"]>
  ) {
    const differences: Array<{
      metric: string;
      left: string | number | boolean | null;
      right: string | number | boolean | null;
      summary: string;
    }> = [];

    if (left.status !== right.status) {
      differences.push({
        metric: "status",
        left: left.status,
        right: right.status,
        summary: `status changed from ${left.status} to ${right.status}`
      });
    }

    if (left.failedStage !== right.failedStage) {
      differences.push({
        metric: "failedStage",
        left: left.failedStage,
        right: right.failedStage,
        summary: `failed stage changed from ${left.failedStage ?? "none"} to ${right.failedStage ?? "none"}`
      });
    }

    if ((left.failureSummary?.code ?? null) !== (right.failureSummary?.code ?? null)) {
      differences.push({
        metric: "failureCode",
        left: left.failureSummary?.code ?? null,
        right: right.failureSummary?.code ?? null,
        summary: `failure code changed from ${left.failureSummary?.code ?? "none"} to ${right.failureSummary?.code ?? "none"}`
      });
    }

    if ((left.failureSummary?.retryable ?? false) !== (right.failureSummary?.retryable ?? false)) {
      differences.push({
        metric: "retryable",
        left: left.failureSummary?.retryable ?? false,
        right: right.failureSummary?.retryable ?? false,
        summary: `retryability changed from ${left.failureSummary?.retryable ?? false} to ${right.failureSummary?.retryable ?? false}`
      });
    }

    const leftBoundaryHit = left.boundarySummary !== null;
    const rightBoundaryHit = right.boundarySummary !== null;
    if (leftBoundaryHit !== rightBoundaryHit) {
      differences.push({
        metric: "boundaryHit",
        left: leftBoundaryHit,
        right: rightBoundaryHit,
        summary: `boundary-hit changed from ${leftBoundaryHit} to ${rightBoundaryHit}`
      });
    }

    return differences;
  }

  private buildSummaryMeaningfulDifferences(
    left: Awaited<ReturnType<DocumentRunsService["getKnowledgeBaseRunSummary"]>>,
    right: Awaited<ReturnType<DocumentRunsService["getKnowledgeBaseRunSummary"]>>
  ) {
    const differences: Array<{
      metric: string;
      left: number;
      right: number;
      delta: number;
      trend: "up" | "down";
      summary: string;
    }> = [];
    const trackedMetrics = [
      { metric: "totalRuns", left: left.totalRuns, right: right.totalRuns },
      { metric: "failedRuns", left: left.byStatus.failed, right: right.byStatus.failed },
      { metric: "retryableFailures", left: left.retryableFailures, right: right.retryableFailures },
      { metric: "nonRetryableFailures", left: left.nonRetryableFailures, right: right.nonRetryableFailures },
      {
        metric: "runsWithBoundaryHit",
        left: left.boundaryStats.runsWithBoundaryHit,
        right: right.boundaryStats.runsWithBoundaryHit
      }
    ];

    for (const item of trackedMetrics) {
      const delta = item.right - item.left;
      if (delta === 0) {
        continue;
      }

      differences.push({
        metric: item.metric,
        left: item.left,
        right: item.right,
        delta,
        trend: delta > 0 ? "up" : "down",
        summary: `${item.metric} changed by ${delta > 0 ? "+" : ""}${delta} (${item.left} -> ${item.right})`
      });
    }

    return differences;
  }

  private buildSourceFamilyDeltas(
    left: Awaited<ReturnType<DocumentRunsService["getKnowledgeBaseRunSummary"]>>,
    right: Awaited<ReturnType<DocumentRunsService["getKnowledgeBaseRunSummary"]>>
  ) {
    const sourceFamilies = Array.from(
      new Set([...Object.keys(left.bySourceFamily), ...Object.keys(right.bySourceFamily)])
    ).sort((a, b) => a.localeCompare(b));

    return sourceFamilies
      .map(sourceFamily => {
        const leftBucket = left.bySourceFamily[sourceFamily] ?? {
          totalRuns: 0,
          failedRuns: 0,
          retryableFailures: 0,
          nonRetryableFailures: 0,
          runsWithBoundaryHit: 0
        };
        const rightBucket = right.bySourceFamily[sourceFamily] ?? {
          totalRuns: 0,
          failedRuns: 0,
          retryableFailures: 0,
          nonRetryableFailures: 0,
          runsWithBoundaryHit: 0
        };
        const deltas = {
          totalRuns: rightBucket.totalRuns - leftBucket.totalRuns,
          failedRuns: rightBucket.failedRuns - leftBucket.failedRuns,
          retryableFailures: rightBucket.retryableFailures - leftBucket.retryableFailures,
          nonRetryableFailures: rightBucket.nonRetryableFailures - leftBucket.nonRetryableFailures,
          runsWithBoundaryHit: rightBucket.runsWithBoundaryHit - leftBucket.runsWithBoundaryHit
        };

        return {
          sourceFamily,
          left: leftBucket,
          right: rightBucket,
          deltas
        };
      })
      .filter(
        item =>
          item.deltas.totalRuns !== 0 ||
          item.deltas.failedRuns !== 0 ||
          item.deltas.retryableFailures !== 0 ||
          item.deltas.nonRetryableFailures !== 0 ||
          item.deltas.runsWithBoundaryHit !== 0
      );
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

    if (value.retryable === true) {
      return true;
    }

    if (value.retryable === false) {
      return false;
    }

    return typeof value.retryableFailureCount === "number" && value.retryableFailureCount > 0;
  }

  private isBoundaryHitDiagnostics(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return value.boundaryHit === true;
  }

  private extractBoundarySummary(value: Prisma.JsonValue | null) {
    if (!value || typeof value !== "object" || Array.isArray(value) || value.boundaryHit !== true) {
      return null;
    }

    const boundary =
      value.boundary && typeof value.boundary === "object" && !Array.isArray(value.boundary) ? value.boundary : null;
    const reasons = Array.isArray(value.boundaryReasons)
      ? value.boundaryReasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return {
      reasons,
      droppedPageUrlCount:
        boundary && typeof boundary.droppedPageUrlCount === "number" ? boundary.droppedPageUrlCount : 0,
      droppedChildSitemapCount:
        boundary && typeof boundary.droppedChildSitemapCount === "number" ? boundary.droppedChildSitemapCount : 0,
      droppedFeedEntryCount:
        boundary && typeof boundary.droppedByLimitCount === "number" ? boundary.droppedByLimitCount : 0
    };
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

  private buildBoundaryRunSummaryAnchor(run: {
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
    const anchor = this.buildRunSummaryAnchor(run);
    const boundarySummary = this.extractBoundarySummary(run.diagnosticsJson);

    return {
      ...anchor,
      boundarySummary: boundarySummary
        ? {
            reasons: boundarySummary.reasons,
            droppedPageUrlCount: boundarySummary.droppedPageUrlCount,
            droppedChildSitemapCount: boundarySummary.droppedChildSitemapCount,
            droppedFeedEntryCount: boundarySummary.droppedFeedEntryCount
          }
        : null
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

  private resolveSourceFamily(sourceType: string) {
    if (sourceType === "web_page") {
      return "web";
    }

    if (sourceType === "feed") {
      return "feed";
    }

    if (sourceType === "sitemap") {
      return "sitemap";
    }

    if (sourceType === "upload") {
      return "upload";
    }

    return "other";
  }
}
