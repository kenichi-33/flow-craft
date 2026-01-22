import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { FlowsService } from './flows.service';
import { CreateFlowDto } from './dto/create-flow.dto';

@Controller('flows')
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Post()
  create(@Body() createFlowDto: CreateFlowDto) {
    return this.flowsService.create(createFlowDto);
  }

  @Get()
  findAll() {
    return this.flowsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.flowsService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() updateData: { name?: string; nodes?: any; edges?: any },
  ) {
    return this.flowsService.update(id, updateData);
  }
}
