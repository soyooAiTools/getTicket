import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Prisma } from '@prisma/client';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

const prismaMock = {
  event: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
} as never;

describe('CatalogService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reads only published events from Prisma with sale and refund switches', async () => {
    (prismaMock.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'event-1001',
        title: '\u767d\u663c\u620f\u5267\u8282',
        city: '\u676d\u5dde',
        venueName: '\u676d\u5dde\u5927\u5267\u9662',
        description: undefined,
        saleStatus: 'ON_SALE',
        minPrice: 399,
        published: true,
        refundEntryEnabled: false,
      },
      {
        id: 'event-1002',
        title: '\u94f6\u6cb3\u5217\u8f66\u97f3\u4e50\u4f1a',
        city: '\u4e0a\u6d77',
        venueName: '\u4e0a\u6d77\u670d\u52a1\u4e2d\u5fc3',
        saleStatus: 'UPCOMING',
        minPrice: 299,
        coverImageUrl: null,
        published: true,
        refundEntryEnabled: true,
      },
    ]);

    const service = new CatalogService(prismaMock);
    const result = await service.listPublishedEvents();

    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        city: true,
        coverImageUrl: true,
        description: true,
        id: true,
        minPrice: true,
        published: true,
        refundEntryEnabled: true,
        saleStatus: true,
        title: true,
        venueName: true,
      },
      where: {
        published: true,
      },
    });
    expect(result).toEqual([
      {
        id: 'event-1001',
        title: '\u767d\u663c\u620f\u5267\u8282',
        city: '\u676d\u5dde',
        venueName: '\u676d\u5dde\u5927\u5267\u9662',
        description: undefined,
        saleStatus: 'ON_SALE',
        minPrice: 399,
        published: true,
        refundEntryEnabled: false,
      },
      {
        id: 'event-1002',
        title: '\u94f6\u6cb3\u5217\u8f66\u97f3\u4e50\u4f1a',
        city: '\u4e0a\u6d77',
        venueName: '\u4e0a\u6d77\u670d\u52a1\u4e2d\u5fc3',
        saleStatus: 'UPCOMING',
        minPrice: 299,
        coverImageUrl: undefined,
        published: true,
        refundEntryEnabled: true,
      },
    ]);
  });

  it('reads admin event operations without filtering unpublished events', async () => {
    (prismaMock.event.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'event-1003',
        title: 'Internal Beta Hold',
        city: 'Shanghai',
        venueName: 'Expo Arena',
        description: null,
        saleStatus: 'UPCOMING',
        minPrice: 399,
        coverImageUrl: null,
        published: false,
        refundEntryEnabled: false,
      },
    ]);

    const service = new CatalogService(prismaMock);
    const result = await service.listAdminEvents();

    expect(prismaMock.event.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        city: true,
        coverImageUrl: true,
        description: true,
        id: true,
        minPrice: true,
        published: true,
        refundEntryEnabled: true,
        saleStatus: true,
        title: true,
        venueName: true,
      },
    });
    expect(result).toEqual([
      {
        id: 'event-1003',
        title: 'Internal Beta Hold',
        city: 'Shanghai',
        venueName: 'Expo Arena',
        description: undefined,
        coverImageUrl: undefined,
        saleStatus: 'UPCOMING',
        minPrice: 399,
        published: false,
        refundEntryEnabled: false,
      },
    ]);
  });

  it('returns a published event detail with sessions and ticket tiers', async () => {
    (prismaMock.event.findFirst as jest.Mock).mockResolvedValue({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: undefined,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [
        {
          id: 'session-001',
          name: '2026-05-01 19:30',
          startsAt: new Date('2026-05-01T11:30:00.000Z'),
          endsAt: new Date('2026-05-01T14:00:00.000Z'),
          saleStartsAt: new Date('2026-04-20T12:00:00.000Z'),
          saleEndsAt: new Date('2026-04-30T12:00:00.000Z'),
          ticketTiers: [
            {
              id: 'tier-001',
              name: 'Inner Field',
              price: 499,
              inventory: 200,
              ticketType: 'E_TICKET',
            },
          ],
        },
      ],
    });

    const service = new CatalogService(prismaMock);
    const result = await service.getEventDetail('event-1001');

    expect(prismaMock.event.findFirst).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        city: true,
        coverImageUrl: true,
        description: true,
        id: true,
        minPrice: true,
        published: true,
        refundEntryEnabled: true,
        saleStatus: true,
        sessions: {
          orderBy: {
            startsAt: 'asc',
          },
          select: {
            endsAt: true,
            id: true,
            name: true,
            saleEndsAt: true,
            saleStartsAt: true,
            startsAt: true,
            ticketTiers: {
              orderBy: {
                price: 'asc',
              },
              select: {
                id: true,
                inventory: true,
                name: true,
                price: true,
                ticketType: true,
              },
            },
          },
        },
        title: true,
        venueName: true,
      },
      where: {
        id: 'event-1001',
        published: true,
      },
    });
    expect(result).toEqual({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: undefined,
      coverImageUrl: undefined,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [
        {
          id: 'session-001',
          name: '2026-05-01 19:30',
          startsAt: '2026-05-01T11:30:00.000Z',
          endsAt: '2026-05-01T14:00:00.000Z',
          saleStartsAt: '2026-04-20T12:00:00.000Z',
          saleEndsAt: '2026-04-30T12:00:00.000Z',
          ticketTiers: [
            {
              id: 'tier-001',
              name: 'Inner Field',
              price: 499,
              inventory: 200,
              ticketType: 'E_TICKET',
            },
          ],
        },
      ],
    });
  });

  it('rejects unpublished event details for public reads', async () => {
    (prismaMock.event.findFirst as jest.Mock).mockResolvedValue(null);

    const service = new CatalogService(prismaMock);

    await expect(service.getEventDetail('event-999')).rejects.toThrow(
      'Event not found.',
    );
  });

  it('updates only requested event operations', async () => {
    (prismaMock.event.update as jest.Mock).mockResolvedValue({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: null,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: false,
      refundEntryEnabled: true,
      sessions: [
        {
          id: 'session-001',
          name: '2026-05-01 19:30',
          startsAt: new Date('2026-05-01T11:30:00.000Z'),
          endsAt: new Date('2026-05-01T14:00:00.000Z'),
          saleStartsAt: new Date('2026-04-20T12:00:00.000Z'),
          saleEndsAt: new Date('2026-04-30T12:00:00.000Z'),
          ticketTiers: [
            {
              id: 'tier-001',
              name: 'Inner Field',
              price: 499,
              inventory: 200,
              ticketType: 'E_TICKET',
            },
          ],
        },
      ],
    });

    const service = new CatalogService(prismaMock);
    const result = await service.updateEventOperations('event-1001', {
      published: false,
      refundEntryEnabled: true,
      saleStatus: 'SOLD_OUT',
    });

    expect(prismaMock.event.update).toHaveBeenCalledWith({
      data: {
        published: false,
        refundEntryEnabled: true,
        saleStatus: 'SOLD_OUT',
      },
      where: {
        id: 'event-1001',
      },
      select: {
        city: true,
        coverImageUrl: true,
        description: true,
        id: true,
        minPrice: true,
        published: true,
        refundEntryEnabled: true,
        saleStatus: true,
        sessions: {
          orderBy: {
            startsAt: 'asc',
          },
          select: {
            endsAt: true,
            id: true,
            name: true,
            saleEndsAt: true,
            saleStartsAt: true,
            startsAt: true,
            ticketTiers: {
              orderBy: {
                price: 'asc',
              },
              select: {
                id: true,
                inventory: true,
                name: true,
                price: true,
                ticketType: true,
              },
            },
          },
        },
        title: true,
        venueName: true,
      },
    });
    expect(result).toEqual({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: undefined,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: false,
      refundEntryEnabled: true,
      sessions: [
        {
          id: 'session-001',
          name: '2026-05-01 19:30',
          startsAt: '2026-05-01T11:30:00.000Z',
          endsAt: '2026-05-01T14:00:00.000Z',
          saleStartsAt: '2026-04-20T12:00:00.000Z',
          saleEndsAt: '2026-04-30T12:00:00.000Z',
          ticketTiers: [
            {
              id: 'tier-001',
              name: 'Inner Field',
              price: 499,
              inventory: 200,
              ticketType: 'E_TICKET',
            },
          ],
        },
      ],
    });
  });

  it('translates missing event updates into a not found error', async () => {
    (prismaMock.event.update as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Record not found.', {
        code: 'P2025',
        clientVersion: '5.22.0',
      }),
    );

    const service = new CatalogService(prismaMock);

    await expect(
      service.updateEventOperations('event-missing', {
        published: true,
      }),
    ).rejects.toThrow('Event not found.');
  });
});

describe('CatalogController', () => {
  const catalogServiceMock = {
    listAdminEvents: jest.fn(),
    listPublishedEvents: jest.fn(),
    getEventDetail: jest.fn(),
    updateEventOperations: jest.fn(),
  } as unknown as CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns published catalog items from the service', async () => {
    (catalogServiceMock.listPublishedEvents as jest.Mock).mockResolvedValue([
      {
        id: 'event-1001',
        title: '\u767d\u663c\u620f\u5267\u8282',
        city: '\u676d\u5dde',
        venueName: '\u676d\u5dde\u5927\u5267\u9662',
        description: undefined,
        saleStatus: 'ON_SALE',
        minPrice: 399,
        published: true,
        refundEntryEnabled: false,
      },
    ]);

    const controller = new CatalogController(catalogServiceMock);
    const result = await controller.listEvents();

    expect(catalogServiceMock.listPublishedEvents).toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        {
          id: 'event-1001',
          title: '\u767d\u663c\u620f\u5267\u8282',
          city: '\u676d\u5dde',
          venueName: '\u676d\u5dde\u5927\u5267\u9662',
          description: undefined,
          saleStatus: 'ON_SALE',
          minPrice: 399,
          published: true,
          refundEntryEnabled: false,
        },
      ],
    });
  });

  it('returns admin catalog items from the service', async () => {
    (catalogServiceMock.listAdminEvents as jest.Mock).mockResolvedValue([
      {
        id: 'event-1003',
        title: 'Internal Beta Hold',
        city: 'Shanghai',
        venueName: 'Expo Arena',
        description: undefined,
        saleStatus: 'UPCOMING',
        minPrice: 399,
        published: false,
        refundEntryEnabled: false,
      },
    ]);

    const controller = new CatalogController(catalogServiceMock);
    const result = await controller.listAdminEvents();

    expect(catalogServiceMock.listAdminEvents).toHaveBeenCalled();
    expect(result).toEqual({
      items: [
        {
          id: 'event-1003',
          title: 'Internal Beta Hold',
          city: 'Shanghai',
          venueName: 'Expo Arena',
          description: undefined,
          saleStatus: 'UPCOMING',
          minPrice: 399,
          published: false,
          refundEntryEnabled: false,
        },
      ],
    });
  });

  it('returns a published event detail from the service', async () => {
    (catalogServiceMock.getEventDetail as jest.Mock).mockResolvedValue({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: undefined,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [],
    });

    const controller = new CatalogController(catalogServiceMock);
    const result = await controller.getEventDetail('event-1001');

    expect(catalogServiceMock.getEventDetail).toHaveBeenCalledWith(
      'event-1001',
    );
    expect(result).toEqual({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: undefined,
      saleStatus: 'ON_SALE',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [],
    });
  });

  it('rejects admin toggle updates without any operation fields', async () => {
    const controller = new CatalogController(catalogServiceMock);

    await expect(
      controller.updateEventOperations('event-1001', {}),
    ).rejects.toThrow(BadRequestException);
    expect(catalogServiceMock.updateEventOperations).not.toHaveBeenCalled();
  });

  it('accepts sale status in admin toggle updates', async () => {
    (catalogServiceMock.updateEventOperations as jest.Mock).mockResolvedValue({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: 'Beta event detail description.',
      saleStatus: 'SOLD_OUT',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [],
    });

    const controller = new CatalogController(catalogServiceMock);
    const result = await controller.updateEventOperations('event-1001', {
      saleStatus: 'SOLD_OUT',
    });

    expect(catalogServiceMock.updateEventOperations).toHaveBeenCalledWith(
      'event-1001',
      {
        saleStatus: 'SOLD_OUT',
      },
    );
    expect(result).toEqual({
      id: 'event-1001',
      title: '\u767d\u663c\u620f\u5267\u8282',
      city: '\u676d\u5dde',
      venueName: '\u676d\u5dde\u5927\u5267\u9662',
      description: 'Beta event detail description.',
      saleStatus: 'SOLD_OUT',
      minPrice: 399,
      published: true,
      refundEntryEnabled: true,
      sessions: [],
    });
  });

  it('protects the admin catalog mutation route with the admin secret guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        CatalogController.prototype.updateEventOperations,
      ) ?? [];

    expect(guards).toContain(AdminApiSecretGuard);
  });

  it('protects the admin catalog list route with the admin secret guard', () => {
    const guards =
      Reflect.getMetadata(
        GUARDS_METADATA,
        CatalogController.prototype.listAdminEvents,
      ) ?? [];

    expect(guards).toContain(AdminApiSecretGuard);
  });
});
