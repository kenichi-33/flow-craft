import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  ValidateNested,
  IsEnum,
  IsObject,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchOperator {
  EQUALS = 'equals',
  CONTAINS = 'contains',
  GT = 'gt',
  LT = 'lt',
  GTE = 'gte',
  LTE = 'lte',
  IN = 'in',
}

export class SearchFilter {
  @IsString()
  @IsNotEmpty()
  field: string;

  @IsEnum(SearchOperator)
  operator: SearchOperator;

  @IsNotEmpty()
  value: any;
}

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SearchFilter)
  filters?: SearchFilter[];

  @IsOptional()
  @IsObject()
  sort?: { field: string; order: 'asc' | 'desc' };

  @IsOptional()
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  limit?: number = 20;

  // System Filters
  @IsOptional()
  @IsString()
  applicationDefinitionId?: string;

  @IsOptional()
  @IsString()
  applicantId?: string;

  @IsOptional()
  @IsArray()
  status?: string[];

  // Deprecated backward compatibility
  @IsOptional()
  criteria?: any;
}

// Alias for compatibility if needed during strict refactor
export class SearchApplicationDto extends SearchQueryDto {}
