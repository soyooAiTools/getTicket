import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';
import { UpstreamTicketingGateway } from '../../common/vendors/upstream-ticketing.gateway';
import { ORDER_STATUS, type OrderStatus } from '../orders/order-status';

export type RefundReasonCode = 'USER_IDENTITY_ERROR' | 'OTHER';

export type CalculateServiceFeeInput = {
  totalAmount: number;
  reasonCode: RefundReasonCode;
  daysBeforeStart: number;
};

export type RequestRefundInput = {
  customerId: string;
  orderId: string;
  reasonCode: RefundReasonCode;
  daysBeforeStart: number;
};

export type RecordVendorRefundInput = {
  orderId: string;
  refundNo: string;
  amount: number;
};

type RefundRequestRecord = {
  orderId: string;
  refundAmount: number;
  refundNo: string;
  serviceFee?: number;
  status: string;
};

type VendorRefundResult = {
  amount: number;
  nextStatus: typeof ORDER_STATUS.REFUNDED;
  orderId: string;
  refundNo: string;
  source: 'VENDOR_CALLBACK';
};

type AdminRefundEventSummary = {
  city: string;
  id: string;
  title: string;
  venueName: string;
};

type PrismaAdminRefundRequest = {
  id: string;
  order: {
    id: string;
    items: Array<{
      ticketTier: {
        session: {
          event: AdminRefundEventSummary;
          name: string;
        };
      };
    }>;
    orderNumber: string;
    status: string;
    userId: string;
  };
  processedAt: Date | null;
  reason: string;
  refundAmount: number;
  refundNo: string;
  requestedAmount: number;
  requestedAt: Date;
  serviceFee: number;
  status: string;
};

export type AdminRefundRequestItem = {
  event?: AdminRefundEventSummary;
  id: string;
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  processedAt?: string;
  reason: string;
  refundAmount: number;
  refundNo: string;
  requestedAmount: number;
  requestedAt: string;
  serviceFee: number;
  sessionName?: string;
  status: string;
  userId: string;
};

const REFUNDABLE_ORDER_STATUSES: ReadonlySet<OrderStatus> = new Set([
  ORDER_STATUS.PAID_PENDING_FULFILLMENT,
  ORDER_STATUS.SUBMITTED_TO_VENDOR,
  ORDER_STATUS.TICKET_ISSUED,
  ORDER_STATUS.TICKET_FAILED,
]);

@Injectable()
export class RefundsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly upstreamTicketingGateway: UpstreamTicketingGateway,
  ) {}

  private generateRefundNo() {
    return `RFD-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }

  calculateServiceFee({
    totalAmount,
    reasonCode,
    daysBeforeStart,
  }: CalculateServiceFeeInput) {
    const serviceFee =
      reasonCode === 'USER_IDENTITY_ERROR' && daysBeforeStart <= 3
        ? Math.floor(totalAmount * 0.2)
        : 0;

    return {
      refundAmount: totalAmount - serviceFee,
      serviceFee,
    };
  }

  async listAdminRequests(): Promise<AdminRefundRequestItem[]> {
    const refundRequests = await this.prisma.refundRequest.findMany({
      include: {
        order: {
          select: {
            id: true,
            items: {
              orderBy: {
                createdAt: 'asc',
              },
              select: {
                ticketTier: {
                  select: {
                    session: {
                      select: {
                        event: {
                          select: {
                            city: true,
                            id: true,
                            title: true,
                            venueName: true,
                          },
                        },
                        name: true,
                      },
                    },
                  },
                },
              },
            },
            orderNumber: true,
            status: true,
            userId: true,
          },
        },
      },
      orderBy: {
        requestedAt: 'desc',
      },
    });

    return refundRequests.map((refundRequest: PrismaAdminRefundRequest) => {
      const firstItem = refundRequest.order.items[0];

      return {
        event: firstItem?.ticketTier.session.event,
        id: refundRequest.id,
        orderId: refundRequest.order.id,
        orderNumber: refundRequest.order.orderNumber,
        orderStatus: refundRequest.order.status,
        processedAt: refundRequest.processedAt?.toISOString(),
        reason: refundRequest.reason,
        refundAmount: refundRequest.refundAmount,
        refundNo: refundRequest.refundNo,
        requestedAmount: refundRequest.requestedAmount,
        requestedAt: refundRequest.requestedAt.toISOString(),
        serviceFee: refundRequest.serviceFee,
        sessionName: firstItem?.ticketTier.session.name,
        status: refundRequest.status,
        userId: refundRequest.order.userId,
      };
    });
  }

  async requestRefund(input: RequestRefundInput) {
    const refundRequest = await this.prisma.$transaction(async (tx) => {
      const order = await this.findOrderForRefundRequest(tx, input.orderId);

      if (!order) {
        throw new BadRequestException('orderId does not exist.');
      }

      if (order.userId !== input.customerId) {
        throw new BadRequestException('orderId does not exist.');
      }

      if (order.status === ORDER_STATUS.REFUND_REVIEWING) {
        const existingRefundRequest = await tx.refundRequest.findFirst({
          orderBy: {
            requestedAt: 'desc',
          },
          select: {
            refundAmount: true,
            refundNo: true,
            serviceFee: true,
          },
          where: {
            orderId: order.id,
            status: 'REVIEWING',
          },
        });

        if (!existingRefundRequest) {
          throw new BadRequestException(
            'order refund request state changed unexpectedly.',
          );
        }

        return existingRefundRequest;
      }

      if (order.status === ORDER_STATUS.REFUND_PROCESSING) {
        throw new BadRequestException('order already has an active refund request.');
      }

      if (!REFUNDABLE_ORDER_STATUSES.has(order.status)) {
        throw new BadRequestException('order is not eligible for refund request.');
      }

      const { refundAmount, serviceFee } = this.calculateServiceFee({
        daysBeforeStart: input.daysBeforeStart,
        reasonCode: input.reasonCode,
        totalAmount: order.totalAmount,
      });

      const transitionResult = await tx.order.updateMany({
        data: {
          status: ORDER_STATUS.REFUND_REVIEWING,
        },
        where: {
          id: order.id,
          status: {
            in: Array.from(REFUNDABLE_ORDER_STATUSES),
          },
        },
      });

      if (transitionResult.count === 0) {
        const currentOrder = await this.findOrderForRefundRequest(tx, order.id);

        if (!currentOrder) {
          throw new BadRequestException('orderId does not exist.');
        }

        if (this.hasActiveRefundRequestState(currentOrder.status)) {
          throw new BadRequestException(
            'order already has an active refund request.',
          );
        }

        if (!REFUNDABLE_ORDER_STATUSES.has(currentOrder.status)) {
          throw new BadRequestException(
            'order is not eligible for refund request.',
          );
        }

        throw new BadRequestException(
          'order refund request state changed unexpectedly.',
        );
      }

      const refundRequest = await tx.refundRequest.create({
        data: {
          orderId: order.id,
          reason: input.reasonCode,
          refundAmount,
          refundNo: this.generateRefundNo(),
          requestedAmount: order.totalAmount,
          serviceFee,
          status: 'REVIEWING',
        },
        select: {
          refundAmount: true,
          refundNo: true,
          serviceFee: true,
        },
      });

      return refundRequest;
    });

    const upstreamSubmission = await this.upstreamTicketingGateway.submitRefund({
      amount: refundRequest.refundAmount,
      orderId: input.orderId,
      refundNo: refundRequest.refundNo,
    });

    const refundTransitionResult = await this.prisma.refundRequest.updateMany({
      data: {
        status: 'PROCESSING',
      },
      where: {
        refundNo: refundRequest.refundNo,
        status: 'REVIEWING',
      },
    });

    if (refundTransitionResult.count === 0) {
      const currentRefundRequest = await this.prisma.refundRequest.findUnique({
        select: {
          orderId: true,
          refundAmount: true,
          refundNo: true,
          status: true,
        },
        where: {
          refundNo: refundRequest.refundNo,
        },
      });

      if (!currentRefundRequest) {
        throw new BadRequestException('refundNo does not exist.');
      }

      this.assertVendorRefundMatches(currentRefundRequest, {
        amount: refundRequest.refundAmount,
        orderId: input.orderId,
        refundNo: refundRequest.refundNo,
      });

      if (
        currentRefundRequest.status !== 'PROCESSING' &&
        currentRefundRequest.status !== 'COMPLETED'
      ) {
        throw new BadRequestException(
          'order refund request state changed unexpectedly.',
        );
      }
    }

    const transitionResult = await this.prisma.order.updateMany({
      data: {
        status: ORDER_STATUS.REFUND_PROCESSING,
      },
      where: {
        id: input.orderId,
        status: ORDER_STATUS.REFUND_REVIEWING,
      },
    });

    if (transitionResult.count === 0) {
      const currentOrder = await this.prisma.order.findUnique({
        select: {
          status: true,
        },
        where: {
          id: input.orderId,
        },
      });

      if (
        currentOrder?.status !== ORDER_STATUS.REFUND_PROCESSING &&
        currentOrder?.status !== ORDER_STATUS.REFUNDED
      ) {
        throw new BadRequestException(
          'order refund request state changed unexpectedly.',
        );
      }
    }

    return {
      ...refundRequest,
      externalRef: upstreamSubmission.externalRef,
    };
  }

  async recordVendorRefund(input: RecordVendorRefundInput) {
    return this.prisma.$transaction(async (tx) => {
      const refundRequest = await tx.refundRequest.findUnique({
        select: {
          orderId: true,
          refundAmount: true,
          refundNo: true,
          status: true,
        },
        where: {
          refundNo: input.refundNo,
        },
      });

      if (!refundRequest) {
        throw new BadRequestException('refundNo does not exist.');
      }

      this.assertVendorRefundMatches(refundRequest, input);

      if (refundRequest.status === 'COMPLETED') {
        return this.toVendorRefundResult(refundRequest);
      }

      const completionResult = await tx.refundRequest.updateMany({
        data: {
          processedAt: new Date(),
          refundAmount: input.amount,
          status: 'COMPLETED',
        },
        where: {
          refundNo: input.refundNo,
          status: {
            in: ['REVIEWING', 'PROCESSING'],
          },
        },
      });

      if (completionResult.count === 0) {
        const currentRefundRequest = await tx.refundRequest.findUnique({
          select: {
            orderId: true,
            refundAmount: true,
            refundNo: true,
            status: true,
          },
          where: {
            refundNo: input.refundNo,
          },
        });

        if (!currentRefundRequest) {
          throw new BadRequestException('refundNo does not exist.');
        }

        this.assertVendorRefundMatches(currentRefundRequest, input);

        if (currentRefundRequest.status === 'COMPLETED') {
          return this.toVendorRefundResult(currentRefundRequest);
        }

        throw new BadRequestException('refundNo is not in a refundable state.');
      }

      await tx.order.update({
        data: {
          status: ORDER_STATUS.REFUNDED,
        },
        where: {
          id: refundRequest.orderId,
        },
      });

      await tx.payment.updateMany({
        data: {
          status: 'REFUNDED',
        },
        where: {
          orderId: refundRequest.orderId,
          status: 'SUCCEEDED',
        },
      });

      return this.toVendorRefundResult({
        orderId: refundRequest.orderId,
        refundAmount: input.amount,
        refundNo: refundRequest.refundNo,
        status: 'COMPLETED',
      });
    });
  }

  private assertVendorRefundMatches(
    refundRequest: RefundRequestRecord,
    input: RecordVendorRefundInput,
  ) {
    if (refundRequest.orderId !== input.orderId) {
      throw new BadRequestException(
        'refundNo is already associated with a different refund result.',
      );
    }

    if (
      refundRequest.status === 'COMPLETED' &&
      refundRequest.refundAmount !== input.amount
    ) {
      throw new BadRequestException(
        'refundNo is already associated with a different refund result.',
      );
    }
  }

  private toVendorRefundResult(
    refundRequest: RefundRequestRecord,
  ): VendorRefundResult {
    return {
      amount: refundRequest.refundAmount,
      nextStatus: ORDER_STATUS.REFUNDED,
      orderId: refundRequest.orderId,
      refundNo: refundRequest.refundNo,
      source: 'VENDOR_CALLBACK',
    };
  }

  private hasActiveRefundRequestState(status: OrderStatus) {
    return (
      status === ORDER_STATUS.REFUND_REVIEWING ||
      status === ORDER_STATUS.REFUND_PROCESSING
    );
  }

  private findOrderForRefundRequest(
    tx: Prisma.TransactionClient,
    orderId: string,
  ) {
    return tx.order.findUnique({
      select: {
        id: true,
        status: true,
        totalAmount: true,
        userId: true,
      },
      where: {
        id: orderId,
      },
    });
  }
}
