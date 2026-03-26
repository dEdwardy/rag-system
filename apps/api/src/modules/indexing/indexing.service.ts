import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { EmbeddingService } from "../../infra/embedding/embedding.service";
import { VECTOR_STORE, VectorStore } from "../../infra/vector-store/vector-store.types";

@Injectable()
export class IndexingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    @Inject(VECTOR_STORE) private readonly vectorStoreService: VectorStore
  ) {}

  async indexDocument(documentId: string, expectedVersion?: number) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId
      },
      include: {
        chunks: {
          orderBy: {
            chunkIndex: "asc"
          }
        }
      }
    });

    if (!document) {
      return;
    }

    if (document.chunks.length === 0) {
      if (!(await this.matchesExpectedVersion(document.id, expectedVersion))) {
        return;
      }

      await this.vectorStoreService.deleteDocumentVectors(document.kbId, document.id);
      return;
    }

    const embeddings = await this.embeddingService.embedTexts(
      document.chunks.map(chunk => this.buildChunkEmbeddingInput(chunk.sectionTitle, chunk.content))
    );

    if (!(await this.matchesExpectedVersion(document.id, expectedVersion))) {
      return;
    }

    await this.vectorStoreService.replaceDocumentVectors({
      kbId: document.kbId,
      documentId: document.id,
      records: document.chunks.map((chunk, index) => {
        const embedding = embeddings[index];

        return {
          id: chunk.id,
          kbId: document.kbId,
          documentId: document.id,
          chunkId: chunk.id,
          chunkIndex: chunk.chunkIndex,
          sectionTitle: chunk.sectionTitle,
          pageNo: chunk.pageNo,
          content: chunk.content,
          embedding,
          metadata: {
            kbId: document.kbId,
            documentId: document.id,
            chunkIndex: chunk.chunkIndex
          }
        };
      })
    });

    await this.prisma.$transaction(
      document.chunks.map(chunk =>
        this.prisma.documentChunk.update({
          where: {
            id: chunk.id
          },
          data: {
            embeddingRef: chunk.id
          }
        })
      )
    );
  }

  async deleteDocumentIndex(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: {
        id: documentId
      }
    });

    if (!document) {
      return;
    }

    await this.vectorStoreService.deleteDocumentVectors(document.kbId, document.id);
  }

  private buildChunkEmbeddingInput(sectionTitle: string | null, content: string) {
    if (!sectionTitle) {
      return content;
    }

    return `${sectionTitle}\n\n${content}`;
  }

  private async matchesExpectedVersion(documentId: string, expectedVersion?: number) {
    if (expectedVersion === undefined) {
      return true;
    }

    const currentDocument = await this.prisma.document.findUnique({
      where: {
        id: documentId
      },
      select: {
        version: true
      }
    });

    if (!currentDocument) {
      return false;
    }

    return currentDocument.version === expectedVersion;
  }
}
