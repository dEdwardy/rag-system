import {
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, type EvalQuestionSetStatus } from '@prisma/client';
import { PrismaService } from '../../infra/database/prisma.service';
import type { AuthIdentity } from '../auth/auth-identity.contract';
import { AskAssistantService } from '../assistants/ask-assistant.service';
import {
  type ChooseEvalQuestionSetBaselineInput,
  type CreateEvalQuestionSetInput,
  type RunEvalQuestionSetInput,
  type UpdateEvalQuestionSetInput
} from './eval-question-set.schemas';

type EvalRunSummaryMetricKey =
  | 'succeeded'
  | 'failed'
  | 'successRate'
  | 'groundedRate'
  | 'strongRate'
  | 'fallbackRate'
  | 'averageCitationCount';

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

type EvalRunQualityGateMode = 'warn' | 'fail';

type EvalRunQualityGateMetricKey =
  | 'successRate'
  | 'groundedRate'
  | 'strongRate'
  | 'fallbackRate'
  | 'averageCitationCount';

type EvalRunQualityGateMetricLimit =
  | {
      metric: EvalRunQualityGateMetricKey;
      limitType: 'min';
      limit: number;
    }
  | {
      metric: EvalRunQualityGateMetricKey;
      limitType: 'max';
      limit: number;
    };

type EvalRunQualityGateThreshold = {
  metric: EvalRunQualityGateMetricKey;
  limitType: 'min' | 'max';
  limit: number;
};

type EvalRunQualityGateBreach = {
  metric: EvalRunQualityGateMetricKey;
  limitType: 'min' | 'max';
  limit: number;
  current: number;
  delta: number;
};

type EvalRunQualityGate = {
  mode: EvalRunQualityGateMode;
  status: 'passed' | 'warning' | 'failed';
  limitVersion: string;
  thresholds: EvalRunQualityGateThreshold[];
  breachedMetricCount: number;
  breachedMetrics: EvalRunQualityGateBreach[];
  message: string;
};

type EvalRunComparisonMetric = {
  metric: EvalRunSummaryMetricKey;
  current: number;
  baseline: number;
  delta: number;
};

type EvalRunDiffMetricDirection = 'regressed' | 'improved';

type EvalRunDiffReasonCount = {
  reasonCode: EvalRunRegressionReasonCode;
  count: number;
};

type EvalRunDiffSummary = {
  headline: string;
  regressedMetricCount: number;
  improvedMetricCount: number;
  unchangedMetricCount: number;
  regressedQuestionCount: number;
  regressedMetrics: EvalRunComparisonMetric[];
  improvedMetrics: EvalRunComparisonMetric[];
  topRegressionReasons: EvalRunDiffReasonCount[];
};

type EvalRunRegressionReasonCode =
  | 'became_failed'
  | 'became_insufficient_context'
  | 'quality_degraded'
  | 'fallback_introduced'
  | 'citations_decreased';

type EvalRunQuestionSnapshot = {
  status: 'succeeded' | 'failed';
  answerStatus: string | null;
  qualityOverall: string | null;
  qualityPrimaryIssue: string | null;
  citationCount: number;
  usedFallback: boolean | null;
};

type EvalQuestionAskResultView = {
  traceId?: unknown;
  conversationId?: unknown;
  answerStatus?: unknown;
  qualityEvaluation?: unknown;
  answeringMetadata?: unknown;
  citations?: unknown;
};

type EvalRunQuestionRegression = {
  index: number;
  question: string;
  severity: 'critical' | 'high' | 'medium';
  reasonCodes: EvalRunRegressionReasonCode[];
  baseline: EvalRunQuestionSnapshot;
  current: EvalRunQuestionSnapshot & {
    error: { message: string; code: string | null } | null;
  };
};

type EvalQuestionSetDriftSummary = {
  hasDrift: boolean;
  currentQuestionCount: number;
  baselineQuestionCount: number;
  addedQuestionCount: number;
  removedQuestionCount: number;
  unchangedQuestionCount: number;
};

type EvalRunItem = {
  index: number;
  question: string;
  status: 'succeeded' | 'failed';
  traceId: string | null;
  conversationId: string | null;
  answerStatus: string | null;
  qualityOverall: string | null;
  qualityPrimaryIssue: string | null;
  citationCount: number;
  usedFallback: boolean | null;
  error: { message: string; code: string | null } | null;
};

type EvalQuestionSetRunResultPayload = {
  questionSetId: string;
  baselineSnapshotId: string;
  baselineVersion: number;
  assistantId: string;
  startedAt: Date;
  finishedAt: Date;
  totals: {
    total: number;
    succeeded: number;
    failed: number;
  };
  items: EvalRunItem[];
  summary: EvalRunSummary;
  qualityGate: EvalRunQualityGate;
  baselineComparison: {
    hasPinnedBaselineEvalResult: boolean;
    baselineCapturedAt: Date | null;
    baselineInitialized: boolean;
    comparisonMeaningful: boolean;
    questionSetDrift: EvalQuestionSetDriftSummary;
    deltas?: {
      metrics: EvalRunComparisonMetric[];
      meaningfulDeltas: EvalRunComparisonMetric[];
    };
    failureDrilldown?: {
      regressedQuestionCount: number;
      weakestItems: EvalRunQuestionRegression[];
    };
    diffSummary?: EvalRunDiffSummary;
  };
};

type EvalRunReportExportFormat = 'markdown' | 'json' | 'html';

type EvalRunReportExport = {
  format: EvalRunReportExportFormat;
  fileName: string;
  mimeType: string;
  content: string;
};

type EvalRunReportExports = Record<
  EvalRunReportExportFormat,
  EvalRunReportExport
>;

type EvalPinnedBaselineRunPayload = {
  summary: EvalRunSummary;
  items: EvalRunQuestionSnapshot[];
};

const P5_V1_DEMO_REPLAY_NAME = 'p5-v1-demo-replay';
const P5_V1_DEMO_REPLAY_ASSISTANT_ID = 'default-assistant';
const P5_V1_QUALITY_GATE_LIMIT_VERSION = 'p5_v1_core_quality_gate_v1';
const P5_V1_QUALITY_GATE_LIMITS: EvalRunQualityGateMetricLimit[] = [
  { metric: 'successRate', limitType: 'min', limit: 0.8 },
  { metric: 'groundedRate', limitType: 'min', limit: 0.75 },
  { metric: 'strongRate', limitType: 'min', limit: 0.6 },
  { metric: 'fallbackRate', limitType: 'max', limit: 0.35 },
  { metric: 'averageCitationCount', limitType: 'min', limit: 0.8 }
];
const P5_V1_AGENTIC_EVAL_BASELINE = {
  description:
    'Reusable agentic RAG baseline covering knowledge-base ask, deterministic policy ask, and explicit external-source ask.',
  scenarios: [
    {
      id: 'knowledge-base-ask',
      routeType: 'knowledge_base',
      question:
        'Summarize one key capability of this knowledge base and cite evidence.'
    },
    {
      id: 'policy-ask',
      routeType: 'policy_reply',
      question:
        'When should this system answer with a deterministic policy reply instead of searching the knowledge base?'
    },
    {
      id: 'external-source-ask',
      routeType: 'external_source',
      question:
        'Use https://example.com/agentic-eval-baseline as an external source and summarize the page.'
    }
  ]
} as const;
const P5_V1_DEMO_REPLAY_QUESTIONS = P5_V1_AGENTIC_EVAL_BASELINE.scenarios.map(
  (scenario) => scenario.question
);

@Injectable()
export class EvalQuestionSetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly askAssistantService: AskAssistantService
  ) {}

  async createQuestionSet(
    input: CreateEvalQuestionSetInput,
    identity: AuthIdentity
  ) {
    await this.ensureTenant(identity.tenantId);
    await this.ensureOwner(identity.userId);

    return this.prisma.evalQuestionSet.create({
      data: {
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        name: input.name,
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        questionsJson: input.questions as Prisma.InputJsonValue
      }
    });
  }

  async listQuestionSets(identity: AuthIdentity) {
    await this.ensureTenant(identity.tenantId);
    await this.ensureOwner(identity.userId);

    const questionSets = await this.prisma.evalQuestionSet.findMany({
      where: {
        tenantId: identity.tenantId,
        ownerId: identity.userId
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        baselineSnapshot: {
          select: {
            id: true,
            version: true,
            createdAt: true
          }
        },
        snapshots: {
          select: {
            id: true
          }
        }
      }
    });

    return questionSets.map((questionSet) => ({
      id: questionSet.id,
      name: questionSet.name,
      description: questionSet.description,
      status: questionSet.status,
      currentVersion: questionSet.currentVersion,
      questionCount: this.readQuestions(questionSet.questionsJson).length,
      baselineSnapshotId: questionSet.baselineSnapshotId,
      baselineChosenAt: questionSet.baselineChosenAt,
      baselineVersion: questionSet.baselineSnapshot?.version ?? null,
      baselineSnapshotCreatedAt:
        questionSet.baselineSnapshot?.createdAt ?? null,
      latestEvalRanAt: questionSet.latestEvalRanAt,
      snapshotCount: questionSet.snapshots.length,
      createdAt: questionSet.createdAt,
      updatedAt: questionSet.updatedAt
    }));
  }

  async listBaselineSnapshots(id: string, identity: AuthIdentity) {
    await this.getOwnedQuestionSet(id, identity);

    const snapshots =
      await this.prisma.evalQuestionSetBaselineSnapshot.findMany({
        where: {
          questionSetId: id,
          tenantId: identity.tenantId,
          ownerId: identity.userId
        },
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }]
      });

    return snapshots.map((snapshot) => ({
      id: snapshot.id,
      questionSetId: snapshot.questionSetId,
      version: snapshot.version,
      name: snapshot.name,
      description: snapshot.description,
      questionCount: this.readQuestions(snapshot.questionsJson).length,
      createdAt: snapshot.createdAt
    }));
  }

  async updateQuestionSet(
    id: string,
    input: UpdateEvalQuestionSetInput,
    identity: AuthIdentity
  ) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertEditable(questionSet.status, id);

    const hasEditableInput =
      input.name !== undefined ||
      input.description !== undefined ||
      input.questions !== undefined;

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

    const existingSnapshot =
      await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
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

  async chooseBaselineSnapshot(
    id: string,
    input: ChooseEvalQuestionSetBaselineInput,
    identity: AuthIdentity
  ) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    this.assertNotArchived(questionSet.status, id);

    const snapshot =
      await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
        where: {
          id: input.snapshotId,
          questionSetId: id,
          tenantId: identity.tenantId,
          ownerId: identity.userId
        }
      });

    if (!snapshot) {
      throw new NotFoundException(
        `Eval question set baseline snapshot ${input.snapshotId} not found.`
      );
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

    const snapshot =
      await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
        where: {
          id: questionSet.baselineSnapshotId,
          questionSetId: id,
          tenantId: identity.tenantId,
          ownerId: identity.userId
        }
      });

    if (!snapshot) {
      throw new NotFoundException(
        `Eval question set baseline snapshot ${questionSet.baselineSnapshotId} not found.`
      );
    }

    const currentQuestions = this.readQuestions(questionSet.questionsJson);
    const baselineQuestions = this.readQuestions(snapshot.questionsJson);
    const questionSetDrift = this.buildQuestionSetDrift(
      currentQuestions,
      baselineQuestions
    );

    const nameChanged = questionSet.name !== snapshot.name;
    const descriptionChanged = questionSet.description !== snapshot.description;
    const questionsChanged = questionSetDrift.hasDrift;
    const latestEvalSummary = this.readEvalRunSummary(
      questionSet.latestEvalResultSummaryJson
    );
    const pinnedBaselineEvalSummary = this.readEvalRunSummary(
      questionSet.pinnedBaselineResultJson
    );
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
        added: questionSetDrift.addedQuestionCount,
        removed: questionSetDrift.removedQuestionCount,
        unchanged: questionSetDrift.unchangedQuestionCount
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

  async runQuestionSet(
    id: string,
    input: RunEvalQuestionSetInput,
    identity: AuthIdentity
  ) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);
    const baselineSnapshotId =
      input.baselineSnapshotId ?? questionSet.baselineSnapshotId;
    const qualityGateMode: EvalRunQualityGateMode =
      input.qualityGateMode ?? 'warn';
    if (!baselineSnapshotId) {
      throw new ConflictException(
        `Eval question set ${id} has no selected baseline snapshot.`
      );
    }

    const snapshot =
      await this.prisma.evalQuestionSetBaselineSnapshot.findFirst({
        where: {
          id: baselineSnapshotId,
          questionSetId: id,
          tenantId: identity.tenantId,
          ownerId: identity.userId
        }
      });

    if (!snapshot) {
      throw new NotFoundException(
        `Eval question set baseline snapshot ${baselineSnapshotId} not found.`
      );
    }

    const questions = this.readQuestions(snapshot.questionsJson);
    const currentQuestions = this.readQuestions(questionSet.questionsJson);
    const questionSetDrift = this.buildQuestionSetDrift(
      currentQuestions,
      questions
    );
    const comparisonMeaningful = !questionSetDrift.hasDrift;
    const startedAt = new Date();
    const items: EvalRunItem[] = [];

    for (const [index, question] of questions.entries()) {
      try {
        const result = (await this.askAssistantService.askAssistant({
          assistantId: input.assistantId,
          question,
          authContext: {
            identity,
            currentIdentity: identity
          }
        })) as EvalQuestionAskResultView;
        const qualityEvaluation = this.readObject(result.qualityEvaluation);
        const answeringMetadata = this.readObject(result.answeringMetadata);

        items.push({
          index: index + 1,
          question,
          status: 'succeeded',
          traceId: this.readString(result.traceId),
          conversationId: this.readString(result.conversationId),
          answerStatus: this.readString(result.answerStatus),
          qualityOverall: this.readString(qualityEvaluation?.overall),
          qualityPrimaryIssue: this.readString(qualityEvaluation?.primaryIssue),
          citationCount: Array.isArray(result.citations)
            ? result.citations.length
            : 0,
          usedFallback: this.readBoolean(answeringMetadata?.usedFallback),
          error: null
        });
      } catch (error) {
        items.push({
          index: index + 1,
          question,
          status: 'failed',
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
    const succeededCount = items.filter(
      (item) => item.status === 'succeeded'
    ).length;
    const runSummary = this.buildRunSummary(items);
    const qualityGate = this.evaluateQualityGate(runSummary, qualityGateMode);
    const pinnedBaselineSummary = this.readEvalRunSummary(
      questionSet.pinnedBaselineResultJson
    );
    const pinnedBaselineItems = this.readPinnedBaselineRunItems(
      questionSet.pinnedBaselineResultJson
    );
    const shouldCapturePinnedBaseline =
      snapshot.id === questionSet.baselineSnapshotId &&
      pinnedBaselineSummary == null;
    const baselineComparison =
      pinnedBaselineSummary && comparisonMeaningful
        ? this.buildRunComparison(runSummary, pinnedBaselineSummary)
        : null;
    const failureDrilldown =
      pinnedBaselineItems && comparisonMeaningful
        ? this.buildFailureDrilldown(items, pinnedBaselineItems)
        : null;
    const diffSummary = baselineComparison
      ? this.buildRunDiffSummary(baselineComparison.metrics, failureDrilldown)
      : null;

    await this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        latestEvalResultSummaryJson: runSummary as Prisma.InputJsonValue,
        latestEvalRanAt: finishedAt,
        ...(shouldCapturePinnedBaseline
          ? {
              pinnedBaselineResultJson: {
                summary: runSummary,
                items: this.toPinnedBaselineRunItems(items)
              } as Prisma.InputJsonValue,
              pinnedBaselineCapturedAt: finishedAt
            }
          : {})
      }
    });

    const runResult: EvalQuestionSetRunResultPayload = {
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
      qualityGate,
      baselineComparison: {
        hasPinnedBaselineEvalResult: pinnedBaselineSummary != null,
        baselineCapturedAt: questionSet.pinnedBaselineCapturedAt ?? null,
        baselineInitialized: shouldCapturePinnedBaseline,
        comparisonMeaningful,
        questionSetDrift,
        ...(baselineComparison ? { deltas: baselineComparison } : {}),
        ...(failureDrilldown ? { failureDrilldown } : {}),
        ...(diffSummary ? { diffSummary } : {})
      }
    };

    const runResponse = {
      ...runResult,
      reportExports: this.buildRunReportExports(runResult)
    };

    if (qualityGate.status === 'failed') {
      throw new ConflictException({
        message: 'Eval quality gate failed.',
        code: 'EVAL_QUALITY_GATE_FAILED',
        qualityGate,
        runResult: runResponse
      });
    }

    return runResponse;
  }

  async runP5V1DemoReplay(identity: AuthIdentity) {
    await this.ensureTenant(identity.tenantId);
    await this.ensureOwner(identity.userId);

    const questionSet = await this.ensureP5V1DemoQuestionSet(identity);
    const snapshot = await this.snapshotBaseline(questionSet.id, identity);
    const chosenQuestionSet = await this.chooseBaselineSnapshot(
      questionSet.id,
      {
        snapshotId: snapshot.id
      },
      identity
    );
    const runResult = await this.runQuestionSet(
      chosenQuestionSet.id,
      {
        assistantId: P5_V1_DEMO_REPLAY_ASSISTANT_ID,
        baselineSnapshotId: snapshot.id
      },
      identity
    );

    return {
      replayEntry: {
        id: 'p5-v1',
        name: P5_V1_DEMO_REPLAY_NAME,
        assistantId: P5_V1_DEMO_REPLAY_ASSISTANT_ID,
        questionCount: P5_V1_AGENTIC_EVAL_BASELINE.scenarios.length
      },
      ...runResult
    };
  }

  async lockQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === 'archived') {
      throw new ConflictException(
        `Eval question set ${id} is archived and cannot be locked.`
      );
    }

    if (questionSet.status === 'locked') {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: 'locked',
        lockedAt: new Date()
      }
    });
  }

  async archiveQuestionSet(id: string, identity: AuthIdentity) {
    const questionSet = await this.getOwnedQuestionSet(id, identity);

    if (questionSet.status === 'archived') {
      return questionSet;
    }

    return this.prisma.evalQuestionSet.update({
      where: { id },
      data: {
        status: 'archived',
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

  private async ensureP5V1DemoQuestionSet(identity: AuthIdentity) {
    const existing = await this.prisma.evalQuestionSet.findFirst({
      where: {
        tenantId: identity.tenantId,
        ownerId: identity.userId,
        name: P5_V1_DEMO_REPLAY_NAME
      }
    });

    if (!existing) {
      return this.createQuestionSet(
        {
          name: P5_V1_DEMO_REPLAY_NAME,
          description: P5_V1_AGENTIC_EVAL_BASELINE.description,
          questions: P5_V1_DEMO_REPLAY_QUESTIONS
        },
        identity
      );
    }

    return this.prisma.evalQuestionSet.update({
      where: {
        id: existing.id
      },
      data: {
        description: P5_V1_AGENTIC_EVAL_BASELINE.description,
        questionsJson: P5_V1_DEMO_REPLAY_QUESTIONS as Prisma.InputJsonValue,
        currentVersion: {
          increment: 1
        },
        status: 'draft'
      }
    });
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
    if (status === 'locked') {
      throw new ConflictException(
        `Eval question set ${id} is locked and cannot be edited.`
      );
    }

    if (status === 'archived') {
      throw new ConflictException(
        `Eval question set ${id} is archived and cannot be edited.`
      );
    }
  }

  private assertNotArchived(status: EvalQuestionSetStatus, id: string) {
    if (status === 'archived') {
      throw new ConflictException(
        `Eval question set ${id} is archived and cannot be changed.`
      );
    }
  }

  private readQuestions(input: Prisma.JsonValue) {
    if (!Array.isArray(input)) {
      return [];
    }

    return input.filter((question) => typeof question === 'string');
  }

  private readObject(value: unknown): Record<string, unknown> | null {
    return typeof value === 'object' && value !== null
      ? (value as Record<string, unknown>)
      : null;
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private readBoolean(value: unknown): boolean | null {
    return typeof value === 'boolean' ? value : null;
  }

  private readRunErrorResponse(error: unknown): Record<string, unknown> | null {
    if (
      !(error instanceof Error) ||
      !('getResponse' in error) ||
      typeof error.getResponse !== 'function'
    ) {
      return null;
    }

    const response = error.getResponse();
    return this.readObject(response);
  }

  private readRunErrorMessage(error: unknown): string {
    const response = this.readRunErrorResponse(error);
    if (response) {
      const rawMessage = response.message;
      if (typeof rawMessage === 'string') {
        return rawMessage;
      }
      if (Array.isArray(rawMessage)) {
        const firstStringMessage = rawMessage.find(
          (item) => typeof item === 'string'
        );
        if (typeof firstStringMessage === 'string') {
          return firstStringMessage;
        }
      }
    }

    return error instanceof Error ? error.message : 'Unknown eval run failure.';
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
      status: 'succeeded' | 'failed';
      answerStatus: string | null;
      qualityOverall: string | null;
      citationCount: number;
      usedFallback: boolean | null;
    }>
  ): EvalRunSummary {
    const total = items.length;
    const succeeded = items.filter(
      (item) => item.status === 'succeeded'
    ).length;
    const failed = total - succeeded;
    const grounded = items.filter(
      (item) => item.answerStatus === 'grounded'
    ).length;
    const strong = items.filter(
      (item) => item.qualityOverall === 'strong'
    ).length;
    const fallbackUsed = items.filter(
      (item) => item.usedFallback === true
    ).length;
    const totalCitationCount = items.reduce(
      (acc, item) => acc + item.citationCount,
      0
    );

    return {
      total,
      succeeded,
      failed,
      successRate: this.toRate(succeeded, total),
      groundedRate: this.toRate(grounded, total),
      strongRate: this.toRate(strong, total),
      fallbackRate: this.toRate(fallbackUsed, total),
      averageCitationCount: this.roundMetric(
        total > 0 ? totalCitationCount / total : 0
      )
    };
  }

  private evaluateQualityGate(
    summary: EvalRunSummary,
    mode: EvalRunQualityGateMode
  ): EvalRunQualityGate {
    const thresholds: EvalRunQualityGateThreshold[] =
      P5_V1_QUALITY_GATE_LIMITS.map((limit) => ({
        metric: limit.metric,
        limitType: limit.limitType,
        limit: limit.limit
      }));
    const breachedMetrics: EvalRunQualityGateBreach[] = [];

    for (const limit of P5_V1_QUALITY_GATE_LIMITS) {
      const current = summary[limit.metric];
      if (limit.limitType === 'min') {
        if (current < limit.limit) {
          breachedMetrics.push({
            metric: limit.metric,
            limitType: 'min',
            limit: limit.limit,
            current,
            delta: this.roundMetric(current - limit.limit)
          });
        }
        continue;
      }

      if (current > limit.limit) {
        breachedMetrics.push({
          metric: limit.metric,
          limitType: 'max',
          limit: limit.limit,
          current,
          delta: this.roundMetric(current - limit.limit)
        });
      }
    }

    if (breachedMetrics.length === 0) {
      return {
        mode,
        status: 'passed',
        limitVersion: P5_V1_QUALITY_GATE_LIMIT_VERSION,
        thresholds,
        breachedMetricCount: 0,
        breachedMetrics,
        message: 'All core quality metrics are within P5 v1 limits.'
      };
    }

    return {
      mode,
      status: mode === 'fail' ? 'failed' : 'warning',
      limitVersion: P5_V1_QUALITY_GATE_LIMIT_VERSION,
      thresholds,
      breachedMetricCount: breachedMetrics.length,
      breachedMetrics,
      message: `${breachedMetrics.length} core quality metric(s) crossed P5 v1 limits.`
    };
  }

  private buildRunComparison(
    current: EvalRunSummary,
    baseline: EvalRunSummary
  ) {
    const metrics: EvalRunComparisonMetric[] = [
      {
        metric: 'succeeded',
        current: current.succeeded,
        baseline: baseline.succeeded,
        delta: current.succeeded - baseline.succeeded
      },
      {
        metric: 'failed',
        current: current.failed,
        baseline: baseline.failed,
        delta: current.failed - baseline.failed
      },
      {
        metric: 'successRate',
        current: current.successRate,
        baseline: baseline.successRate,
        delta: this.roundMetric(current.successRate - baseline.successRate)
      },
      {
        metric: 'groundedRate',
        current: current.groundedRate,
        baseline: baseline.groundedRate,
        delta: this.roundMetric(current.groundedRate - baseline.groundedRate)
      },
      {
        metric: 'strongRate',
        current: current.strongRate,
        baseline: baseline.strongRate,
        delta: this.roundMetric(current.strongRate - baseline.strongRate)
      },
      {
        metric: 'fallbackRate',
        current: current.fallbackRate,
        baseline: baseline.fallbackRate,
        delta: this.roundMetric(current.fallbackRate - baseline.fallbackRate)
      },
      {
        metric: 'averageCitationCount',
        current: current.averageCitationCount,
        baseline: baseline.averageCitationCount,
        delta: this.roundMetric(
          current.averageCitationCount - baseline.averageCitationCount
        )
      }
    ];

    return {
      metrics,
      meaningfulDeltas: metrics.filter((metric) => metric.delta !== 0)
    };
  }

  private readEvalRunSummary(value: Prisma.JsonValue): EvalRunSummary | null {
    const raw = this.readObject(value);
    if (!raw) {
      return null;
    }

    const rawSummary = this.readObject(raw.summary) ?? raw;

    const total = this.readNumber(rawSummary.total);
    const succeeded = this.readNumber(rawSummary.succeeded);
    const failed = this.readNumber(rawSummary.failed);
    const successRate = this.readNumber(rawSummary.successRate);
    const groundedRate = this.readNumber(rawSummary.groundedRate);
    const strongRate = this.readNumber(rawSummary.strongRate);
    const fallbackRate = this.readNumber(rawSummary.fallbackRate);
    const averageCitationCount = this.readNumber(
      rawSummary.averageCitationCount
    );

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

  private readPinnedBaselineRunItems(
    value: Prisma.JsonValue
  ): EvalRunQuestionSnapshot[] | null {
    const payload = this.readPinnedBaselineRunPayload(value);
    return payload ? payload.items : null;
  }

  private readPinnedBaselineRunPayload(
    value: Prisma.JsonValue
  ): EvalPinnedBaselineRunPayload | null {
    const raw = this.readObject(value);
    if (!raw) {
      return null;
    }

    const summary = this.readEvalRunSummary(raw as Prisma.JsonValue);
    const rawItems = raw.items;
    if (!summary || !Array.isArray(rawItems)) {
      return null;
    }

    const items = rawItems
      .map((item) => this.readPinnedBaselineRunItem(item))
      .filter((item): item is EvalRunQuestionSnapshot => item != null);

    if (items.length === 0) {
      return null;
    }

    return {
      summary,
      items
    };
  }

  private readPinnedBaselineRunItem(
    value: unknown
  ): EvalRunQuestionSnapshot | null {
    const raw = this.readObject(value);
    if (!raw) {
      return null;
    }

    const status = this.readRunItemStatus(raw.status);
    const citationCount = this.readNumber(raw.citationCount);

    if (!status || citationCount == null) {
      return null;
    }

    return {
      status,
      answerStatus: this.readString(raw.answerStatus),
      qualityOverall: this.readString(raw.qualityOverall),
      qualityPrimaryIssue: this.readString(raw.qualityPrimaryIssue),
      citationCount,
      usedFallback: this.readBoolean(raw.usedFallback)
    };
  }

  private toPinnedBaselineRunItems(
    items: EvalRunItem[]
  ): EvalRunQuestionSnapshot[] {
    return items.map((item) => ({
      status: item.status,
      answerStatus: item.answerStatus,
      qualityOverall: item.qualityOverall,
      qualityPrimaryIssue: item.qualityPrimaryIssue,
      citationCount: item.citationCount,
      usedFallback: item.usedFallback
    }));
  }

  private buildFailureDrilldown(
    currentItems: EvalRunItem[],
    baselineItems: EvalRunQuestionSnapshot[]
  ):
    | EvalQuestionSetRunResultPayload['baselineComparison']['failureDrilldown']
    | null {
    if (currentItems.length !== baselineItems.length) {
      return null;
    }

    const regressedItems = currentItems
      .map((currentItem, index) =>
        this.buildQuestionRegression(currentItem, baselineItems[index])
      )
      .filter((item): item is EvalRunQuestionRegression => item != null)
      .sort((left, right) => {
        const severityWeight = {
          critical: 0,
          high: 1,
          medium: 2
        } as const;

        const severityDelta =
          severityWeight[left.severity] - severityWeight[right.severity];
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return left.index - right.index;
      });

    return {
      regressedQuestionCount: regressedItems.length,
      weakestItems: regressedItems.slice(0, 5)
    };
  }

  private buildRunDiffSummary(
    metrics: EvalRunComparisonMetric[],
    failureDrilldown:
      | EvalQuestionSetRunResultPayload['baselineComparison']['failureDrilldown']
      | null
  ): EvalRunDiffSummary {
    const regressedMetrics = metrics.filter(
      (metric) => this.readMetricDiffDirection(metric) === 'regressed'
    );
    const improvedMetrics = metrics.filter(
      (metric) => this.readMetricDiffDirection(metric) === 'improved'
    );
    const unchangedMetricCount =
      metrics.length - regressedMetrics.length - improvedMetrics.length;
    const regressedQuestionCount =
      failureDrilldown?.regressedQuestionCount ?? 0;
    const topRegressionReasons =
      this.summarizeRegressionReasons(failureDrilldown);

    return {
      headline: this.buildRunDiffHeadline({
        regressedMetricCount: regressedMetrics.length,
        improvedMetricCount: improvedMetrics.length,
        unchangedMetricCount,
        regressedQuestionCount
      }),
      regressedMetricCount: regressedMetrics.length,
      improvedMetricCount: improvedMetrics.length,
      unchangedMetricCount,
      regressedQuestionCount,
      regressedMetrics,
      improvedMetrics,
      topRegressionReasons
    };
  }

  private summarizeRegressionReasons(
    failureDrilldown:
      | EvalQuestionSetRunResultPayload['baselineComparison']['failureDrilldown']
      | null
  ): EvalRunDiffReasonCount[] {
    if (!failureDrilldown) {
      return [];
    }

    const reasonCounts = new Map<EvalRunRegressionReasonCode, number>();
    for (const item of failureDrilldown.weakestItems) {
      for (const reasonCode of item.reasonCodes) {
        reasonCounts.set(reasonCode, (reasonCounts.get(reasonCode) ?? 0) + 1);
      }
    }

    return Array.from(reasonCounts.entries())
      .map(([reasonCode, count]) => ({ reasonCode, count }))
      .sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        return left.reasonCode.localeCompare(right.reasonCode);
      })
      .slice(0, 5);
  }

  private buildRunDiffHeadline(input: {
    regressedMetricCount: number;
    improvedMetricCount: number;
    unchangedMetricCount: number;
    regressedQuestionCount: number;
  }): string {
    return [
      `metrics regressed: ${input.regressedMetricCount}`,
      `improved: ${input.improvedMetricCount}`,
      `unchanged: ${input.unchangedMetricCount}`,
      `regressed questions: ${input.regressedQuestionCount}`
    ].join('; ');
  }

  private readMetricDiffDirection(
    metric: EvalRunComparisonMetric
  ): EvalRunDiffMetricDirection | null {
    if (metric.delta === 0) {
      return null;
    }

    const higherIsBetter =
      metric.metric === 'succeeded' ||
      metric.metric === 'successRate' ||
      metric.metric === 'groundedRate' ||
      metric.metric === 'strongRate' ||
      metric.metric === 'averageCitationCount';

    if (higherIsBetter) {
      return metric.delta < 0 ? 'regressed' : 'improved';
    }

    return metric.delta > 0 ? 'regressed' : 'improved';
  }

  private buildQuestionRegression(
    current: EvalRunItem,
    baseline: EvalRunQuestionSnapshot
  ): EvalRunQuestionRegression | null {
    const reasonCodes: EvalRunRegressionReasonCode[] = [];

    if (baseline.status === 'succeeded' && current.status === 'failed') {
      reasonCodes.push('became_failed');
    }

    if (
      baseline.answerStatus === 'grounded' &&
      current.answerStatus === 'insufficient_context'
    ) {
      reasonCodes.push('became_insufficient_context');
    }

    if (
      this.isQualityDegraded(baseline.qualityOverall, current.qualityOverall)
    ) {
      reasonCodes.push('quality_degraded');
    }

    if (baseline.usedFallback === false && current.usedFallback === true) {
      reasonCodes.push('fallback_introduced');
    }

    if (current.citationCount < baseline.citationCount) {
      reasonCodes.push('citations_decreased');
    }

    if (reasonCodes.length === 0) {
      return null;
    }

    const severity = reasonCodes.includes('became_failed')
      ? 'critical'
      : reasonCodes.includes('became_insufficient_context') ||
          reasonCodes.includes('quality_degraded')
        ? 'high'
        : 'medium';

    return {
      index: current.index,
      question: current.question,
      severity,
      reasonCodes,
      baseline,
      current: {
        status: current.status,
        answerStatus: current.answerStatus,
        qualityOverall: current.qualityOverall,
        qualityPrimaryIssue: current.qualityPrimaryIssue,
        citationCount: current.citationCount,
        usedFallback: current.usedFallback,
        error: current.error
      }
    };
  }

  private isQualityDegraded(
    baseline: string | null,
    current: string | null
  ): boolean {
    const qualityRank = {
      strong: 3,
      partial: 2,
      weak: 1
    } as const;

    const baselineRank = baseline
      ? qualityRank[baseline as keyof typeof qualityRank]
      : undefined;
    const currentRank = current
      ? qualityRank[current as keyof typeof qualityRank]
      : undefined;

    if (baselineRank == null || currentRank == null) {
      return false;
    }

    return currentRank < baselineRank;
  }

  private readNumber(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private readRunItemStatus(value: unknown): EvalRunItem['status'] | null {
    if (value === 'succeeded' || value === 'failed') {
      return value;
    }
    return null;
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

  private buildQuestionSetDrift(
    currentQuestions: string[],
    baselineQuestions: string[]
  ): EvalQuestionSetDriftSummary {
    const currentQuestionSet = new Set(currentQuestions);
    const baselineQuestionSet = new Set(baselineQuestions);
    const addedQuestionCount = currentQuestions.filter(
      (question) => !baselineQuestionSet.has(question)
    ).length;
    const removedQuestionCount = baselineQuestions.filter(
      (question) => !currentQuestionSet.has(question)
    ).length;
    const unchangedQuestionCount = baselineQuestions.filter((question) =>
      currentQuestionSet.has(question)
    ).length;

    return {
      hasDrift: addedQuestionCount > 0 || removedQuestionCount > 0,
      currentQuestionCount: currentQuestions.length,
      baselineQuestionCount: baselineQuestions.length,
      addedQuestionCount,
      removedQuestionCount,
      unchangedQuestionCount
    };
  }

  private buildRunReportExports(
    runResult: EvalQuestionSetRunResultPayload
  ): EvalRunReportExports {
    const reportPayload = {
      schemaVersion: 'p5_v1_report_export_v1',
      exportedAt: runResult.finishedAt.toISOString(),
      questionSetId: runResult.questionSetId,
      baselineSnapshotId: runResult.baselineSnapshotId,
      baselineVersion: runResult.baselineVersion,
      assistantId: runResult.assistantId,
      startedAt: runResult.startedAt,
      finishedAt: runResult.finishedAt,
      totals: runResult.totals,
      summary: runResult.summary,
      qualityGate: runResult.qualityGate,
      baselineComparison: runResult.baselineComparison,
      items: runResult.items
    };

    const fileNameBase = this.buildReportFileNameBase(
      runResult.questionSetId,
      runResult.finishedAt
    );

    return {
      markdown: {
        format: 'markdown',
        fileName: `${fileNameBase}.md`,
        mimeType: 'text/markdown; charset=utf-8',
        content: this.renderMarkdownReport(reportPayload)
      },
      json: {
        format: 'json',
        fileName: `${fileNameBase}.json`,
        mimeType: 'application/json; charset=utf-8',
        content: JSON.stringify(reportPayload, null, 2)
      },
      html: {
        format: 'html',
        fileName: `${fileNameBase}.html`,
        mimeType: 'text/html; charset=utf-8',
        content: this.renderHtmlReport(reportPayload)
      }
    };
  }

  private buildReportFileNameBase(
    questionSetId: string,
    finishedAt: Date
  ): string {
    const safeQuestionSetId = questionSetId.replace(/[^a-zA-Z0-9-_]/g, '-');
    const timestamp = finishedAt.toISOString().replace(/[:.]/g, '-');
    return `p5-v1-report-${safeQuestionSetId}-${timestamp}`;
  }

  private renderMarkdownReport(report: {
    schemaVersion: string;
    exportedAt: string;
    questionSetId: string;
    baselineSnapshotId: string;
    baselineVersion: number;
    assistantId: string;
    startedAt: Date;
    finishedAt: Date;
    totals: {
      total: number;
      succeeded: number;
      failed: number;
    };
    summary: EvalRunSummary;
    qualityGate: EvalRunQualityGate;
    baselineComparison: EvalQuestionSetRunResultPayload['baselineComparison'];
    items: EvalRunItem[];
  }): string {
    const lines = [
      '# P5 v1 eval report',
      '',
      '## Metadata',
      `- schemaVersion: ${report.schemaVersion}`,
      `- exportedAt: ${report.exportedAt}`,
      `- questionSetId: ${report.questionSetId}`,
      `- baselineSnapshotId: ${report.baselineSnapshotId}`,
      `- baselineVersion: ${report.baselineVersion}`,
      `- assistantId: ${report.assistantId}`,
      `- startedAt: ${report.startedAt.toISOString()}`,
      `- finishedAt: ${report.finishedAt.toISOString()}`,
      '',
      '## Totals',
      `- total: ${report.totals.total}`,
      `- succeeded: ${report.totals.succeeded}`,
      `- failed: ${report.totals.failed}`,
      '',
      '## Summary',
      `- successRate: ${report.summary.successRate}`,
      `- groundedRate: ${report.summary.groundedRate}`,
      `- strongRate: ${report.summary.strongRate}`,
      `- fallbackRate: ${report.summary.fallbackRate}`,
      `- averageCitationCount: ${report.summary.averageCitationCount}`,
      '',
      '## Quality gate',
      `- mode: ${report.qualityGate.mode}`,
      `- status: ${report.qualityGate.status}`,
      `- limitVersion: ${report.qualityGate.limitVersion}`,
      `- breachedMetricCount: ${report.qualityGate.breachedMetricCount}`,
      `- message: ${report.qualityGate.message}`,
      `- breachedMetrics: ${
        report.qualityGate.breachedMetrics
          .map(
            (metric) =>
              `${metric.metric}(${metric.current} vs ${metric.limit} ${metric.limitType})`
          )
          .join(', ') || 'none'
      }`,
      '',
      '## Baseline comparison',
      `- hasPinnedBaselineEvalResult: ${report.baselineComparison.hasPinnedBaselineEvalResult}`,
      `- baselineCapturedAt: ${report.baselineComparison.baselineCapturedAt?.toISOString() ?? 'none'}`,
      `- baselineInitialized: ${report.baselineComparison.baselineInitialized}`,
      `- comparisonMeaningful: ${report.baselineComparison.comparisonMeaningful}`,
      `- questionSetDrift.hasDrift: ${report.baselineComparison.questionSetDrift.hasDrift}`,
      `- questionSetDrift.currentQuestionCount: ${report.baselineComparison.questionSetDrift.currentQuestionCount}`,
      `- questionSetDrift.baselineQuestionCount: ${report.baselineComparison.questionSetDrift.baselineQuestionCount}`,
      `- questionSetDrift.addedQuestionCount: ${report.baselineComparison.questionSetDrift.addedQuestionCount}`,
      `- questionSetDrift.removedQuestionCount: ${report.baselineComparison.questionSetDrift.removedQuestionCount}`,
      `- questionSetDrift.unchangedQuestionCount: ${report.baselineComparison.questionSetDrift.unchangedQuestionCount}`,
      '',
      '## Diff summary',
      ...(report.baselineComparison.diffSummary
        ? [
            `- headline: ${report.baselineComparison.diffSummary.headline}`,
            `- regressedMetricCount: ${report.baselineComparison.diffSummary.regressedMetricCount}`,
            `- improvedMetricCount: ${report.baselineComparison.diffSummary.improvedMetricCount}`,
            `- unchangedMetricCount: ${report.baselineComparison.diffSummary.unchangedMetricCount}`,
            `- regressedQuestionCount: ${report.baselineComparison.diffSummary.regressedQuestionCount}`,
            `- regressedMetrics: ${
              report.baselineComparison.diffSummary.regressedMetrics
                .map((metric) => `${metric.metric}(${metric.delta})`)
                .join(', ') || 'none'
            }`,
            `- improvedMetrics: ${
              report.baselineComparison.diffSummary.improvedMetrics
                .map((metric) => `${metric.metric}(${metric.delta})`)
                .join(', ') || 'none'
            }`,
            `- topRegressionReasons: ${
              report.baselineComparison.diffSummary.topRegressionReasons
                .map((reason) => `${reason.reasonCode}(${reason.count})`)
                .join(', ') || 'none'
            }`
          ]
        : ['- headline: not_available']),
      '',
      '## Failure drilldown',
      ...(report.baselineComparison.failureDrilldown
        ? [
            `- regressedQuestionCount: ${report.baselineComparison.failureDrilldown.regressedQuestionCount}`,
            '',
            '| # | severity | reasonCodes | question | baselineStatus -> currentStatus | baselineQuality -> currentQuality | baselineCitations -> currentCitations |',
            '| --- | --- | --- | --- | --- | --- | --- |',
            ...report.baselineComparison.failureDrilldown.weakestItems.map(
              (item) =>
                [
                  item.index,
                  item.severity,
                  item.reasonCodes.join(','),
                  item.question,
                  `${item.baseline.status} -> ${item.current.status}`,
                  `${item.baseline.qualityOverall ?? '-'} -> ${item.current.qualityOverall ?? '-'}`,
                  `${item.baseline.citationCount} -> ${item.current.citationCount}`
                ]
                  .map((value) => this.escapeMarkdownTableCell(String(value)))
                  .join(' | ')
                  .replace(/^/, '| ')
                  .concat(' |')
            )
          ]
        : ['- regressedQuestionCount: not_available']),
      '',
      '## Items',
      '',
      '| # | status | question | answerStatus | qualityOverall | primaryIssue | citations | usedFallback | traceId | errorCode | errorMessage |',
      '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
      ...report.items.map((item) =>
        [
          item.index,
          item.status,
          item.question,
          item.answerStatus ?? '-',
          item.qualityOverall ?? '-',
          item.qualityPrimaryIssue ?? '-',
          item.citationCount,
          item.usedFallback == null ? '-' : item.usedFallback ? 'yes' : 'no',
          item.traceId ?? '-',
          item.error?.code ?? '-',
          item.error?.message ?? '-'
        ]
          .map((value) => this.escapeMarkdownTableCell(String(value)))
          .join(' | ')
          .replace(/^/, '| ')
          .concat(' |')
      )
    ];

    return lines.join('\n');
  }

  private renderHtmlReport(report: {
    schemaVersion: string;
    exportedAt: string;
    questionSetId: string;
    baselineSnapshotId: string;
    baselineVersion: number;
    assistantId: string;
    startedAt: Date;
    finishedAt: Date;
    totals: {
      total: number;
      succeeded: number;
      failed: number;
    };
    summary: EvalRunSummary;
    qualityGate: EvalRunQualityGate;
    baselineComparison: EvalQuestionSetRunResultPayload['baselineComparison'];
    items: EvalRunItem[];
  }): string {
    const itemRows = report.items
      .map((item) => {
        const columns = [
          item.index,
          item.status,
          item.question,
          item.answerStatus ?? '-',
          item.qualityOverall ?? '-',
          item.qualityPrimaryIssue ?? '-',
          item.citationCount,
          item.usedFallback == null ? '-' : item.usedFallback ? 'yes' : 'no',
          item.traceId ?? '-',
          item.error?.code ?? '-',
          item.error?.message ?? '-'
        ]
          .map((value) => `<td>${this.escapeHtml(String(value))}</td>`)
          .join('');

        return `<tr>${columns}</tr>`;
      })
      .join('\n');

    const failureDrilldownRows = report.baselineComparison.failureDrilldown
      ? report.baselineComparison.failureDrilldown.weakestItems
          .map((item) => {
            const columns = [
              item.index,
              item.severity,
              item.reasonCodes.join(','),
              item.question,
              `${item.baseline.status} -> ${item.current.status}`,
              `${item.baseline.qualityOverall ?? '-'} -> ${item.current.qualityOverall ?? '-'}`,
              `${item.baseline.citationCount} -> ${item.current.citationCount}`
            ]
              .map((value) => `<td>${this.escapeHtml(String(value))}</td>`)
              .join('');

            return `<tr>${columns}</tr>`;
          })
          .join('\n')
      : '';

    const diffSummary = report.baselineComparison.diffSummary;
    const diffSummaryReasonList = diffSummary
      ? diffSummary.topRegressionReasons
          .map(
            (reason) =>
              `<li><code>${this.escapeHtml(reason.reasonCode)}</code>: <code>${reason.count}</code></li>`
          )
          .join('')
      : '';

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>P5 v1 eval report</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; margin: 24px; color: #111827; }
      h1, h2 { margin-bottom: 8px; }
      ul { margin-top: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { border: 1px solid #d1d5db; text-align: left; padding: 8px; vertical-align: top; font-size: 13px; }
      th { background: #f3f4f6; }
      code { background: #f3f4f6; padding: 1px 4px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <h1>P5 v1 eval report</h1>

    <h2>Metadata</h2>
    <ul>
      <li>schemaVersion: <code>${this.escapeHtml(report.schemaVersion)}</code></li>
      <li>exportedAt: <code>${this.escapeHtml(report.exportedAt)}</code></li>
      <li>questionSetId: <code>${this.escapeHtml(report.questionSetId)}</code></li>
      <li>baselineSnapshotId: <code>${this.escapeHtml(report.baselineSnapshotId)}</code></li>
      <li>baselineVersion: <code>${report.baselineVersion}</code></li>
      <li>assistantId: <code>${this.escapeHtml(report.assistantId)}</code></li>
      <li>startedAt: <code>${this.escapeHtml(report.startedAt.toISOString())}</code></li>
      <li>finishedAt: <code>${this.escapeHtml(report.finishedAt.toISOString())}</code></li>
    </ul>

    <h2>Totals</h2>
    <ul>
      <li>total: <code>${report.totals.total}</code></li>
      <li>succeeded: <code>${report.totals.succeeded}</code></li>
      <li>failed: <code>${report.totals.failed}</code></li>
    </ul>

    <h2>Summary</h2>
    <ul>
      <li>successRate: <code>${report.summary.successRate}</code></li>
      <li>groundedRate: <code>${report.summary.groundedRate}</code></li>
      <li>strongRate: <code>${report.summary.strongRate}</code></li>
      <li>fallbackRate: <code>${report.summary.fallbackRate}</code></li>
      <li>averageCitationCount: <code>${report.summary.averageCitationCount}</code></li>
    </ul>

    <h2>Quality gate</h2>
    <ul>
      <li>mode: <code>${this.escapeHtml(report.qualityGate.mode)}</code></li>
      <li>status: <code>${this.escapeHtml(report.qualityGate.status)}</code></li>
      <li>limitVersion: <code>${this.escapeHtml(report.qualityGate.limitVersion)}</code></li>
      <li>breachedMetricCount: <code>${report.qualityGate.breachedMetricCount}</code></li>
      <li>message: <code>${this.escapeHtml(report.qualityGate.message)}</code></li>
      <li>breachedMetrics: <code>${this.escapeHtml(
        report.qualityGate.breachedMetrics
          .map(
            (metric) =>
              `${metric.metric}(${metric.current} vs ${metric.limit} ${metric.limitType})`
          )
          .join(', ') || 'none'
      )}</code></li>
    </ul>

    <h2>Baseline comparison</h2>
    <ul>
      <li>hasPinnedBaselineEvalResult: <code>${report.baselineComparison.hasPinnedBaselineEvalResult}</code></li>
      <li>baselineCapturedAt: <code>${this.escapeHtml(report.baselineComparison.baselineCapturedAt?.toISOString() ?? 'none')}</code></li>
      <li>baselineInitialized: <code>${report.baselineComparison.baselineInitialized}</code></li>
      <li>comparisonMeaningful: <code>${report.baselineComparison.comparisonMeaningful}</code></li>
      <li>questionSetDrift.hasDrift: <code>${report.baselineComparison.questionSetDrift.hasDrift}</code></li>
      <li>questionSetDrift.currentQuestionCount: <code>${report.baselineComparison.questionSetDrift.currentQuestionCount}</code></li>
      <li>questionSetDrift.baselineQuestionCount: <code>${report.baselineComparison.questionSetDrift.baselineQuestionCount}</code></li>
      <li>questionSetDrift.addedQuestionCount: <code>${report.baselineComparison.questionSetDrift.addedQuestionCount}</code></li>
      <li>questionSetDrift.removedQuestionCount: <code>${report.baselineComparison.questionSetDrift.removedQuestionCount}</code></li>
      <li>questionSetDrift.unchangedQuestionCount: <code>${report.baselineComparison.questionSetDrift.unchangedQuestionCount}</code></li>
    </ul>

    <h2>Diff summary</h2>
    <ul>
      <li>headline: <code>${this.escapeHtml(diffSummary?.headline ?? 'not_available')}</code></li>
      <li>regressedMetricCount: <code>${diffSummary?.regressedMetricCount ?? '-'}</code></li>
      <li>improvedMetricCount: <code>${diffSummary?.improvedMetricCount ?? '-'}</code></li>
      <li>unchangedMetricCount: <code>${diffSummary?.unchangedMetricCount ?? '-'}</code></li>
      <li>regressedQuestionCount: <code>${diffSummary?.regressedQuestionCount ?? '-'}</code></li>
      <li>regressedMetrics: <code>${this.escapeHtml(
        diffSummary?.regressedMetrics
          .map((metric) => `${metric.metric}(${metric.delta})`)
          .join(', ') || 'none'
      )}</code></li>
      <li>improvedMetrics: <code>${this.escapeHtml(
        diffSummary?.improvedMetrics
          .map((metric) => `${metric.metric}(${metric.delta})`)
          .join(', ') || 'none'
      )}</code></li>
    </ul>
    ${
      diffSummary
        ? `<div>
      <div>topRegressionReasons</div>
      <ul>${diffSummaryReasonList || '<li><code>none</code></li>'}</ul>
    </div>`
        : ''
    }

    <h2>Failure drilldown</h2>
    <ul>
      <li>regressedQuestionCount: <code>${this.escapeHtml(
        report.baselineComparison.failureDrilldown
          ? String(
              report.baselineComparison.failureDrilldown.regressedQuestionCount
            )
          : 'not_available'
      )}</code></li>
    </ul>
    ${
      report.baselineComparison.failureDrilldown
        ? `<table>
      <thead>
        <tr>
          <th>#</th>
          <th>severity</th>
          <th>reasonCodes</th>
          <th>question</th>
          <th>baselineStatus -> currentStatus</th>
          <th>baselineQuality -> currentQuality</th>
          <th>baselineCitations -> currentCitations</th>
        </tr>
      </thead>
      <tbody>
        ${failureDrilldownRows}
      </tbody>
    </table>`
        : ''
    }

    <h2>Items</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>status</th>
          <th>question</th>
          <th>answerStatus</th>
          <th>qualityOverall</th>
          <th>primaryIssue</th>
          <th>citations</th>
          <th>usedFallback</th>
          <th>traceId</th>
          <th>errorCode</th>
          <th>errorMessage</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
  </body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  private escapeMarkdownTableCell(value: string): string {
    return value.replaceAll('|', '\\|').replaceAll('\n', ' ');
  }
}
