import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchQueryDto } from './dto/search-application.dto';
import { Application } from '@prisma/client';

@Injectable()
export class ElasticsearchSearchService
  implements ISearchService, OnModuleInit
{
  private readonly logger = new Logger('[Indexer] ElasticsearchSearch');
  private client: Client;
  private readonly indexName = 'applications';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const searchMode = this.configService.get('SEARCH_MODE');
    if (searchMode !== 'elasticsearch') {
      return;
    }

    const node = this.configService.get<string>('ELASTICSEARCH_NODE');
    if (!node) {
      this.logger.warn(
        'ELASTICSEARCH_NODE not set. Elasticsearch service will not function.',
      );
      return;
    }

    this.client = new Client({
      node,
      auth: {
        username: 'elastic',
        password: 'changeme',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.logger.log(`Elasticsearch client initialized at ${node}`);
    this.checkConnection();
  }

  private async checkConnection() {
    try {
      const ping = await this.client.ping();
      this.logger.log(`Elasticsearch ping result: ${ping}`);
      await this.ensureIndex();
    } catch (error) {
      this.logger.error('Could not connect to Elasticsearch', error);
    }
  }

  private async ensureIndex() {
    try {
      const exists = await this.client.indices.exists({
        index: this.indexName,
      });
      if (!exists) {
        this.logger.log(`Index ${this.indexName} does not exist. Creating...`);
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            dynamic: true,
            properties: {
              id: { type: 'keyword' },
              applicationDefinitionId: { type: 'keyword' },
              status: { type: 'keyword' },
              applicantId: { type: 'keyword' },
              createdAt: { type: 'date' },
              full_text: { type: 'text' }, // Added for hybrid search
              inputData: {
                type: 'object',
                dynamic: true,
              },
            },
          },
        });
        this.logger.log(`Index ${this.indexName} created.`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure index ${this.indexName}`, error);
    }
  }

  async search(dto: SearchQueryDto): Promise<SearchResult<Application>> {
    const {
      keyword,
      filters,
      page = 1,
      limit = 20,
      applicationDefinitionId,
      criteria,
    } = dto;

    const from = (page - 1) * limit;

    const must: any[] = [];

    if (applicationDefinitionId) {
      must.push({ term: { applicationDefinitionId } });
    }

    // Keyword (Full Text) - Minimal implementation
    if (keyword) {
      must.push({
        multi_match: {
          query: keyword,
          fields: ['full_text', 'inputData.*', 'searchMeta.*'],
          type: 'best_fields',
          fuzziness: 'AUTO',
        },
      });
    }

    // TODO: Implement filters logic for Elastic if needed.
    // Current focus is Postgres mode.

    try {
      const result = await this.client.search({
        index: this.indexName,
        from,
        size: limit,
        query: {
          bool: {
            must,
          },
        } as any, // Cast to any to avoid strict type checks for now if types mismatch
      });

      // Map result to Application type (partial) or ID list
      // Real implementation would hydrate from DB or return stored fields.
      // Returning empty for now as this is hybrid mock.
      return {
        items: [],
        total: 0,
        page,
        limit,
      };
    } catch (e) {
      this.logger.error('Search failed', e);
      return { items: [], total: 0, page, limit };
    }
  }

  async indexApplication(app: Application): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.index({
        index: this.indexName,
        id: app.id,
        document: {
          id: app.id,
          applicationDefinitionId: app.applicationDefinitionId,
          status: app.status,
          applicantId: app.applicantId,
          createdAt: app.createdAt,
          inputData: app.inputData,
          // Cast to any to access dynamic properties if needed
          full_text: (app as any).fullText,
          searchMeta: (app as any).searchMeta,
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to index app ${app.id}`, e);
    }
  }

  async removeApplication(appId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.delete({
        index: this.indexName,
        id: appId,
      });
    } catch (e) {
      this.logger.warn(`Failed to remove app ${appId}`, e);
    }
  }
}
