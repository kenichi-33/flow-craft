import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import {
  ISearchService,
  SearchResult,
} from './interfaces/search-service.interface';
import { SearchQueryDto, SearchOperator } from './dto/search-application.dto';
import { Application } from '@prisma/client';

import { SearchService } from './search.service';
import { QueueService } from '../queue/queue.service';
import { PrismaService } from '../../prisma/prisma.service';

import { SearchMetaService } from './search-meta.service';

@Injectable()
export class ElasticsearchSearchService extends SearchService {
  private client: Client;
  private readonly indexName = 'applications';

  constructor(
    private readonly configService: ConfigService,
    queueService: QueueService,
    prisma: PrismaService,
    private readonly searchMetaService: SearchMetaService,
  ) {
    super(queueService, prisma);
  }

  async onModuleInit() {
    await super.onModuleInit();
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
    this.ensureIndex();
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
          settings: {
            analysis: {
              analyzer: {
                ngram_analyzer: {
                  type: 'custom',
                  tokenizer: 'ngram_tokenizer',
                  filter: ['lowercase'],
                },
              },
              tokenizer: {
                ngram_tokenizer: {
                  type: 'ngram',
                  min_gram: 1,
                  max_gram: 2,
                  token_chars: ['letter', 'digit', 'symbol'],
                },
              },
            },
          },
          mappings: {
            dynamic: true,
            dynamic_templates: [
              {
                strings_as_ngram: {
                  match_mapping_type: 'string',
                  mapping: {
                    type: 'text',
                    analyzer: 'ngram_analyzer',
                    search_analyzer: 'ngram_analyzer',
                  },
                },
              },
            ],
            properties: {
              id: { type: 'keyword' },
              applicationDefinitionId: { type: 'keyword' },
              title: {
                type: 'text',
                analyzer: 'ngram_analyzer',
                search_analyzer: 'ngram_analyzer',
              },
              status: { type: 'keyword' },
              applicantId: { type: 'keyword' },
              createdAt: { type: 'date' },
              full_text: {
                type: 'text',
                analyzer: 'ngram_analyzer',
                search_analyzer: 'ngram_analyzer',
              },
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
          fields: ['title^3', 'full_text', 'inputData.*', 'searchMeta.*'],
          type: 'best_fields',
          lenient: true,
          operator: 'and',
        },
      });
    }

    if (filters && filters.length > 0) {
      filters.forEach((filter) => {
        const { field, operator, value } = filter;

        switch (operator) {
          case SearchOperator.EQUALS:
            // Use match_phrase for exact matching on analyzed text fields
            // term query only works on keyword fields, not ngram-analyzed text
            must.push({
              match_phrase: {
                [field]: value,
              },
            });
            break;
          case SearchOperator.CONTAINS:
            must.push({
              match: {
                [field]: {
                  query: value,
                  operator: 'and',
                },
              },
            });
            break;
          case SearchOperator.GT:
            must.push({ range: { [field]: { gt: value } } });
            break;
          case SearchOperator.LT:
            must.push({ range: { [field]: { lt: value } } });
            break;
          case SearchOperator.GTE:
            must.push({ range: { [field]: { gte: value } } });
            break;
          case SearchOperator.LTE:
            must.push({ range: { [field]: { lte: value } } });
            break;
          case SearchOperator.IN:
            must.push({
              terms: { [field]: Array.isArray(value) ? value : [value] },
            });
            break;
        }
      });
    }

    try {
      const body = {
        index: this.indexName,
        from,
        size: limit,
        query: {
          bool: {
            must,
          },
        },
      };

      const result = await this.client.search(body as any);

      const hits = result.hits.hits;
      const total = (result.hits.total as any).value || 0;

      if (hits.length === 0) {
        return { items: [], total: 0, page, limit };
      }

      const ids = hits.map((hit) => hit._id).filter((id): id is string => !!id);
      const applications = await this.prisma.application.findMany({
        where: { id: { in: ids } },
      });

      // Restore order matching Elastic results
      const items = ids
        .map((id) => applications.find((app) => app.id === id))
        .filter((item): item is Application => !!item);

      return {
        items,
        total,
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
      const searchMetaString =
        await this.searchMetaService.generateSearchMeta(app);

      // Sanitize inputData to remove empty strings which cause date parsing errors in ES
      const cleanInputData = this.cleanInputData(app.inputData);

      await this.client.index({
        index: this.indexName,
        id: app.id,
        document: {
          id: app.id,
          applicationDefinitionId: app.applicationDefinitionId,
          title: app.title,
          status: app.status,
          applicantId: app.applicantId,
          createdAt: app.createdAt,
          inputData: cleanInputData,
          full_text: searchMetaString,
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

  private cleanInputData(data: any): any {
    if (data === null || data === undefined) return null;
    if (typeof data === 'string') {
      return data === '' ? null : data;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.cleanInputData(item));
    }
    if (typeof data === 'object') {
      const cleaned: any = {};
      for (const key of Object.keys(data)) {
        cleaned[key] = this.cleanInputData(data[key]);
      }
      return cleaned;
    }
    return data;
  }
}
