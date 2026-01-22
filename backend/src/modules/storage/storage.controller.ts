import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class StorageController {
  constructor(private storageService: StorageService) {}

  /**
   * 署名付きアップロードURL取得
   */
  @Post('presign')
  async getPresignedUploadUrl(
    @Body() dto: { filename: string; mimeType: string; size: number },
    @Request() req: any,
  ) {
    return this.storageService.createPresignedUploadUrl(
      dto.filename,
      dto.mimeType,
      dto.size,
      req.user.sub || req.user.id,
    );
  }

  /**
   * アップロード完了確認
   */
  @Post(':id/confirm')
  async confirmUpload(@Param('id') id: string, @Request() req: any) {
    return this.storageService.confirmUpload(id, req.user.sub || req.user.id);
  }

  /**
   * ダウンロードURL取得
   */
  @Get(':id/download')
  async getDownloadUrl(@Param('id') id: string) {
    return this.storageService.createPresignedDownloadUrl(id);
  }

  /**
   * ファイルメタデータ取得
   */
  @Get(':id')
  async getFile(@Param('id') id: string) {
    return this.storageService.getFileById(id);
  }

  /**
   * ファイル削除
   */
  @Delete(':id')
  async deleteFile(@Param('id') id: string, @Request() req: any) {
    return this.storageService.deleteFile(id, req.user.sub || req.user.id);
  }
}
