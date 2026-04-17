import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PaymentMethod, PaymentStatus } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import type { WechatPaymentIntent } from '../../../../../packages/contracts/src';

import { FulfillmentEventsService } from '../fulfillment/fulfillment-events.service';
import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';
import {
  type CreateJsapiIntentInput,
  WechatPayGateway,
} from './wechat-pay.gateway';

export type PaidCallbackInput = {
  amount: number;
  orderId: string;
  providerTxnId: string;
};

export type PaidCallbackOutTradeNoInput = {
  amount: number;
  outTradeNo: string;
  providerTxnId: string;
};

export type PaidTransitionPayload = PaidCallbackInput & {
  orderStatus: OrderStatus;
  paidAt: string;
};

export type CreateWechatIntentInput = {
  customerId: string;
  openId: string;
  orderId: string;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly wechatPayGateway?: WechatPayGateway,
    @Optional()
    private readonly fulfillmentEventsService?: FulfillmentEventsService,
  ) {}

  async createWechatIntent(
    input: CreateWechatIntentInput,
  ): Promise<WechatPaymentIntent> {
    const order = await this.prisma.order.findFirst({
      include: {
        items: {
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            ticketTier: {
              include: {
                session: {
                  include: {
                    event: true,
                  },
                },
              },
            },
          },
        },
      },
      where: {
        id: input.orderId,
        status: ORDER_STATUS.PENDING_PAYMENT,
        userId: input.customerId,
      },
    });

    if (!order || order.items.length === 0) {
      throw new BadRequestException('Pending order not found.');
    }

    const firstEventTitle = order.items[0].ticketTier.session.event.title.trim();

    if (!firstEventTitle) {
      throw new BadRequestException('Pending order is missing event details.');
    }

    if (!this.wechatPayGateway) {
      throw new BadRequestException('WeChat pay gateway is not configured.');
    }

    const notifyUrl = process.env.WECHAT_NOTIFY_URL?.trim();

    if (!notifyUrl) {
      throw new BadRequestException('WeChat payment configuration is incomplete.');
    }

    return this.wechatPayGateway.createJsapiIntent({
      amount: order.totalAmount,
      description: firstEventTitle,
      notifyUrl,
      openId: input.openId,
      outTradeNo: order.orderNumber,
    } satisfies CreateJsapiIntentInput);
  }

  async buildPaidTransitionFromOutTradeNo({
    amount,
    outTradeNo,
    providerTxnId,
  }: PaidCallbackOutTradeNoInput): Promise<PaidTransitionPayload> {
    const order = await this.prisma.order.findUnique({
      where: {
        orderNumber: outTradeNo,
      },
      select: {
        id: true,
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found.');
    }

    return this.buildPaidTransition({
      amount,
      orderId: order.id,
      providerTxnId,
    });
  }

  async buildPaidTransition({
    amount,
    orderId,
    providerTxnId,
  }: PaidCallbackInput): Promise<PaidTransitionPayload> {
    let shouldSubmitPaidOrder = false;

    const transition = await this.prisma.$transaction(async (tx) => {
      const conflictMessage =
        'Order already has a successful payment with a different transaction id.';
      const inconsistentStateMessage =
        'Order payment state is inconsistent after payment callback.';
      const existingPayment = await tx.payment.findUnique({
        where: {
          providerTxnId,
        },
        select: {
          amount: true,
          orderId: true,
          paidAt: true,
          status: true,
        },
      });

      if (
        existingPayment &&
        (existingPayment.amount !== amount || existingPayment.orderId !== orderId)
      ) {
        throw new BadRequestException(
          'providerTxnId is already associated with a different payment.',
        );
      }

      const order = await tx.order.findUnique({
        where: {
          id: orderId,
        },
        select: {
          id: true,
          status: true,
          totalAmount: true,
        },
      });

      if (!order) {
        throw new BadRequestException('Order not found.');
      }

      if (order.totalAmount !== amount) {
        throw new BadRequestException('Callback amount does not match order total.');
      }

      const paidAt = existingPayment?.paidAt ?? new Date();
      const paymentStatus =
        existingPayment?.status &&
        existingPayment.status !== PaymentStatus.PENDING &&
        existingPayment.status !== PaymentStatus.SUCCEEDED
          ? existingPayment.status
          : PaymentStatus.SUCCEEDED;
      const upsertPayment = async () =>
        tx.payment.upsert({
          where: {
            providerTxnId,
          },
          create: {
            amount,
            method: PaymentMethod.WECHAT_PAY,
            orderId,
            paidAt,
            providerTxnId,
            status: PaymentStatus.SUCCEEDED,
          },
          update: {
            amount,
            method: PaymentMethod.WECHAT_PAY,
            paidAt,
            status: paymentStatus,
          },
        });
      const findSucceededOrderPayment = async () =>
        tx.payment.findFirst({
          where: {
            orderId: order.id,
            status: PaymentStatus.SUCCEEDED,
          },
          select: {
            providerTxnId: true,
          },
        });

      let orderStatus = order.status;

      if (order.status === ORDER_STATUS.PENDING_PAYMENT) {
        const orderUpdateResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: ORDER_STATUS.PENDING_PAYMENT,
          },
          data: {
            status: ORDER_STATUS.PAID_PENDING_FULFILLMENT,
          },
        });

        if (orderUpdateResult.count > 0) {
          shouldSubmitPaidOrder = true;
          const succeededOrderPayment = await findSucceededOrderPayment();

          if (
            succeededOrderPayment &&
            succeededOrderPayment.providerTxnId !== providerTxnId
          ) {
            throw new BadRequestException(conflictMessage);
          }

          await upsertPayment();
          orderStatus = ORDER_STATUS.PAID_PENDING_FULFILLMENT;
        } else {
          const currentOrder = await tx.order.findUnique({
            where: {
              id: orderId,
            },
            select: {
              status: true,
            },
          });
          const succeededOrderPayment = await findSucceededOrderPayment();

          if (succeededOrderPayment?.providerTxnId === providerTxnId) {
            await upsertPayment();
            orderStatus = currentOrder?.status ?? order.status;
            shouldSubmitPaidOrder =
              orderStatus === ORDER_STATUS.PAID_PENDING_FULFILLMENT;
          } else if (succeededOrderPayment) {
            throw new BadRequestException(conflictMessage);
          } else {
            throw new BadRequestException(inconsistentStateMessage);
          }
        }
      } else {
        const succeededOrderPayment = await findSucceededOrderPayment();

        if (succeededOrderPayment && succeededOrderPayment.providerTxnId !== providerTxnId) {
          throw new BadRequestException(conflictMessage);
        }

        if (!existingPayment && !succeededOrderPayment) {
          throw new BadRequestException(inconsistentStateMessage);
        }

        await upsertPayment();
        shouldSubmitPaidOrder =
          order.status === ORDER_STATUS.PAID_PENDING_FULFILLMENT &&
          paymentStatus === PaymentStatus.SUCCEEDED;
      }

      return {
        amount,
        orderId,
        orderStatus,
        paidAt: paidAt.toISOString(),
        providerTxnId,
      };
    });

    if (shouldSubmitPaidOrder) {
      await this.fulfillmentEventsService?.submitPaidOrder(orderId);
    }

    return transition;
  }
}
