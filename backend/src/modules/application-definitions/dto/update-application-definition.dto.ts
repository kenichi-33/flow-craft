import { IsString, IsOptional, IsEnum } from 'class-validator';
import { AppDefStatus } from '@prisma/client';

export class UpdateApplicationDefinitionDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    formDefinitionId?: string;

    @IsOptional()
    @IsString()
    flowDefinitionId?: string;

    @IsOptional()
    @IsEnum(AppDefStatus)
    status?: AppDefStatus;

    @IsOptional()
    tags?: string[];

    @IsOptional()
    @IsString({ each: true })
    adminIds?: string[];
}
