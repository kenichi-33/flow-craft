import { Injectable, Type } from '@nestjs/common';
import { INodeProcessor } from './node-processor.interface';
import { ModuleRef } from '@nestjs/core';

@Injectable()
export class NodeProcessorRegistry {
  private processors = new Map<string, INodeProcessor>();

  constructor(private moduleRef: ModuleRef) {}

  register(processor: INodeProcessor) {
    this.processors.set(processor.getType(), processor);
  }

  registerAlias(type: string, processor: INodeProcessor) {
    this.processors.set(type, processor);
  }

  getProcessor(type: string): INodeProcessor | undefined {
    return this.processors.get(type);
  }
}
