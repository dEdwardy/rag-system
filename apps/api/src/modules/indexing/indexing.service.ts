import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infra/database/prisma.service";
import { EmbeddingService } from "../../infra/embedding/embedding.service";
import { VectorStoreService } from "../../infra/vector-store/vector-store.service";

@Injectable()
export class IndexingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorStoreService: VectorStoreService
  ) {}

  async indexDocument(documentId: string) {
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
      await this.vectorStoreService.deleteDocumentVectors(document.kbId, document.id);
      return;
    }

    const embeddings = await this.embeddingService.embedTexts(
      document.chunks.map(chunk => this.buildChunkEmbeddingInput(chunk.sectionTitle, chunk.content))
    );

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
          modelName: embedding.modelName,
          dimensions: embedding.dimensions,
          vector: embedding.vector,
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
}
