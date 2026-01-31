import { IsString, IsOptional, IsBoolean, IsJSON, IsEnum } from 'class-validator';

export class CreateMasterConnectorDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  type: string; // 'rest' | 'sql' | 'csv'

  @IsOptional()
  config: any;

  @IsOptional()
  mapping: any;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsOptional()
  allowedAppIds?: string[];
}
