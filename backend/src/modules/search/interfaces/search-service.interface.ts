import { Application } from '@prisma/client';
import { SearchQueryDto } from '../dto/search-application.dto';

export interface SearchResult<T = any> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ISearchService {
  /**
   * Search applications based on dynamic criteria.
   */
  search(dto: SearchQueryDto): Promise<SearchResult<Application>>;

  /**
   * Index or update an application in the search engine.
   * For PostgreSQL implementation, this might be a no-op or specific optimization.
   * For Elasticsearch, this pushes the document.
   */
  indexApplication(app: Application): Promise<void>;
  
  /**
   * Remove an application from the index.
   */
  removeApplication(appId: string): Promise<void>;
}
