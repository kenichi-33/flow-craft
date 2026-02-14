import {
  Injectable,
  OnModuleInit,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as Minio from 'minio';
import { v4 as uuid } from 'uuid';

@Injectable()
export class StorageService implements OnModuleInit {
  private internalClient: Minio.Client;
  private publicClient: Minio.Client;
  private bucket: string;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    // Internal endpoint (for Docker: http://minio:9000)
    const internalEndpoint =
      this.configService.get('S3_ENDPOINT') || 'http://minio:9000';
    const internalUrl = new URL(internalEndpoint);

    this.internalClient = new Minio.Client({
      endPoint: internalUrl.hostname,
      port: parseInt(internalUrl.port) || 9000,
      useSSL: internalUrl.protocol === 'https:',
      accessKey: this.configService.get('S3_ACCESS_KEY') || 'minio',
      secretKey: this.configService.get('S3_SECRET_KEY') || 'minio123',
    });

    // Public endpoint (for browser: http://localhost:9000)
    // Used primarily for generating presigned URLs that match the browser's Host header
    const publicEndpoint =
      this.configService.get('S3_PUBLIC_URL') || 'http://localhost:9000';
    const publicUrl = new URL(publicEndpoint);

    this.publicClient = new Minio.Client({
      endPoint: publicUrl.hostname,
      port: parseInt(publicUrl.port) || 9000,
      useSSL: publicUrl.protocol === 'https:',
      accessKey: this.configService.get('S3_ACCESS_KEY') || 'minio',
      secretKey: this.configService.get('S3_SECRET_KEY') || 'minio123',
      // Specify region to prevent automatic region lookup connection
      // which fails because localhost is unreachable from inside the container
      region: 'us-east-1',
    });

    this.bucket = this.configService.get('S3_BUCKET') || 'flowcraft-files';
  }

  async onModuleInit() {
    try {
      // Use internal client for backend operations
      const bucketExists = await this.internalClient.bucketExists(this.bucket);
      if (!bucketExists) {
        await this.internalClient.makeBucket(this.bucket);
        console.log(`Created bucket: ${this.bucket}`);
      }
    } catch (error) {
      console.error('Failed to initialize MinIO bucket:', error);
    }
  }

  /**
   * 署名付きアップロードURLを生成
   */
  async createPresignedUploadUrl(
    filename: string,
    mimeType: string,
    size: number,
    userId: string,
  ): Promise<{ fileId: string; uploadUrl: string; key: string }> {
    // サイズ検証
    if (size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `ファイルサイズが上限(${this.MAX_FILE_SIZE / 1024 / 1024}MB)を超えています`,
      );
    }

    // ファイルキー生成
    const key = `uploads/${uuid()}/${filename}`;

    // DBにpendingレコード作成
    const file = await this.prisma.file.create({
      data: {
        filename,
        originalName: filename,
        mimeType,
        size,
        bucket: this.bucket,
        key,
        status: 'pending',
        uploadedBy: userId,
      },
    });

    // 署名付きアップロードURL生成 (有効期限: 1時間)
    // Use publicClient so the signature matches the public endpoint (localhost)
    const uploadUrl = await this.publicClient.presignedPutObject(
      this.bucket,
      key,
      60 * 60, // 1 hour
    );

    return {
      fileId: file.id,
      uploadUrl,
      key,
    };
  }

  /**
   * アップロード完了を確認
   */
  async confirmUpload(fileId: string, userId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException('ファイルが見つかりません');
    }

    if (file.uploadedBy !== userId) {
      throw new BadRequestException('このファイルを確認する権限がありません');
    }

    // MinIOでファイルの存在を確認 (Use internalClient)
    try {
      await this.internalClient.statObject(this.bucket, file.key);
    } catch {
      throw new BadRequestException('ファイルがアップロードされていません');
    }

    // ステータスを更新
    return this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'uploaded' },
    });
  }

  /**
   * 署名付きダウンロードURLを生成
   */
  async createPresignedDownloadUrl(
    fileId: string,
  ): Promise<{ url: string; filename: string }> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file || file.status !== 'uploaded') {
      throw new NotFoundException('ファイルが見つかりません');
    }

    // Use publicClient for browser-accessible URL
    const url = await this.publicClient.presignedGetObject(
      this.bucket,
      file.key,
      60 * 60, // 1 hour
      {
        'response-content-disposition': `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      },
    );

    return {
      url,
      filename: file.originalName,
    };
  }

  /**
   * ファイルメタデータ取得
   */
  async getFileById(fileId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file || file.status !== 'uploaded') {
      throw new NotFoundException('ファイルが見つかりません');
    }

    return file;
  }

  /**
   * ファイル削除
   */
  async deleteFile(fileId: string, userId: string) {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException('ファイルが見つかりません');
    }

    // 削除権限チェック（アップロード者のみ）
    if (file.uploadedBy !== userId) {
      throw new BadRequestException('このファイルを削除する権限がありません');
    }

    // MinIOから削除 (Use internalClient)
    try {
      await this.internalClient.removeObject(this.bucket, file.key);
    } catch (error) {
      console.error('Failed to delete file from MinIO:', error);
    }

    // DBのステータスを更新
    return this.prisma.file.update({
      where: { id: fileId },
      data: { status: 'deleted' },
    });
  }
  async deleteFileSystem(file: any) {
    // MinIOから削除
    try {
      await this.internalClient.removeObject(this.bucket, file.key);
    } catch (error) {
      console.error('Failed to delete file from MinIO:', error);
      // Don't throw, just log. We want to clean up DB structure anyway.
    }

    // DBから物理削除（または論理削除）
    return this.prisma.file.update({
      where: { id: file.id },
      data: { status: 'deleted' },
    });
  }

  /**
   * ファイル内容を取得 (Internal)
   */
  async getFileContent(fileId: string): Promise<Buffer> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId } });

    if (!file || file.status !== 'uploaded') {
      throw new NotFoundException('ファイルが見つかりません');
    }

    try {
      const stream = await this.internalClient.getObject(this.bucket, file.key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      console.error('Failed to get file content from MinIO:', error);
      throw new BadRequestException('ファイル読み込みに失敗しました');
    }
  }
}
