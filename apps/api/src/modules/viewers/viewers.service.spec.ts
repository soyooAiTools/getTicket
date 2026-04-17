import { Test } from '@nestjs/testing';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ViewersService } from './viewers.service';

describe('ViewersService', () => {
  const viewerIdCardKey =
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const piiKey =
    'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';

  const prismaMock = {
    viewer: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    process.env.VIEWER_ID_CARD_KEY = viewerIdCardKey;
    process.env.PII_KEY = piiKey;
    jest.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.VIEWER_ID_CARD_KEY;
    delete process.env.PII_KEY;
  });

  it('persists a viewer with encrypted id card storage and returns public fields only', async () => {
    prismaMock.viewer.create.mockResolvedValue({
      id: 'viewer_1',
      mobile: '13800138000',
      name: '张三',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [ViewersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const service = moduleRef.get(ViewersService);
    const result = await service.createViewer({
      idCard: '110101199001011234',
      mobile: '13800138000',
      name: '张三',
      userId: 'mock-user-id',
    });

    expect(prismaMock.viewer.create).toHaveBeenCalledWith({
      select: {
        id: true,
        mobile: true,
        name: true,
      },
      data: expect.objectContaining({
        idCardEncrypted: expect.any(String),
        mobile: '13800138000',
        name: '张三',
        userId: 'mock-user-id',
      }),
    });
    expect(
      (prismaMock.viewer.create as jest.Mock).mock.calls[0][0].data.idCardEncrypted,
    ).not.toContain('110101199001011234');
    expect(result).toEqual({
      id: 'viewer_1',
      mobile: '13800138000',
      name: '张三',
    });
  });

  it('lists viewers for a user in descending creation order and returns public fields only', async () => {
    prismaMock.viewer.findMany.mockResolvedValue([
      {
        id: 'viewer_2',
        mobile: '13800138001',
        name: '李四',
      },
      {
        id: 'viewer_1',
        mobile: '13800138000',
        name: '张三',
      },
    ]);

    const moduleRef = await Test.createTestingModule({
      providers: [ViewersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const service = moduleRef.get(ViewersService);
    const result = await service.listViewersByUserId('mock-user-id');

    expect(prismaMock.viewer.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        mobile: true,
        name: true,
      },
      orderBy: { createdAt: 'desc' },
      where: { userId: 'mock-user-id' },
    });
    expect(result).toEqual([
      {
        id: 'viewer_2',
        mobile: '13800138001',
        name: '李四',
      },
      {
        id: 'viewer_1',
        mobile: '13800138000',
        name: '张三',
      },
    ]);
  });

  it('falls back to PII_KEY when VIEWER_ID_CARD_KEY is missing during create', async () => {
    delete process.env.VIEWER_ID_CARD_KEY;

    prismaMock.viewer.create.mockResolvedValue({
      id: 'viewer_3',
      mobile: '13800138002',
      name: '王五',
    });

    const moduleRef = await Test.createTestingModule({
      providers: [ViewersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const service = moduleRef.get(ViewersService);
    const result = await service.createViewer({
      idCard: '110101199001011235',
      mobile: '13800138002',
      name: '王五',
      userId: 'mock-user-id',
    });

    expect(prismaMock.viewer.create).toHaveBeenCalledWith({
      select: {
        id: true,
        mobile: true,
        name: true,
      },
      data: expect.objectContaining({
        idCardEncrypted: expect.any(String),
      }),
    });
    expect(result).toEqual({
      id: 'viewer_3',
      mobile: '13800138002',
      name: '王五',
    });
  });

  it('reports both supported keys when encryption config is missing', async () => {
    delete process.env.VIEWER_ID_CARD_KEY;
    delete process.env.PII_KEY;

    const moduleRef = await Test.createTestingModule({
      providers: [ViewersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    const service = moduleRef.get(ViewersService);

    await expect(
      service.createViewer({
        idCard: '110101199001011236',
        mobile: '13800138003',
        name: '赵六',
        userId: 'mock-user-id',
      }),
    ).rejects.toThrow(
      'VIEWER_ID_CARD_KEY or PII_KEY must be set to a 64-character hex string.',
    );
  });
});
