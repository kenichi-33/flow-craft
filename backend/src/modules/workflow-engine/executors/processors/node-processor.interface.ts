import { Prisma } from '@prisma/client';

export interface NodeProcessorContext {
  applicationId: string;
  nodeId: string;
  node: any;
  inputData: Record<string, any>;
  applicantId: string;
  edges: any[];
  nodes: any[];
  fromNodeId?: string;
  postCommitActions?: (() => Promise<void>)[];
}

export interface INodeProcessor {
  /**
   * Node type this processor handles (e.g., 'start', 'approval')
   */
  getType(): string;

  /**
   * Execute the node logic
   * @param context Context data
   * @param tx Prisma transaction client
   */
  process(
    context: NodeProcessorContext,
    tx: Prisma.TransactionClient,
  ): Promise<void>;
}
