import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Res as orgRes,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApplicationDefinitionsService } from './application-definitions.service';
import { CreateApplicationDefinitionDto } from './dto/create-application-definition.dto';
import { UpdateApplicationDefinitionDto } from './dto/update-application-definition.dto';
import { PublishApplicationDto } from './dto/publish-application.dto';
import { RestoreApplicationDto } from './dto/restore-application.dto';
import { AppDefinitionGuard } from './guards/app-definition.guard';

@Controller('application-definitions')
export class ApplicationDefinitionsController {
  constructor(private readonly appDefsService: ApplicationDefinitionsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createDto: CreateApplicationDefinitionDto, @Req() req: any) {
    const user = req.user;
    if (
      !user.roles.includes('wf_admin') &&
      !user.roles.includes('wf_app_admin')
    ) {
      throw new ForbiddenException(
        'You do not have permission to create applications',
      );
    }
    return this.appDefsService.create(createDto, user);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    @Query('tags') tags?: string | string[],
    @Req() req?: any,
  ) {
    const tagsArray = tags
      ? Array.isArray(tags)
        ? tags
        : tags.split(',')
      : undefined;

    // req.user might be undefined if guard is not applied, but we added UseGuards
    return this.appDefsService.findAll(
      {
        page: page ? parseInt(page, 10) : undefined,
        limit: limit ? parseInt(limit, 10) : undefined,
        search,
        sortBy,
        sortOrder,
        tags: tagsArray,
      },
      req?.user,
    );
  }

  @Get('active')
  findActive() {
    return this.appDefsService.findActive();
  }

  @Get(':id/published')
  findPublished(@Param('id') id: string, @Query('version') version?: string) {
    const versionNum = version ? parseInt(version, 10) : undefined;
    return this.appDefsService.findPublished(id, versionNum);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appDefsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AppDefinitionGuard)
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateApplicationDefinitionDto,
    @Req() req: any,
  ) {
    const username = req.user?.username || 'Unknown';
    return this.appDefsService.update(id, updateDto, username);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, AppDefinitionGuard)
  publish(
    @Param('id') id: string,
    @Body() publishDto: PublishApplicationDto,
    @Req() req: any,
  ) {
    console.log('Publish request:', { id, body: publishDto, user: req.user });
    const username = req.user?.username || 'Unknown';
    return this.appDefsService.publish(
      id,
      username,
      undefined,
      publishDto.comment,
    );
  }

  @Get(':id/versions')
  getVersions(@Param('id') id: string) {
    return this.appDefsService.getVersions(id);
  }

  @Post(':id/restore/:version')
  @UseGuards(JwtAuthGuard, AppDefinitionGuard)
  restore(
    @Param('id') id: string,
    @Param('version') version: string,
    @Body() restoreDto: RestoreApplicationDto,
    @Req() req: any,
  ) {
    console.log('Restore request:', {
      id,
      version,
      body: restoreDto,
      user: req.user,
    });
    const username = req.user?.username || 'Unknown';
    return this.appDefsService.restore(
      id,
      parseInt(version, 10),
      username,
      restoreDto.comment,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AppDefinitionGuard)
  remove(@Param('id') id: string) {
    return this.appDefsService.remove(id);
  }
  @Get(':id/versions/:version/export')
  @UseGuards(JwtAuthGuard)
  async export(
    @Param('id') id: string,
    @Param('version') version: string,
    @Req() req: any,
    @orgRes() res: Response,
  ) {
    const data = await this.appDefsService.export(id, parseInt(version, 10));
    const filename = `${data.appName}_v${data.version}_${new Date().toISOString().split('T')[0]}.json`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(data, null, 2));
  }

  @Post(':id/import-version')
  @UseGuards(JwtAuthGuard, AppDefinitionGuard)
  async importVersion(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: any,
  ) {
    const username = req.user?.username || 'Unknown';
    return this.appDefsService.importVersion(id, body, username);
  }
}
