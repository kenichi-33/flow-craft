import { Test, TestingModule } from '@nestjs/testing';
import { EmailTaskHandler } from './email-task.handler';
import { MailService } from '../../../notifications/mail.service';
import { WorkflowHelperService } from '../../workflow-helper.service';
import { PrismaService } from '../../../../prisma/prisma.service';
import { TaskContext } from '../task-handler.interface';

describe('EmailTaskHandler', () => {
  let handler: EmailTaskHandler;
  let mailService: MailService;
  let helper: WorkflowHelperService;
  let prisma: PrismaService;

  const mockMailService = {
    sendEmail: jest.fn(),
  };

  const mockHelper = {
    resolveAssignedToSnapshot: jest.fn(),
    substituteVariables: jest.fn(),
    resolveEmails: jest.fn(),
  };

  const mockPrisma = {
    application: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailTaskHandler,
        { provide: MailService, useValue: mockMailService },
        { provide: WorkflowHelperService, useValue: mockHelper },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    handler = module.get<EmailTaskHandler>(EmailTaskHandler);
    mailService = module.get<MailService>(MailService);
    helper = module.get<WorkflowHelperService>(WorkflowHelperService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  const baseContext: TaskContext = {
    taskId: 'task-1',
    nodeId: 'node-1',
    applicationId: 'app-1',
    applicantId: 'user-1',
    nodeData: {
      to: 'user:test',
      subject: 'Subject',
      body: 'Body',
    },
    inputData: {
      foo: 'bar',
    },
  };

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  it('should send email successfully', async () => {
    mockPrisma.application.findUnique.mockResolvedValue({
      id: 'app-1',
      title: 'App Title',
      applicationDefinition: { name: 'Def Name' },
    });
    mockHelper.resolveAssignedToSnapshot.mockResolvedValue({
      lastName: 'User',
      firstName: 'One',
    });
    mockHelper.substituteVariables.mockImplementation((text) => text);
    mockHelper.resolveEmails.mockResolvedValue(['test@example.com']);

    const result = await handler.execute(baseContext);

    expect(mailService.sendEmail).toHaveBeenCalledWith(
      'test@example.com',
      'Subject',
      'Body',
    );
    expect(result.success).toBe(true);
    expect(result.outputData).toHaveProperty('email_sent_node-1', true);
  });

  it('should fail if no recipients resolved', async () => {
     mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
     mockHelper.resolveEmails.mockResolvedValue([]); // No emails

     const result = await handler.execute(baseContext);

     expect(result.success).toBe(false);
     expect(result.error).toContain('Resolved 0 recipients');
  });

  it('should use template if provided', async () => {
    const context = {
      ...baseContext,
      nodeData: {
        to: 'user:test',
        templateId: 'approval_request',
        // No explicit subject/body, so template matches
      },
    };

    mockPrisma.application.findUnique.mockResolvedValue({ id: 'app-1' });
    mockHelper.resolveEmails.mockResolvedValue(['test@example.com']);
    
    // Substitute variables mock must handle the template strings effectively or just pass through
    mockHelper.substituteVariables.mockImplementation((text) => text + ' (substituted)');

    await handler.execute(context);

    // Verify substituteVariables called with template content
    // We don't check exact string as it depends on constant, but we verify it triggered substitution on template-like string
    expect(mockHelper.substituteVariables).toHaveBeenCalledWith(
      expect.stringContaining('承認依頼'), // part of template subject
      expect.anything()
    );
  });
});
