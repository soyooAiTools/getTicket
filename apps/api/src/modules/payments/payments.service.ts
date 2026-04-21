import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { randomBytes } from 'crypto';

import type { PaymentIntent } from '../../../../../packages/contracts/src';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FulfillmentEventsService } from '../fulfillment/fulfillment-events.service';
import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';

export type CreatePaymentIntentInput = {
  customerId: string;
  orderId: string;
};

export type ConfirmPaymentIntentInput = {
  amount: number;
  paymentId: string;
};

export type PaidTransitionPayload = {
  orderId: string;
  orderStatus: OrderStatus;
  paidAt: string;
  paymentId: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly fulfillmentEventsService?: FulfillmentEventsService,
  ) {}

  async createPaymentIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntent> {
    const order = await this.prisma.order.findFirst({
      select: {
        id: true,
        totalAmount: true,
      },
      where: {
        id: input.orderId,
        status: ORDER_STATUS.PENDING_PAYMENT,
        userId: input.customerId,
      },
    });

    if (!order) {
      throw new BadRequestException('Pending order not found.');
    }

    const payment = await this.prisma.payment.create({
      data: {
        amount: order.totalAmount,
        method: PaymentMethod.EXTERNAL_PROVIDER,
        orderId: order.id,
        status: PaymentStatus.PENDING,
      },
      select: {
        id: true,
        orderId: true,
      },
    });

    return {
      paymentId: payment.id,
      orderId: payment.orderId,
      method: 'EXTERNAL_PROVIDER',
      status: 'PENDING',
      intentToken: randomBytes(16).toString('hex'),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    };
  }

  async confirmPaymentIntent(
    input: ConfirmPaymentIntentInput,
  ): Promise<PaidTransitionPayload> {
    let shouldSubmitPaidOrder = false;

    const transition = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: {
          id: input.paymentId,
        },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              totalAmount: true,
            },
          },
        },
      });

      if (!payment?.order) {
        throw new BadRequestException('Payment intent not found.');
      }

      if (payment.order.totalAmount !== input.amount) {
        throw new BadRequestException('Payment amount does not match order total.');
      }

      const paidAt = payment.paidAt ?? new Date();

      await tx.payment.update({
        where: {
          id: payment.id,
        },
        data: {
          method: PaymentMethod.EXTERNAL_PROVIDER,
          paidAt,
          status: PaymentStatus.SUCCEEDED,
        },
      });

      let orderStatus = payment.order.status;

      if (payment.order.status === ORDER_STATUS.PENDING_PAYMENT) {
        const updateResult = await tx.order.updateMany({
          where: {
            id: payment.order.id,
            status: ORDER_STATUS.PENDING_PAYMENT,
          },
          data: {
            status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
          },
        });

        if (updateResult.count > 0) {
          shouldSubmitPaidOrder = true;
          orderStatus = ORDER_STATUS.PAID_PENDING_FULFILLMENT;
        } else {
          const currentOrder = await tx.order.findUnique({
            where: {
              id: payment.order.id,
            },
            select: {
              status: true,
            },
          });

          orderStatus = currentOrder?.status ?? payment.order.status;
        }
      }

      return {
        paymentId: payment.id,
        orderId: payment.order.id,
        orderStatus,
        paidAt: paidAt.toISOString(),
      };
    });

    if (shouldSubmitPaidOrder) {
      await this.fulfillmentEventsService?.submitPaidOrder(transition.orderId);
    }

    return transition;
  }
}
