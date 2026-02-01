import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MailerService } from '@nestjs-modules/mailer';

describe('MailService', () => {
  let service: MailService;

  const mockMailerService = {
    sendMail: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        { provide: MailerService, useValue: mockMailerService },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      mockMailerService.sendMail.mockResolvedValue({});
      const result = await service.sendEmail(
        'test@example.com',
        'Subject',
        'Body',
      );
      expect(result).toBe(true);
      expect(mockMailerService.sendMail).toHaveBeenCalledWith({
        to: 'test@example.com',
        subject: 'Subject',
        text: 'Body',
      });
    });

    it('should return false on failure', async () => {
      mockMailerService.sendMail.mockRejectedValue(new Error('SMTP Error'));
      const result = await service.sendEmail(
        'test@example.com',
        'Subject',
        'Body',
      );
      expect(result).toBe(false);
    });
  });

  describe('sendSlaBreachNotification', () => {
    it('should send SLA breach notification', async () => {
      mockMailerService.sendMail.mockResolvedValue({});
      const task = { id: 't1', type: 'approval' };
      const application = { title: 'Test App' };
      const result = await service.sendSlaBreachNotification(
        'user@example.com',
        task,
        application,
      );
      expect(result).toBe(true);
      expect(mockMailerService.sendMail).toHaveBeenCalled();
    });
  });

  describe('sendTaskReminder', () => {
    it('should send task reminder', async () => {
      mockMailerService.sendMail.mockResolvedValue({});
      const task = { id: 't1', type: 'approval' };
      const application = { title: 'Test App' };
      const result = await service.sendTaskReminder(
        'user@example.com',
        task,
        application,
      );
      expect(result).toBe(true);
    });
  });
});
