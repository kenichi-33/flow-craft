import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateFormDto } from './dto/create-form.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  create(createFormDto: CreateFormDto) {
    return this.prisma.formDefinition.create({
      data: {
        name: createFormDto.name,
        schema: createFormDto.schema as Prisma.InputJsonValue,
      },
    });
  }

  findAll() {
    return this.prisma.formDefinition.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.formDefinition.findUnique({
      where: { id },
    });
  }

  update(id: string, updateData: { name?: string; schema?: any }) {
    return this.prisma.formDefinition.update({
      where: { id },
      data: {
        ...(updateData.name && { name: updateData.name }),
        ...(updateData.schema && {
          schema: updateData.schema as Prisma.InputJsonValue,
        }),
      },
    });
  }
}
