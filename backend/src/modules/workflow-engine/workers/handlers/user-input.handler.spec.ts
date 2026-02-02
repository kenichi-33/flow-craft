
import { Test, TestingModule } from '@nestjs/testing';
import { UserInputHandler } from './user-input.handler';
import { PrismaService } from '../../../../prisma/prisma.service';
import { UsersService } from '../../../users/users.service';
import { MailService } from '../../../notifications/mail.service';
import { TaskContext } from '../task-handler.interface';

describe('UserInputHandler', () => {
    let handler: UserInputHandler;
    let mailService: MailService;
    let prisma: PrismaService;
    let usersService: UsersService;

    const mockPrisma = {
        workflowTask: { findUnique: jest.fn() },
        application: { findUnique: jest.fn() },
    };
    const mockUsersService = {
         getUserSnapshotByUsername: jest.fn(),
         getUserSnapshot: jest.fn(),
    };
    const mockMailService = { sendEmail: jest.fn() };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UserInputHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UsersService, useValue: mockUsersService },
                { provide: MailService, useValue: mockMailService },
            ],
        }).compile();

        handler = module.get<UserInputHandler>(UserInputHandler);
        mailService = module.get<MailService>(MailService);
        prisma = module.get<PrismaService>(PrismaService);
        usersService = module.get<UsersService>(UsersService);

        jest.clearAllMocks();
    });

    const baseContext: TaskContext = {
        taskId: 'task-1',
        nodeId: 'node-1',
        nodeType: 'userInput',
        applicationId: 'app-1',
        applicantId: 'user-1',
        nodeData: {
            notificationEnabled: true,
            notificationSubject: 'Input Request',
            notificationBody: 'Please input',
        },
        inputData: { title: 'Test App' },
    };

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should send notification if enabled', async () => {
        mockPrisma.workflowTask.findUnique.mockResolvedValue({
            id: 'task-1',
            assignedTo: 'user:inputter',
        });
        mockPrisma.application.findUnique.mockResolvedValue({
            id: 'app-1',
            applicationDefinition: { name: 'Def' },
        });
        mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
            email: 'inputter@example.com',
        });

        const result = await handler.execute(baseContext);

        expect(mailService.sendEmail).toHaveBeenCalledWith(
            'inputter@example.com',
            'Input Request',
            'Please input',
        );
        expect(result.success).toBe(true);
        expect(result.shouldAdvance).toBe(false);
    });

    it('should handle "applicant" assignee correctly', async () => {
        mockPrisma.workflowTask.findUnique.mockResolvedValue({
            id: 'task-1',
            assignedTo: 'applicant',
        });
        mockPrisma.application.findUnique.mockResolvedValue({
            id: 'app-1',
            applicantId: 'john_doe',
            applicationDefinition: { name: 'Def' },
        });
        // mock lookup for applicant
        mockUsersService.getUserSnapshotByUsername.mockResolvedValue({
            email: 'john@example.com',
        });

        await handler.execute(baseContext);

        expect(mailService.sendEmail).toHaveBeenCalledWith(
            'john@example.com',
            expect.anything(),
            expect.anything(),
        );
    });
});
