import { Controller, Get, Post, Put, Body, Param } from '@nestjs/common';
import { FormsService } from './forms.service';
import { CreateFormDto } from './dto/create-form.dto';

@Controller('forms')
export class FormsController {
    constructor(private readonly formsService: FormsService) { }

    @Post()
    create(@Body() createFormDto: CreateFormDto) {
        return this.formsService.create(createFormDto);
    }

    @Get()
    findAll() {
        return this.formsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.formsService.findOne(id);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateData: { name?: string; schema?: any }) {
        return this.formsService.update(id, updateData);
    }
}
