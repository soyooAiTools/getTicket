import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentCustomer,
  type CurrentCustomerPrincipal,
} from '../../common/auth/current-customer.decorator';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';

import { PaymentsService } from './payments.service';

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

type CreatePaymentIntentBody = {
  orderId: string;
};

function assertCreatePaymentIntentBody(
  body: unknown,
): asserts body is CreatePaymentIntentBody {
  if (body === null || typeof body !== 'object') {
    throw new BadRequestException('orderId is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId is required.');
  }
}

type ConfirmPaymentIntentBody = {
  amount: number;
};

function assertConfirmPaymentIntentBody(
  body: unknown,
): asserts body is ConfirmPaymentIntentBody {
  if (!isObjectRecord(body) || !isValidAmount(body.amount)) {
    throw new BadRequestException('amount is required.');
  }
}

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @UseGuards(CustomerSessionGuard)
  @Post('intents')
  createIntent(
    @Body() body: unknown,
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
  ) {
    assertCreatePaymentIntentBody(body);

    return this.paymentsService.createPaymentIntent({
      customerId: customer.id,
      orderId: body.orderId.trim(),
    });
  }

  @Post('intents/:paymentId/confirm')
  confirmIntent(
    @Param('paymentId') paymentId: string,
    @Body() body: unknown,
  ) {
    assertConfirmPaymentIntentBody(body);

    return this.paymentsService.confirmPaymentIntent({
      amount: body.amount,
      paymentId,
    });
  }
}
