import { IsString, IsOptional } from 'class-validator';

export class CreateApplicationDefinitionDto {
    @IsString()
    name: string;

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
    @IsString({ each: true })
    tags?: string[];
}
