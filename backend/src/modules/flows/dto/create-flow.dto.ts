import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class CreateFlowDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsArray()
    nodes: any[];

    @IsArray()
    edges: any[];
}
