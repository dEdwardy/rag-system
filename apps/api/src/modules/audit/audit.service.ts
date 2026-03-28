import { Injectable } from "@nestjs/common";
import { DocumentRunStatus, Prisma, TraceStatus } from "@prisma/client";
import { PrismaService } from "../../infra/database/prisma.service";
import { ListAuditEventsInput } from "./audit.schemas";

type AuditScope = {
  tenantId: string;
  userId: string;
};

type AuditEvent = {
  id: string;
  kind: "trace" | "document_run";
  entityId: string;
  event: string;
  status: string;
  occurredAt: Date;
  summary: string | null;
  details: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async listAuditEvents(input: ListAuditEventsInput, scope?: AuditScope | null) {
    const normalizedQuery = input.query?.trim() ?? null;
    const startedAtFilter = this.resolveStartedAtFilter(input.sinceHours);

    const tracesPromise = input.source === "document_run"
      ? Promise.resolve([])
      : this.prisma.answerTrace.findMany({
          where: {
            ...(scope
              ? {
                  conversation: {
                    tenantId: scope.tenantId,
                    userId: scope.userId
                  }
                }
              : {}),
            ...(startedAtFilter
              ? {
                  createdAt: startedAtFilter
                }
              : {}),
            ...(input.issueOnly
              ? {
                  status: TraceStatus.failed
                }
              : {}),
            ...(normalizedQuery
              ? {
                  OR: [
                    {
                      id: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      userQuery: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      rewrittenQuery: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    }
                  ]
                }
              : {})
          },
          take: input.limit,
          orderBy: {
            createdAt: "desc"
          },
          select: {
            id: true,
            conversationId: true,
            userQuery: true,
            status: true,
            errorMessage: true,
            createdAt: true
          }
        });

    const documentRunsPromise = input.source === "trace"
      ? Promise.resolve([])
      : this.prisma.documentRun.findMany({
          where: {
            ...(scope
              ? {
                  document: {
                    knowledgeBase: {
                      tenantId: scope.tenantId
                    }
                  }
                }
              : {}),
            ...(startedAtFilter
              ? {
                  startedAt: startedAtFilter
                }
              : {}),
            ...(input.issueOnly
              ? {
                  status: {
                    in: [DocumentRunStatus.failed, DocumentRunStatus.skipped]
                  }
                }
              : {}),
            ...(normalizedQuery
              ? {
                  OR: [
                    {
                      id: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      documentId: {
                        contains: normalizedQuery,
                        mode: "insensitive"
                      }
                    },
                    {
                      document: {
                        title: {
                          contains: normalizedQuery,
                          mode: "insensitive"
                        }
                      }
                    },
                    {
                      document: {
                        sourceName: {
                          contains: normalizedQuery,
                          mode: "insensitive"
                        }
                      }
                    }
                  ]
                }
              : {})
          },
          take: input.limit,
          orderBy: {
            startedAt: "desc"
          },
          select: {
            id: true,
            documentId: true,
            status: true,
            trigger: true,
            failedStage: true,
            startedAt: true,
            document: {
              select: {
                id: true,
                kbId: true,
                title: true,
                sourceType: true,
                sourceName: true
              }
            }
          }
        });

    const [traces, documentRuns] = await Promise.all([tracesPromise, documentRunsPromise]);
    const traceEvents = traces.map((trace): AuditEvent => {
      const event = trace.status === TraceStatus.failed ? "trace.failed" : "trace.completed";
      return {
        id: `trace:${trace.id}`,
        kind: "trace",
        entityId: trace.id,
        event,
        status: trace.status,
        occurredAt: trace.createdAt,
        summary: trace.userQuery,
        details: {
          conversationId: trace.conversationId,
          errorMessage: trace.errorMessage
        }
      };
    });
    const documentRunEvents = documentRuns.map((run): AuditEvent => {
      const event = this.resolveDocumentRunEvent(run.status);
      return {
        id: `document_run:${run.id}`,
        kind: "document_run",
        entityId: run.id,
        event,
        status: run.status,
        occurredAt: run.startedAt,
        summary: run.document.title,
        details: {
          documentId: run.documentId,
          kbId: run.document.kbId,
          sourceType: run.document.sourceType,
          sourceName: run.document.sourceName,
          trigger: run.trigger,
          failedStage: run.failedStage
        }
      };
    });

    return [...traceEvents, ...documentRunEvents]
      .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
      .slice(0, input.limit);
  }

  private resolveStartedAtFilter(sinceHours?: number) {
    if (sinceHours === undefined) {
      return undefined;
    }

    return {
      gte: new Date(Date.now() - sinceHours * 60 * 60 * 1000)
    } satisfies Prisma.DateTimeFilter;
  }

  private resolveDocumentRunEvent(status: DocumentRunStatus) {
    if (status === DocumentRunStatus.failed) {
      return "document_run.failed";
    }

    if (status === DocumentRunStatus.ready) {
      return "document_run.ready";
    }

    if (status === DocumentRunStatus.skipped) {
      return "document_run.skipped";
    }

    if (status === DocumentRunStatus.processing) {
      return "document_run.processing";
    }

    return "document_run.pending";
  }
}
