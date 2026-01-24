
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Application } from '@prisma/client';

@Injectable()
export class SearchMetaService {
  constructor(private readonly prisma: PrismaService) {}

  async generateSearchMeta(app: Application): Promise<string> {
    const parts: string[] = [];

    // 1. Basic Info
    if (app.applicationNumber) parts.push(String(app.applicationNumber));
    if (app.status) parts.push(this.getStatusLabel(app.status));

    // 2. Applicant Name from Snapshot
    // app.applicantInfo contains { username, firstName, lastName, email, department }
    if (app.applicantInfo) {
        const info = app.applicantInfo as any;
        if (info.lastName || info.firstName) {
            parts.push([info.lastName, info.firstName].filter(Boolean).join(' '));
        }
        if (info.username) parts.push(info.username);
        // Also add department if available in snapshot
        if (info.department) parts.push(info.department);
    }

    // 3. Form Data Resolution
    if (app.inputData && app.applicationDefinitionId) {
      const appDef = await this.prisma.applicationDefinition.findUnique({
        where: { id: app.applicationDefinitionId },
        include: { formDefinition: true },
      });

      if (appDef && appDef.formDefinition) {
        const schema = appDef.formDefinition.schema as any;
        const inputData = app.inputData as any;
        
        this.resolveFormLabels(inputData, schema, parts);
      }
    }

    return parts.join(' ');
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      DRAFT: '下書き',
      IN_PROGRESS: '進行中',
      APPROVED: '承認済み',
      REJECTED: '却下',
      SENT_BACK: '差し戻し',
      COMPLETED: '完了', // Map COMPLETED if used
      CANCELED: 'キャンセル', // Map CANCELED if used
      REMANDED: '差し戻し', // Prisma enum matches
    };
    return labels[status] || status;
  }

  private resolveFormLabels(inputData: any, schema: any, parts: string[]) {
    if (!schema || !schema.properties) return;

    for (const [key, value] of Object.entries(inputData)) {
      if (value === null || value === undefined || value === '') continue;

      const fieldConfig = schema.properties[key];
      if (!fieldConfig) continue;

      // Select / Radio / Checkbox (Custom Options)
      if (fieldConfig.options && Array.isArray(fieldConfig.options)) {
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) {
          const option = fieldConfig.options.find(
            (o: any) => String(o.value) === String(v),
          );
          if (option && option.label) {
            parts.push(option.label);
          }
        }
      }

      // Standard JSON Schema (OneOf)
      if (fieldConfig.oneOf && Array.isArray(fieldConfig.oneOf)) {
        const option = fieldConfig.oneOf.find((o: any) => o.const === value);
        if (option && option.title) {
          parts.push(option.title);
        }
      }

      // Standard JSON Schema (Enum)
      if (fieldConfig.enum && fieldConfig.enumNames) {
        const index = fieldConfig.enum.indexOf(value);
        if (index !== -1 && fieldConfig.enumNames[index]) {
          parts.push(fieldConfig.enumNames[index]);
        }
      }

      // User Select & Dept Select
      // Since we don't have User/Dept tables, we can't look them up yet.
      // If the inputData stores the label alongside the ID (unlikely for now), we would use it.
      // For now, we only index the ID which is already in inputData.
      // TODO: If User/Dept names are critical, we need a service to fetch them from Keycloak/External
      // OR store them in inputData as { id, name } objects instead of just IDs.
      
      // Note: For now, we skip User/Dept name resolution as tables don't exist in Prisma.
    }
  }
}
