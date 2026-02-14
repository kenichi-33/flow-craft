import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RagService } from './services/rag.service';
import { StorageService } from '../storage/storage.service';

@Controller('application-definitions/:id/rag/sources')
export class RagController {
  constructor(
    private readonly ragService: RagService,
    private readonly storageService: StorageService,
  ) {}

  @Post()
  async createSource(
    @Param('id') applicationDefinitionId: string,
    @Body()
    body: {
      name: string;
      type: 'file' | 'text';
      content?: string;
      fileId?: string;
    },
  ) {
    if (body.type === 'file' && !body.fileId) {
      throw new BadRequestException('File ID is required for file source');
    }
    if (body.type === 'text' && !body.content) {
      throw new BadRequestException('Content is required for text source');
    }

    return this.ragService.createSource({
      name: body.name,
      type: body.type,
      content: body.content,
      fileId: body.fileId,
      applicationDefinitionId,
    });
  }

  @Get()
  async getSources(@Param('id') applicationDefinitionId: string) {
    return this.ragService.getSources(applicationDefinitionId);
  }

  @Delete(':sourceId')
  async deleteSource(@Param('sourceId') sourceId: string) {
    return this.ragService.deleteSource(sourceId);
  }
}
