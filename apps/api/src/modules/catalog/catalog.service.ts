import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type {
  EventCatalogSummary,
  EventDetail,
  EventOperationsUpdate,
} from '../../../../../packages/contracts/src';
import { PrismaService } from '../../common/prisma/prisma.service';

const publishedEventSelect = {
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
} as const;

const eventDetailSelect = {
  ...publishedEventSelect,
  sessions: {
    orderBy: {
      startsAt: 'asc' as const,
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
          price: 'asc' as const,
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
} as const;

type PrismaEventSession = {
  endsAt: Date | string | null;
  id: string;
  name: string;
  saleEndsAt: Date | string | null;
  saleStartsAt: Date | string | null;
  startsAt: Date | string;
  ticketTiers: Array<{
    id: string;
    inventory: number;
    name: string;
    price: number;
    ticketType: 'E_TICKET' | 'PAPER_TICKET';
  }>;
};

type PrismaCatalogEvent = {
  city: string;
  coverImageUrl: string | null;
  description: string | null;
  id: string;
  minPrice: number;
  published: boolean;
  refundEntryEnabled: boolean;
  saleStatus: EventCatalogSummary['saleStatus'];
  sessions?: PrismaEventSession[];
  title: string;
  venueName: string;
};

function normalizeNullableText(value: string | null | undefined) {
  return value === null ? undefined : value;
}

function normalizeDate(value: Date | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : value;
}

function normalizeRequiredDate(value: Date | string) {
  return value instanceof Date ? value.toISOString() : value;
}

function normalizeEventSession(session: PrismaEventSession) {
  return {
    endsAt: normalizeDate(session.endsAt),
    id: session.id,
    name: session.name,
    saleEndsAt: normalizeDate(session.saleEndsAt),
    saleStartsAt: normalizeDate(session.saleStartsAt),
    startsAt: normalizeRequiredDate(session.startsAt),
    ticketTiers: session.ticketTiers,
  };
}

function normalizeCatalogEvent(event: PrismaCatalogEvent): EventCatalogSummary {
  return {
    city: event.city,
    coverImageUrl: normalizeNullableText(event.coverImageUrl),
    description: normalizeNullableText(event.description),
    id: event.id,
    minPrice: event.minPrice,
    published: event.published,
    refundEntryEnabled: event.refundEntryEnabled,
    saleStatus: event.saleStatus,
    title: event.title,
    venueName: event.venueName,
  };
}

function normalizeEventDetail(event: PrismaCatalogEvent): EventDetail {
  return {
    ...normalizeCatalogEvent(event),
    sessions: event.sessions?.map(normalizeEventSession) ?? [],
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublishedEvents(): Promise<EventCatalogSummary[]> {
    const events = await this.prisma.event.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: publishedEventSelect,
      where: {
        published: true,
      },
    });

    return events.map(normalizeCatalogEvent);
  }

  async listAdminEvents(): Promise<EventCatalogSummary[]> {
    const events = await this.prisma.event.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: publishedEventSelect,
    });

    return events.map(normalizeCatalogEvent);
  }

  async getEventDetail(eventId: string): Promise<EventDetail> {
    const event = await this.prisma.event.findFirst({
      orderBy: {
        createdAt: 'desc',
      },
      select: eventDetailSelect,
      where: {
        id: eventId,
        published: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found.');
    }

    return normalizeEventDetail(event as PrismaCatalogEvent);
  }

  async updateEventOperations(
    eventId: string,
    input: EventOperationsUpdate,
  ): Promise<EventDetail> {
    try {
      const event = await this.prisma.event.update({
        data: {
          ...(input.published === undefined
            ? {}
            : { published: input.published }),
          ...(input.refundEntryEnabled === undefined
            ? {}
            : { refundEntryEnabled: input.refundEntryEnabled }),
          ...(input.saleStatus === undefined
            ? {}
            : { saleStatus: input.saleStatus }),
        },
        select: eventDetailSelect,
        where: {
          id: eventId,
        },
      });

      return normalizeEventDetail(event as PrismaCatalogEvent);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Event not found.');
      }

      throw error;
    }
  }
}
