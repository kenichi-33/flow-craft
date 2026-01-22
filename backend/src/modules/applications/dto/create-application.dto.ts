import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUUID,
} from 'class-validator';

export class CreateApplicationDto {
  @IsUUID()
  @IsOptional()
  applicationDefinitionId?: string;

  @IsUUID()
  @IsNotEmpty()
  formDefinitionId: string;

  @IsUUID()
  @IsNotEmpty()
  flowDefinitionId: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  applicantId: string;

  @IsObject()
  @IsOptional()
  inputData?: object;
}
