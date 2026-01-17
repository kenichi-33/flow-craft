import { IsString, IsOptional } from 'class-validator';

export class RestoreApplicationDto {
    @IsOptional()
    @IsString()
    comment?: string;
}
