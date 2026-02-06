import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AiGeneratorService } from './services/ai-generator.service';
import type { GenerationRequest } from './services/ai-generator.service';

@Controller('ai')
export class AiCoreController {
  constructor(private readonly generatorService: AiGeneratorService) {}

  @Post('generate')
  async generate(@Body() body: GenerationRequest) {
    if (!body.prompt || !body.type) {
      throw new BadRequestException('Prompt and type are required');
    }
    return this.generatorService.generate(body);
  }
}
