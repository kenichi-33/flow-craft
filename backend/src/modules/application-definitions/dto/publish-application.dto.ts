import { IsString, IsOptional } from 'class-validator';

export class PublishApplicationDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
