import { randomBytes } from 'crypto';

import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../../common/prisma/prisma.service';

import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';

// This is only a draft-order hold window for UI/API metadata, not a real stock lock.
export const DRAFT_ORDER_HOLD_WINDOW_MS = 15 * 60 * 1000;

export type TicketType = 'E_TICKET' | 'PAPER_TICKET';

export interface CreateDraftOrderInput {
  userId: string;
  tierId: string;
  viewerIds: string[];
  quantity: number;
  ticketType: TicketType;
}

export interface DraftOrder {
  id: string;
  userId: string;
  tierId: string;
  viewerIds: string[];
  quantity: number;
  ticketType: TicketType;
  status: OrderStatus;
  createdAt: string;
  inventoryLockExpiresAt: string;
}

@Injectable()
export class CheckoutService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraftOrder(input: CreateDraftOrderInput): Promise<DraftOrder> {
    if (
      !Array.isArray(input.viewerIds) ||
      input.viewerIds.length === 0 ||
      input.viewerIds.some(
        (viewerId) =>
          typeof viewerId !== 'string' || viewerId.trim().length === 0,
      )
    ) {
      throw new BadRequestException(
        'viewerIds must be a non-empty array of non-empty strings.',
      );
    }

    if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
      throw new BadRequestException('quantity must be a positive integer.');
    }

    if (input.viewerIds.length !== input.quantity) {
      throw new BadRequestException(
        'viewerIds length must match quantity for draft orders.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const tier = await tx.ticketTier.findUnique({
        select: {
          id: true,
          price: true,
          ticketType: true,
        },
        where: { id: input.tierId },
      });

      if (!tier) {
        throw new BadRequestException('tierId does not exist.');
      }

      if (tier.ticketType !== input.ticketType) {
        throw new BadRequestException('ticketType does not match tier.');
      }

      const viewers = await tx.viewer.findMany({
        select: { id: true },
        where: {
          id: { in: input.viewerIds },
          userId: input.userId,
        },
      });

      if (viewers.length !== input.viewerIds.length) {
        throw new BadRequestException(
          'viewerIds must belong to the submitting user.',
        );
      }

      const unitPrice = tier.price;
      const totalAmount = unitPrice * input.viewerIds.length;
      const order = await tx.order.create({
        data: {
          orderNumber: this.buildDraftOrderNumber(),
          status: ORDER_STATUS.PENDING_PAYMENT,
          ticketType: input.ticketType,
          totalAmount,
          userId: input.userId,
        },
        select: {
          createdAt: true,
          id: true,
        },
      });

      await tx.orderItem.createMany({
        data: input.viewerIds.map((viewerId) => ({
          orderId: order.id,
          quantity: 1,
          ticketTierId: tier.id,
          totalAmount: unitPrice,
          unitPrice,
          viewerId,
        })),
      });

      const inventoryLockExpiresAt = new Date(
        order.createdAt.getTime() + DRAFT_ORDER_HOLD_WINDOW_MS,
      );

      return {
        id: order.id,
        userId: input.userId,
        tierId: tier.id,
        viewerIds: [...input.viewerIds],
        quantity: input.quantity,
        ticketType: input.ticketType,
        status: ORDER_STATUS.PENDING_PAYMENT,
        createdAt: order.createdAt.toISOString(),
        inventoryLockExpiresAt: inventoryLockExpiresAt.toISOString(),
      };
    });
  }

  private buildDraftOrderNumber() {
    return `draft_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }
}
