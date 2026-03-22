import {
  DocumentRunFailedStage,
  DocumentRunStatus,
  DocumentRunTrigger,
  Prisma
} from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";

@Injectable()
export class DocumentRunsService {
  constructor(private readonly prisma: PrismaService) {}

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
}
