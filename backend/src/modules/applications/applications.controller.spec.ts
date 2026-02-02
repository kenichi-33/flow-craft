
import { Test, TestingModule } from '@nestjs/testing';
import { ApplicationsController } from './applications.controller';
import { ApplicationsService } from './applications.service';
import { CreateApplicationDto } from './dto/create-application.dto';

describe('ApplicationsController', () => {
  let controller: ApplicationsController;
  let service: ApplicationsService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    cancel: jest.fn(),
  };

  const mockUser = { username: 'testuser', sub: 'u1' } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApplicationsController],
      providers: [
        { provide: ApplicationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ApplicationsController>(ApplicationsController);
    service = module.get<ApplicationsService>(ApplicationsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create', async () => {
      const dto: CreateApplicationDto = {
        title: 'New App',
        applicationDefinitionId: 'def-1',
        inputData: {},
      } as any;
      await controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with parsed params', async () => {
      await controller.findAll(
        mockUser,
        '1', '10', // page, limit
        'query', // search
        'createdAt', 'desc', // sort
        'IN_PROGRESS', // status
        undefined, // appNumber
        undefined, undefined, // dates
        'true' // myApplications
      );

      expect(service.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'query',
        sortBy: 'createdAt',
        sortOrder: 'desc',
        status: 'IN_PROGRESS',
        applicantId: 'testuser',
        requestUserId: 'testuser',
        applicationNumber: undefined,
        dateFrom: undefined,
        dateTo: undefined,
      });
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with user context', async () => {
      await controller.findOne('app-1', mockUser);
      expect(service.findOne).toHaveBeenCalledWith('app-1', 'testuser');
    });
  });

  describe('update', () => {
    it('should call service.update', async () => {
      const updateData = { title: 'Updated' };
      await controller.update('app-1', updateData);
      expect(service.update).toHaveBeenCalledWith('app-1', updateData);
    });
  });

  describe('cancel', () => {
    it('should call service.cancel', async () => {
      await controller.cancel('app-1', mockUser);
      expect(service.cancel).toHaveBeenCalledWith('app-1', 'testuser');
    });
  });
});
