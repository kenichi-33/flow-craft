import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class CreateFormDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsObject()
  schema: object;
}
