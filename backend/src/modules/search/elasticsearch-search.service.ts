import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';
import { ISearchService, SearchResult } from './interfaces/search-service.interface';
import { SearchApplicationDto, SearchOperator } from './dto/search-application.dto';
import { Application } from '@prisma/client';

@Injectable()
export class ElasticsearchSearchService implements ISearchService, OnModuleInit {
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
      this.logger.warn('ELASTICSEARCH_NODE not set. Elasticsearch service will not function.');
      return;
    }

    this.client = new Client({
      node,
      auth: {
        username: 'elastic', // Default for dev if security enabled, but we disabled it in docker
        password: 'changeme',
      },
      // Disable SSL verification for dev if needed
      tls: {
        rejectUnauthorized: false
      }
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
      const exists = await this.client.indices.exists({ index: this.indexName });
      if (!exists) {
        this.logger.log(`Index ${this.indexName} does not exist. Creating...`);
        await this.client.indices.create({
          index: this.indexName,
          mappings: {
            dynamic: true, // Allow dynamic fields from form input
            properties: {
              id: { type: 'keyword' },
              applicationDefinitionId: { type: 'keyword' },
              status: { type: 'keyword' },
              applicantId: { type: 'keyword' },
              createdAt: { type: 'date' },
              // inputData will be flattened or nested?
              // For simple search, we can put dynamic fields at root or under 'inputData' object
              inputData: { 
                type: 'object',
                dynamic: true 
              }
            }
          }
        });
        this.logger.log(`Index ${this.indexName} created.`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure index ${this.indexName}`, error);
    }
  }

  async search(dto: SearchApplicationDto): Promise<SearchResult<Application>> {
    const { applicationDefinitionId, criteria, page = 1, limit = 20 } = dto;
    const from = (page - 1) * limit;

    const must: any[] = [
      { term: { applicationDefinitionId } }
    ];

    if (criteria) {
      for (const [key, searchCriterion] of Object.entries(criteria)) {
        const fieldPath = `inputData.${key}`; // Assumes inputData is an object in ES doc
        const { operator, value } = searchCriterion;

        switch (operator) {
          case SearchOperator.EQUALS:
            // Use term for exact match on keyword/numbers, match for text
            // For simplicity, using match which works for both mostly (analyzed)
            // But for structured search 'term' is better if keyword.
            // Since mapping is dynamic, string might be text+keyword.
            must.push({
               match: { [fieldPath]: value }
            });
            break;
          case SearchOperator.CONTAINS:
            // Wildcard is heavy, match_phrase or match might be enough?
            // User likely expects partial match.
            must.push({
              wildcard: {
                [`${fieldPath}.keyword`]: `*${value}*` // Requires keyword sub-field if text
              } 
            });
            // Fallback or alternative if .keyword doesn't exist (e.g. number)
            // If number, use term?
            break;
          case SearchOperator.GT:
            must.push({ range: { [fieldPath]: { gt: value } } });
            break;
          case SearchOperator.LT:
            must.push({ range: { [fieldPath]: { lt: value } } });
            break;
          case SearchOperator.GTE:
            must.push({ range: { [fieldPath]: { gte: value } } });
            break;
          case SearchOperator.LTE:
            must.push({ range: { [fieldPath]: { lte: value } } });
            break;
        }
      }
    }

    try {
      const result = await this.client.search({
        index: this.indexName,
        from,
        size: limit,
        query: {
          bool: {
            must
          }
        }
      });

      const total = typeof result.hits.total === 'number' ? result.hits.total : (result.hits.total as any).value;
      const items = result.hits.hits.map(hit => hit._source as Application);

      return {
        items,
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error('Search failed', error);
      throw error;
    }
  }

  async indexApplication(app: Application): Promise<void> {
    if (!this.client) return;
    
    this.logger.log(`Indexing application ${app.id} to Elasticsearch`);
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
          inputData: app.inputData, // This object will be indexed dynamically
          applicationNumber: app.applicationNumber
        }
      });
    } catch (error) {
      this.logger.error(`Failed to index application ${app.id}`, error);
      throw error;
    }
  }

  async removeApplication(appId: string): Promise<void> {
    if (!this.client) return;

    this.logger.log(`Removing application ${appId} from Elasticsearch`);
    try {
      await this.client.delete({
        index: this.indexName,
        id: appId
      });
    } catch (error) {
      this.logger.error(`Failed to remove application ${appId}`, error);
      // Ignore 404
    }
  }
}
