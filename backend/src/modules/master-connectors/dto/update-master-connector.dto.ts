import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateMasterConnectorDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsOptional()
  config?: any;

  @IsOptional()
  mapping?: any;

  @IsBoolean()
  @IsOptional()
  isShared?: boolean;

  @IsOptional()
  allowedAppIds?: string[];
}
