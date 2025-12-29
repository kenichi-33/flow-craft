import { Module } from '@nestjs/common';
import { ApplicationDefinitionsController } from './application-definitions.controller';
import { ApplicationDefinitionsService } from './application-definitions.service';

@Module({
    controllers: [ApplicationDefinitionsController],
    providers: [ApplicationDefinitionsService],
    exports: [ApplicationDefinitionsService],
})
export class ApplicationDefinitionsModule { }
