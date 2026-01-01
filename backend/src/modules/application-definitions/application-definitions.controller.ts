import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApplicationDefinitionsService } from './application-definitions.service';
import { CreateApplicationDefinitionDto } from './dto/create-application-definition.dto';
import { UpdateApplicationDefinitionDto } from './dto/update-application-definition.dto';

@Controller('application-definitions')
export class ApplicationDefinitionsController {
    constructor(private readonly appDefsService: ApplicationDefinitionsService) { }

    @Post()
    create(@Body() createDto: CreateApplicationDefinitionDto) {
        return this.appDefsService.create(createDto);
    }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
    ) {
        return this.appDefsService.findAll({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            search,
            sortBy,
            sortOrder,
        });
    }

    @Get('active')
    findActive() {
        return this.appDefsService.findActive();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.appDefsService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: UpdateApplicationDefinitionDto) {
        return this.appDefsService.update(id, updateDto);
    }

    @Post(':id/publish')
    publish(@Param('id') id: string) {
        return this.appDefsService.publish(id);
    }

    @Get(':id/versions')
    getVersions(@Param('id') id: string) {
        return this.appDefsService.getVersions(id);
    }

    @Post(':id/restore/:version')
    restore(@Param('id') id: string, @Param('version') version: string) {
        return this.appDefsService.restore(id, parseInt(version, 10));
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.appDefsService.remove(id);
    }
}
