import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type EvalQuestionSetStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import type { AuthIdentity } from "../auth/auth-identity.contract";
import { AskAssistantService } from "../assistants/ask-assistant.service";
import {
  type ChooseEvalQuestionSetBaselineInput,
  type CreateEvalQuestionSetInput,
  type RunEvalQuestionSetInput,
  type UpdateEvalQuestionSetInput
} from "./eval-question-set.schemas";

type EvalRunSummaryMetricKey =
  | "succeeded"
  | "failed"
  | "successRate"
  | "groundedRate"
  | "strongRate"
  | "fallbackRate"
  | "averageCitationCount";

type EvalRunSummary = {
  total: number;
  succeeded: number;
  failed: number;
  successRate: number;
  groundedRate: number;
  strongRate: number;
  fallbackRate: number;
  averageCitationCount: number;
};

type EvalRunComparisonMetric = {
  metric: EvalRunSummaryMetricKey;
  current: number;
  baseline: number;
  delta: number;
};

@Injectable()
export class EvalQuestionSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly askAssistantService: AskAssistantService
  ) {}

  async createQuestionSet(input: CreateEvalQuestionSetInput, identity: AuthIdentity) {
    await this.ensureTenant(identity.tenantId);
    await this.ensureOwner(identity.userId);

    return this.prisma.evalQuestionSet.create({
      data: {
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        questionsJson: input.questions as Prisma.InputJsonValue
      }
    });
  }

  async updateQuestionSet(id: string, input: UpdateEvalQuestionSetInput, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertEditable(questionSet.status, id);

    const hasEditableInput =
      input.name !== undefined || input.description !== undefined || input.questions !== undefined;

    if (!hasEditableInput) {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined
          ? {
              description: input.description
            }
          : {}),
        currentVersion: {
          increment: 1
        },
        ...(input.questions !== undefined
          ? {
              questionsJson: input.questions as Prisma.InputJsonValue
            }
          : {})
      }
    });
  }

  async snapshotBaseline(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertNotArchived(questionSet.status, id);

    const existingSnapshot = await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
      where: {
        questionSetId: id,
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        version: questionSet.currentVersion
      }
    });

    if (existingSnapshot) {
      return existingSnapshot;
    }

    return this.prisma.evalQuestionSetBaselineSnapshot.create({
      data: {
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        questionSetId: id,
        version: questionSet.currentVersion,
        name: questionSet.name,
        description: questionSet.description,
        questionsJson: questionSet.questionsJson as Prisma.InputJsonValue
      }
    });
  }

  async chooseBaselineSnapshot(id: string, input: ChooseEvalQuestionSetBaselineInput, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertNotArchived(questionSet.status, id);

    const snapshot = await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
      where: {
        id: input.snapshotId,
        questionSetId: id,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });

    if (!snapshot) {
      throw new NotFoundException(`Eval question set baseline snapshot ${input.snapshotId} not found.`);
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        baselineSnapshotId: snapshot.id,
        baselineChosenAt: new Date(),
        pinnedBaselineResultJson: Prisma.JsonNull,
        pinnedBaselineCapturedAt: null,
        latestEvalResultSummaryJson: Prisma.JsonNull,
        latestEvalRanAt: null
      }
    });
  }

  async compareWithBaseline(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (!questionSet.baselineSnapshotId) {
      return {
        hasBaseline: false,
        currentVersion: questionSet.currentVersion
      };
    }

    const snapshot = await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
      where: {
        id: questionSet.baselineSnapshotId,
        questionSetId: id,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });

    if (!snapshot) {
      throw new NotFoundException(`Eval question set baseline snapshot ${questionSet.baselineSnapshotId} not found.`);
    }

    const currentQuestions = this.readQuestions(questionSet.questionsJson);
    const baselineQuestions = this.readQuestions(snapshot.questionsJson);
    const currentQuestionSet = new Set(currentQuestions);
    const baselineQuestionSet = new Set(baselineQuestions);
    const addedQuestionCount = currentQuestions.filter(question => !baselineQuestionSet.has(question)).length;
    const removedQuestionCount = baselineQuestions.filter(question => !currentQuestionSet.has(question)).length;
    const unchangedQuestionCount = baselineQuestions.filter(question => currentQuestionSet.has(question)).length;

    const nameChanged = questionSet.name !== snapshot.name;
    const descriptionChanged = questionSet.description !== snapshot.description;
    const questionsChanged = addedQuestionCount > 0 || removedQuestionCount > 0;
    const latestEvalSummary = this.readEvalRunSummary(questionSet.latestEvalResultSummaryJson);
    const pinnedBaselineEvalSummary = this.readEvalRunSummary(questionSet.pinnedBaselineResultJson);
    const baselineComparison =
      latestEvalSummary && pinnedBaselineEvalSummary
        ? this.buildRunComparison(latestEvalSummary, pinnedBaselineEvalSummary)
        : null;

    return {
      hasBaseline: true,
      baselineSnapshotId: snapshot.id,
      baselineVersion: snapshot.version,
      currentVersion: questionSet.currentVersion,
      hasChanges: nameChanged || descriptionChanged || questionsChanged,
      changedFields: {
        name: nameChanged,
        description: descriptionChanged,
        questions: questionsChanged
      },
      questionDiff: {
        added: addedQuestionCount,
        removed: removedQuestionCount,
        unchanged: unchangedQuestionCount
      },
      evalResultComparison: {
        hasLatestEvalResult: latestEvalSummary != null,
        hasPinnedBaselineEvalResult: pinnedBaselineEvalSummary != null,
        latestEvalRanAt: questionSet.latestEvalRanAt ?? null,
        pinnedBaselineCapturedAt: questionSet.pinnedBaselineCapturedAt ?? null,
        ...(baselineComparison ? { deltas: baselineComparison } : {})
      }
    };
  }

  async runQuestionSet(id: string, input: RunEvalQuestionSetInput, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    const baselineSnapshotId = input.baselineSnapshotId ?? questionSet.baselineSnapshotId;
    if (!baselineSnapshotId) {
      throw new ConflictException(`Eval question set ${id} has no selected baseline snapshot.`);
    }

    const snapshot = await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
      where: {
        id: baselineSnapshotId,
        questionSetId: id,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });

    if (!snapshot) {
      throw new NotFoundException(`Eval question set baseline snapshot ${baselineSnapshotId} not found.`);
    }

    const questions = this.readQuestions(snapshot.questionsJson);
    const startedAt = new Date();
    const items: Array<{
      index: number;
      question: string;
      status: "succeeded" | "failed";
      traceId: string | null;
      conversationId: string | null;
      answerStatus: string | null;
      qualityOverall: string | null;
      qualityPrimaryIssue: string | null;
      citationCount: number;
      usedFallback: boolean | null;
      error: { message: string; code: string | null } | null;
    }> = [];

    for (const [index, question] of questions.entries()) {
      try {
        const result = await this.askAssistantService.askAssistant({
          assistantId: input.assistantId,
          question,
          authContext: {
            identity,
            currentIdentity: identity
          }
        });
        const qualityEvaluation = this.readObject(result.qualityEvaluation);
        const answeringMetadata = this.readObject(result.answeringMetadata);

        items.push({
          index: index + 1,
          question,
          status: "succeeded",
          traceId: this.readString(result.traceId),
          conversationId: this.readString(result.conversationId),
          answerStatus: this.readString(result.answerStatus),
          qualityOverall: this.readString(qualityEvaluation?.overall),
          qualityPrimaryIssue: this.readString(qualityEvaluation?.primaryIssue),
          citationCount: Array.isArray(result.citations) ? result.citations.length : 0,
          usedFallback: this.readBoolean(answeringMetadata?.usedFallback),
          error: null
        });
      } catch (error) {
        items.push({
          index: index + 1,
          question,
          status: "failed",
          traceId: this.readRunErrorTraceId(error),
          conversationId: null,
          answerStatus: null,
          qualityOverall: null,
          qualityPrimaryIssue: null,
          citationCount: 0,
          usedFallback: null,
          error: {
            message: this.readRunErrorMessage(error),
            code: this.readRunErrorCode(error)
          }
        });
      }
    }

    const finishedAt = new Date();
    const succeededCount = items.filter(item => item.status === "succeeded").length;
    const runSummary = this.buildRunSummary(items);
    const pinnedBaselineSummary = this.readEvalRunSummary(questionSet.pinnedBaselineResultJson);
    const shouldCapturePinnedBaseline = snapshot.id === questionSet.baselineSnapshotId && pinnedBaselineSummary == null;
    const baselineComparison = pinnedBaselineSummary ? this.buildRunComparison(runSummary, pinnedBaselineSummary) : null;

    await this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        latestEvalResultSummaryJson: runSummary as Prisma.InputJsonValue,
        latestEvalRanAt: finishedAt,
        ...(shouldCapturePinnedBaseline
          ? {
              pinnedBaselineResultJson: runSummary as Prisma.InputJsonValue,
              pinnedBaselineCapturedAt: finishedAt
            }
          : {})
      }
    });

    return {
      questionSetId: id,
      baselineSnapshotId: snapshot.id,
      baselineVersion: snapshot.version,
      assistantId: input.assistantId,
      startedAt,
      finishedAt,
      totals: {
        total: items.length,
        succeeded: succeededCount,
        failed: items.length - succeededCount
      },
      items,
      summary: runSummary,
      baselineComparison: {
        hasPinnedBaselineEvalResult: pinnedBaselineSummary != null,
        baselineCapturedAt: questionSet.pinnedBaselineCapturedAt ?? null,
        baselineInitialized: shouldCapturePinnedBaseline,
        ...(baselineComparison ? { deltas: baselineComparison } : {})
      }
    };
  }

  async lockQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === "archived") {
      throw new ConflictException(`Eval question set ${id} is archived and cannot be locked.`);
    }

    if (questionSet.status === "locked") {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: "locked",
        lockedAt: new Date()
      }
    });
  }

  async archiveQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === "archived") {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: "archived",
        archivedAt: new Date()
      }
    });
  }

  private async getOwnedQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.prisma.evalQuestionSet.findFirst({
      where: {
        id,
        tenantId: identity.tenantId,
        ownerId: identity.userId
      }
    });

    if (!questionSet) {
      throw new NotFoundException(`Eval question set ${id} not found.`);
    }

    return questionSet;
  }

  private async ensureTenant(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id }
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} not found.`);
    }
  }

  private async ensureOwner(id: string) {
    const owner = await this.prisma.user.findUnique({
      where: { id }
    });
    if (!owner) {
      throw new NotFoundException(`User ${id} not found.`);
    }
  }

  private assertEditable(status: EvalQuestionSetStatus, id: string) {
    if (status === "locked") {
      throw new ConflictException(`Eval question set ${id} is locked and cannot be edited.`);
    }

    if (status === "archived") {
      throw new ConflictException(`Eval question set ${id} is archived and cannot be edited.`);
    }
  }

  private assertNotArchived(status: EvalQuestionSetStatus, id: string) {
    if (status === "archived") {
      throw new ConflictException(`Eval question set ${id} is archived and cannot be changed.`);
    }
  }

  private readQuestions(input: Prisma.JsonValue) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.filter(question => typeof question === "string");
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
  }

  private readBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
  }

  private readRunErrorResponse(error: unknown): Record<string, unknown> | null {
    if (!(error instanceof Error) || !("getResponse" in error) || typeof error.getResponse !== "function") {
      return null;
    }

    const response = error.getResponse();
    return this.readObject(response);
  }

  private readRunErrorMessage(error: unknown): string {
    const response = this.readRunErrorResponse(error);
    if (response) {
      const rawMessage = response.message;
      if (typeof rawMessage === "string") {
        return rawMessage;
      }
      if (Array.isArray(rawMessage)) {
        const firstStringMessage = rawMessage.find(item => typeof item === "string");
        if (typeof firstStringMessage === "string") {
          return firstStringMessage;
        }
      }
    }

    return error instanceof Error ? error.message : "Unknown eval run failure.";
  }

  private readRunErrorCode(error: unknown): string | null {
    const response = this.readRunErrorResponse(error);
    return this.readString(response?.code);
  }

  private readRunErrorTraceId(error: unknown): string | null {
    const response = this.readRunErrorResponse(error);
    return this.readString(response?.traceId);
  }

  private buildRunSummary(
    items: Array<{
      status: "succeeded" | "failed";
      answerStatus: string | null;
      qualityOverall: string | null;
      citationCount: number;
      usedFallback: boolean | null;
    }>
  ): EvalRunSummary {
    const total = items.length;
    const succeeded = items.filter(item => item.status === "succeeded").length;
    const failed = total - succeeded;
    const grounded = items.filter(item => item.answerStatus === "grounded").length;
    const strong = items.filter(item => item.qualityOverall === "strong").length;
    const fallbackUsed = items.filter(item => item.usedFallback === true).length;
    const totalCitationCount = items.reduce((acc, item) => acc + item.citationCount, 0);

    return {
      total,
      succeeded,
      failed,
      successRate: this.toRate(succeeded, total),
      groundedRate: this.toRate(grounded, total),
      strongRate: this.toRate(strong, total),
      fallbackRate: this.toRate(fallbackUsed, total),
      averageCitationCount: this.roundMetric(total > 0 ? totalCitationCount / total : 0)
    };
  }

  private buildRunComparison(current: EvalRunSummary, baseline: EvalRunSummary) {
    const metrics: EvalRunComparisonMetric[] = [
      {
        metric: "succeeded",
        current: current.succeeded,
        baseline: baseline.succeeded,
        delta: current.succeeded - baseline.succeeded
      },
      {
        metric: "failed",
        current: current.failed,
        baseline: baseline.failed,
        delta: current.failed - baseline.failed
      },
      {
        metric: "successRate",
        current: current.successRate,
        baseline: baseline.successRate,
        delta: this.roundMetric(current.successRate - baseline.successRate)
      },
      {
        metric: "groundedRate",
        current: current.groundedRate,
        baseline: baseline.groundedRate,
        delta: this.roundMetric(current.groundedRate - baseline.groundedRate)
      },
      {
        metric: "strongRate",
        current: current.strongRate,
        baseline: baseline.strongRate,
        delta: this.roundMetric(current.strongRate - baseline.strongRate)
      },
      {
        metric: "fallbackRate",
        current: current.fallbackRate,
        baseline: baseline.fallbackRate,
        delta: this.roundMetric(current.fallbackRate - baseline.fallbackRate)
      },
      {
        metric: "averageCitationCount",
        current: current.averageCitationCount,
        baseline: baseline.averageCitationCount,
        delta: this.roundMetric(current.averageCitationCount - baseline.averageCitationCount)
      }
    ];

    return {
      metrics,
      meaningfulDeltas: metrics.filter(metric => metric.delta !== 0)
    };
  }

  private readEvalRunSummary(value: Prisma.JsonValue): EvalRunSummary | null {
    const raw = this.readObject(value);
    if (!raw) {
      return null;
    }

    const total = this.readNumber(raw.total);
    const succeeded = this.readNumber(raw.succeeded);
    const failed = this.readNumber(raw.failed);
    const successRate = this.readNumber(raw.successRate);
    const groundedRate = this.readNumber(raw.groundedRate);
    const strongRate = this.readNumber(raw.strongRate);
    const fallbackRate = this.readNumber(raw.fallbackRate);
    const averageCitationCount = this.readNumber(raw.averageCitationCount);

    if (
      total == null ||
      succeeded == null ||
      failed == null ||
      successRate == null ||
      groundedRate == null ||
      strongRate == null ||
      fallbackRate == null ||
      averageCitationCount == null
    ) {
      return null;
    }

    return {
      total,
      succeeded,
      failed,
      successRate,
      groundedRate,
      strongRate,
      fallbackRate,
      averageCitationCount
    };
  }

  private readNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  private toRate(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }
    return this.roundMetric(value / total);
  }

  private roundMetric(value: number): number {
    return Math.round(value * 1000) / 1000;
  }
}
