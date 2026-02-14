import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { LlmGatewayService } from '../llm-gateway/llm-gateway.service';
import { StorageService } from '../../storage/storage.service';

const pdfParse = require('pdf-parse');

export interface CreateRagSourceDto {
  name: string;
  type: 'file' | 'text';
  content?: string;
  fileId?: string;
  applicationDefinitionId: string;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly CHUNK_SIZE = 1000;
  private readonly CHUNK_OVERLAP = 200;

  constructor(
    private prisma: PrismaService,
    private llmGateway: LlmGatewayService,
    private storageService: StorageService,
  ) {}

  async createSource(data: CreateRagSourceDto) {
    const source = await this.prisma.ragSource.create({
      data: {
        name: data.name,
        type: data.type,
        content: data.content,
        fileId: data.fileId,
        applicationDefinitionId: data.applicationDefinitionId,
      },
    });

    try {
      await this.processSource(source.id);
    } catch (error) {
      this.logger.error(
        `Failed to process source ${source.id}: ${error.message}`,
        error.stack,
      );
      // Optionally delete semantic source or mark as failed
    }

    return source;
  }

  async getSources(applicationDefinitionId: string) {
    return this.prisma.ragSource.findMany({
      where: { applicationDefinitionId },
      include: { file: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteSource(sourceId: string) {
    return this.prisma.ragSource.delete({
      where: { id: sourceId },
    });
  }

  async retrieve(
    applicationDefinitionId: string,
    query: string,
    limit: number = 5,
  ): Promise<string[]> {
    const embedding = await this.llmGateway.embed(query);
    const vector = `[${embedding.join(',')}]`;

    // raw query for vector search
    const results = await this.prisma.$queryRaw<any[]>`
      SELECT 
        d.content, 
        d.metadata,
        1 - (d.embedding <=> ${vector}::vector) as similarity
      FROM rag_documents d
      JOIN rag_sources s ON d.rag_source_id = s.id
      WHERE s.application_definition_id = ${applicationDefinitionId}
      ORDER BY d.embedding <=> ${vector}::vector
      LIMIT ${limit}
    `;

    return results.map((r) => r.content);
  }

  private async processSource(sourceId: string) {
    const source = await this.prisma.ragSource.findUnique({
      where: { id: sourceId },
    });
    if (!source) throw new NotFoundException('Source not found');

    let text = '';
    if (source.type === 'text') {
      text = source.content || '';
    } else if (source.type === 'file' && source.fileId) {
      const buffer = await this.storageService.getFileContent(source.fileId);
      // Determine file type. For now support text and PDF.
      // We can check mimeType from File record if needed, but let's try pdf-parse or utf-8 decode.
      // Actually we have the File object via relation if we included it, but we can just fetch it again or rely on buffer.
      // Let's fetch file record to check mimeType.
      const file = await this.prisma.file.findUnique({
        where: { id: source.fileId },
      });

      if (file?.mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        text = data.text;
      } else {
        // Assume text
        text = buffer.toString('utf-8');
      }
    }

    if (!text) return;

    const chunks = this.chunkText(text);

    for (const chunk of chunks) {
      const embedding = await this.llmGateway.embed(chunk);
      // Prisma doesn't support vector type directly in create/update yet without raw query or specific casting?
      // Actually, with typed sql it might, but usually we need raw query or mapped type.
      // However, Prisma 5+ supports vector type in schema, but writing it might need $executeRaw if unsupported type.
      // Start with $executeRaw for inserting vector.

      const vector = `[${embedding.join(',')}]`;
      await this.prisma.$executeRaw`
        INSERT INTO rag_documents (id, rag_source_id, content, embedding, "metadata")
        VALUES (gen_random_uuid(), ${source.id}, ${chunk}, ${vector}::vector, '{}'::jsonb)
      `;
    }
  }

  private chunkText(text: string): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + this.CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      start += this.CHUNK_SIZE - this.CHUNK_OVERLAP;
    }
    return chunks;
  }
}
