import { Controller, Post, Body, BadRequestException, UseGuards, Req } from '@nestjs/common';
import { AiGeneratorService } from './services/ai-generator.service';
import type { GenerationRequest } from './services/ai-generator.service';
import { AiFormFillerService } from './services/ai-form-filler.service';
import type { FillFormRequest } from './services/ai-form-filler.service';
import { AiValidatorService } from './services/ai-validator.service';

@Controller('ai')
export class AiCoreController {
  constructor(
    private readonly generatorService: AiGeneratorService,
    private readonly formFillerService: AiFormFillerService,
    private readonly aiValidatorService: AiValidatorService,
  ) {}

  @Post('generate')
  async generate(@Body() body: GenerationRequest) {
    if (!body.prompt || !body.type) {
      throw new BadRequestException('Prompt and type are required');
    }
    return this.generatorService.generate(body);
  }

  @Post('fill-form')
  async fillForm(@Body() body: { prompt: string; formSchema: any; currentUser?: any }) {
    if (!body.prompt || !body.formSchema) {
      throw new BadRequestException('Prompt and formSchema are required');
    }
    // Note: In production, currentUser should be extracted from JWT/session.
    const currentUser = body.currentUser || { id: 'test-user', name: 'Test User' };
    
    return this.formFillerService.fillForm({
      prompt: body.prompt,
      formSchema: body.formSchema,
      currentUser,
    });
  }
  @Post('review-definition')
  async reviewDefinition(@Body() body: { type: 'form' | 'flow'; definition: any; requirements?: string }) {
    if (!body.type || !body.definition) {
      throw new BadRequestException('Type and definition are required');
    }
    return this.aiValidatorService.reviewDefinition(body.type, body.definition, body.requirements);
  }
}

