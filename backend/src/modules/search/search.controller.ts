import { Controller, Post, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { SearchService } from './search.service';
import { SearchApplicationDto } from './dto/search-application.dto';
import { PrismaService } from '../../prisma/prisma.service';
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('applications')
  @HttpCode(HttpStatus.OK)
  async searchApplications(@Body() dto: SearchApplicationDto) {
    return this.searchService.search(dto);
  }

  // Maintenance endpoint to manually trigger index for an app
  // Useful for ensuring ES sync or testing
  @Post('index/:id')
  async manualIndex(@Param('id') id: string) {
    const app = await this.prisma.application.findUnique({ where: { id } });
    if (app) {
      await this.searchService.indexApplication(app);
      return { message: 'Indexing triggered' };
    }
    return { message: 'Application not found' };
  }
}
