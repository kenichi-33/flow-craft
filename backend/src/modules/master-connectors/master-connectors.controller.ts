import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { MasterConnectorsService } from './master-connectors.service';
import { CreateMasterConnectorDto } from './dto/create-master-connector.dto';
import { UpdateMasterConnectorDto } from './dto/update-master-connector.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';

@Controller('master-connectors')
@UseGuards(JwtAuthGuard)
export class MasterConnectorsController {
  constructor(private readonly masterConnectorsService: MasterConnectorsService) {}

  @Post()
  create(@Body() createMasterConnectorDto: CreateMasterConnectorDto, @CurrentUser() user: any) {
    return this.masterConnectorsService.create(createMasterConnectorDto, user?.userId);
  }

  @Get()
  findAll() {
    return this.masterConnectorsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.masterConnectorsService.findOne(id);
  }

  // Proxy Endpoint for Runtime
  @Get(':id/proxy')
  proxy(@Param('id') id: string, @Query('q') query: string) {
      return this.masterConnectorsService.proxy(id, query);
  }

  @Post('test')
  test(@Body() body: { config: any, mapping: any, query: string }) {
      return this.masterConnectorsService.test(body.config, body.mapping, body.query);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMasterConnectorDto: UpdateMasterConnectorDto) {
    return this.masterConnectorsService.update(id, updateMasterConnectorDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.masterConnectorsService.remove(id);
  }
}
