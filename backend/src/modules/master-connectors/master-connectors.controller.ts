import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
    return this.masterConnectorsService.create(createMasterConnectorDto, user);
  }

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.masterConnectorsService.findAll(user);
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

  @Get(':id/data')
  getData(@Param('id') id: string) {
      return this.masterConnectorsService.getDataItems(id);
  }

  @Post('test')
  test(@Body() body: { config: any, mapping: any, query: string, type?: string }) {
      return this.masterConnectorsService.test(body.config, body.mapping, body.query, body.type);
  }

  @Post(':id/csv')
  @UseInterceptors(FileInterceptor('file'))
  uploadCsv(@Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
      if (!file) {
          console.log('Upload failed: No file received');
          // const req = context.switchToHttp().getRequest(); // Need context to log req? 
          // Just throw for now
          throw new BadRequestException('File is required and must be named "file"');
      }
      console.log(`Received file: ${file.originalname}, size: ${file.size}, mimetype: ${file.mimetype}`);
      return this.masterConnectorsService.importCsv(id, file.buffer);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMasterConnectorDto: UpdateMasterConnectorDto, @CurrentUser() user: any) {
    return this.masterConnectorsService.update(id, updateMasterConnectorDto, user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.masterConnectorsService.remove(id);
  }
}
