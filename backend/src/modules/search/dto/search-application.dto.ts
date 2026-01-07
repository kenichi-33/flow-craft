import { IsString, IsNotEmpty, IsNumber, IsOptional, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export enum SearchOperator {
  EQUALS = 'equals',
  CONTAINS = 'contains',
  GT = 'gt',
  LT = 'lt',
  GTE = 'gte',
  LTE = 'lte',
  // RANGE = 'range', // Future support
}

export class SearchCriterion {
  @IsEnum(SearchOperator)
  operator: SearchOperator;

  @IsNotEmpty()
  value: any;
}

export class SearchApplicationDto {
  @IsString()
  @IsNotEmpty()
  applicationDefinitionId: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => Object) // Record<string, SearchCriterion>
  criteria?: Record<string, SearchCriterion>;

  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @IsNumber()
  @IsOptional()
  limit?: number = 20;
}
