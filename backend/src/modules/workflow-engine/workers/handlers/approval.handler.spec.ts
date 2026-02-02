
import { Test, TestingModule } from '@nestjs/testing';
import { ApprovalHandler } from './approval.handler';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UsersService } from '../../../users/users.service';
import { MailService } from '../../../notifications/mail.service';
import { TaskContext } from '../task-handler.interface';

describe('ApprovalHandler', () => {
    let handler: ApprovalHandler;
    let prisma: PrismaService;
    let usersService: UsersService;
    let mailService: MailService;

    const mockPrisma = {
        workflowTask: {
            findUnique: jest.fn(),
        },
        application: {
            findUnique: jest.fn(),
        },
    };

    const mockUsersService = {
        getUserSnapshotByUsername: jest.fn(),
    };

    const mockMailService = {
        sendEmail: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ApprovalHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UsersService, useValue: mockUsersService },
                { provide: MailService, useValue: mockMailService },
            ],
        }).compile();

        handler = module.get<ApprovalHandler>(ApprovalHandler);
        prisma = module.get<PrismaService>(PrismaService);
        usersService = module.get<UsersService>(UsersService);
        mailService = module.get<MailService>(MailService);

        jest.clearAllMocks();
    });

    const baseContext: TaskContext = {
        taskId: 'task-1',
        nodeId: 'node-1',
        applicationId: 'app-1',
        applicantId: 'user-1',
        nodeData: {
            notificationEnabled: true,
            notificationSubject: 'Approval Request',
            notificationBody: 'Please approve',
        },
        inputData: { title: 'Test App' },
    };

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should send notification email if enabled', async () => {
        mockPrisma.workflowTask.findUnique.mockResolvedValue({
            id: 'task-1',
            assignedTo: 'user:approver',
        });
        mockPrisma.application.findUnique.mockResolvedValue({
            id: 'app-1',
            applicationDefinition: { name: 'Def' },
        });
        mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
            email: 'approver@example.com',
            lastName: 'Approver',
            firstName: 'One',
        });

        const result = await handler.execute(baseContext);

        expect(mailService.sendEmail).toHaveBeenCalledWith(
            'approver@example.com',
            'Approval Request',
            'Please approve',
        );
        expect(result.success).toBe(true);
        expect(result.shouldAdvance).toBe(false); // Valid for approval task
    });

    it('should NOT send email if notification disabled', async () => {
        const context = {
            ...baseContext,
            nodeData: { ...baseContext.nodeData, notificationEnabled: false },
        };
        await handler.execute(context);
        expect(mailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should handle missing assignee gracefully', async () => {
        mockPrisma.workflowTask.findUnique.mockResolvedValue({
            id: 'task-1',
            assignedTo: null,
        });
        await handler.execute(baseContext);
        expect(mailService.sendEmail).not.toHaveBeenCalled();
    });
});
