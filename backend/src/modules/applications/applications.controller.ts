import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

@Controller('applications')
export class ApplicationsController {
    constructor(private readonly applicationsService: ApplicationsService) { }

    @Post()
    create(@Body() createApplicationDto: CreateApplicationDto) {
        return this.applicationsService.create(createApplicationDto);
    }

    @Get()
    findAll(
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('search') search?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: 'asc' | 'desc',
        @Query('status') status?: string,
    ) {
        return this.applicationsService.findAll({
            page: page ? parseInt(page, 10) : undefined,
            limit: limit ? parseInt(limit, 10) : undefined,
            search,
            sortBy,
            sortOrder,
            status,
        });
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.applicationsService.findOne(id);
    }
}
