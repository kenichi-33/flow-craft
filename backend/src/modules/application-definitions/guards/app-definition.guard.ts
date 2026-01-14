import { Injectable, CanActivate, ExecutionContext, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AppDefinitionGuard implements CanActivate {
    constructor(
        private prisma: PrismaService,
        private reflector: Reflector,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const params = request.params;
        const appDefId = params.id;

        if (!user) {
            return false;
        }

        // Global Admin always has access
        if (user.roles?.includes('wf_admin')) {
            return true;
        }

        if (!appDefId) {
            // If no ID is present (e.g. create), allow (Controller should handle specific checks if needed)
            // But usually this guard is used on /:id routes
            return true; 
        }

        const appDef = await this.prisma.applicationDefinition.findUnique({
            where: { id: appDefId },
        }) as any;

        if (!appDef) {
            throw new NotFoundException(`ApplicationDefinition not found`);
        }

        // Check if user is in adminIds or is the creator
        if (appDef.adminIds?.includes(user.userId) || appDef.adminIds?.includes(user.username) || appDef.createdBy === user.username) {
            return true;
        }

        throw new ForbiddenException('You do not have permission to modify this application definition');
    }
}
