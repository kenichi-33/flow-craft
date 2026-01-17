import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { Roles } from '../../auth/decorators';

@Controller('teams')
export class TeamsController {
    constructor(private readonly teamsService: TeamsService) { }

    @Get()
    findAll() {
        return this.teamsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.teamsService.findOne(id);
    }

    @Post()
    @Roles('wf_admin')
    create(@Body() body: { name: string; description?: string }) {
        return this.teamsService.create(body);
    }

    @Put(':id')
    @Roles('wf_admin')
    update(@Param('id') id: string, @Body() body: { name?: string; description?: string }) {
        return this.teamsService.update(id, body);
    }

    @Delete(':id')
    @Roles('wf_admin')
    delete(@Param('id') id: string) {
        return this.teamsService.delete(id);
    }

    @Post(':id/members')
    @Roles('wf_admin')
    addMember(
        @Param('id') teamId: string,
        @Body() body: { memberType: 'user' | 'department'; memberId: string },
    ) {
        return this.teamsService.addMember(teamId, body.memberType, body.memberId);
    }

    @Delete(':id/members/:memberId')
    @Roles('wf_admin')
    removeMember(@Param('id') teamId: string, @Param('memberId') memberId: string) {
        return this.teamsService.removeMember(teamId, memberId);
    }

    @Put(':id/members')
    @Roles('wf_admin')
    updateMembers(
        @Param('id') teamId: string,
        @Body() body: { members: { memberType: 'user' | 'department'; memberId: string }[] },
    ) {
        return this.teamsService.updateMembers(teamId, body.members);
    }
}
