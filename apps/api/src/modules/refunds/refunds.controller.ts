import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import {
  CurrentCustomer,
  type CurrentCustomerPrincipal,
} from '../../common/auth/current-customer.decorator';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import {
  RecordVendorRefundInput,
  RefundReasonCode,
  RefundsService,
  RequestRefundInput,
} from './refunds.service';

export type CalculateRefundRequest = {
  totalAmount: number;
  reasonCode: RefundReasonCode;
  daysBeforeStart: number;
};

export type RequestRefundRequest = {
  orderId: string;
  reasonCode: RefundReasonCode;
  daysBeforeStart: number;
};

export type VendorRefundCallbackRequest = {
  orderId: string;
  refundNo: string;
  amount: number;
};

const supportedReasonCodes: RefundReasonCode[] = [
  'USER_IDENTITY_ERROR',
  'OTHER',
];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isSupportedReasonCode(value: unknown): value is RefundReasonCode {
  return (
    typeof value === 'string' &&
    supportedReasonCodes.includes(value as RefundReasonCode)
  );
}

function assertCalculateRefundRequest(
  body: unknown,
): asserts body is CalculateRefundRequest {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Calculate refund payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isValidAmount(candidate.totalAmount)) {
    throw new BadRequestException('totalAmount must be a non-negative number.');
  }

  if (!isSupportedReasonCode(candidate.reasonCode)) {
    throw new BadRequestException(
      'reasonCode must be USER_IDENTITY_ERROR or OTHER.',
    );
  }

  if (!isValidInteger(candidate.daysBeforeStart)) {
    throw new BadRequestException(
      'daysBeforeStart must be a non-negative integer.',
    );
  }
}

function assertRequestRefundRequest(
  body: unknown,
): asserts body is RequestRefundRequest {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Refund request payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId must be a non-empty string.');
  }

  if (!isSupportedReasonCode(candidate.reasonCode)) {
    throw new BadRequestException(
      'reasonCode must be USER_IDENTITY_ERROR or OTHER.',
    );
  }

  if (!isValidInteger(candidate.daysBeforeStart)) {
    throw new BadRequestException(
      'daysBeforeStart must be a non-negative integer.',
    );
  }
}

function assertVendorRefundCallbackRequest(
  body: unknown,
): asserts body is VendorRefundCallbackRequest {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Vendor refund callback payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId must be a non-empty string.');
  }

  if (!isNonEmptyString(candidate.refundNo)) {
    throw new BadRequestException('refundNo must be a non-empty string.');
  }

  if (!isValidAmount(candidate.amount)) {
    throw new BadRequestException('amount must be a non-negative number.');
  }
}

@Controller('refunds')
export class RefundsController {
  constructor(private readonly refundsService: RefundsService) {}

  @Get('admin')
  @UseGuards(AdminApiSecretGuard)
  async listAdminRequests() {
    return {
      items: await this.refundsService.listAdminRequests(),
    };
  }

  @Post('calculate')
  calculate(@Body() body: unknown) {
    assertCalculateRefundRequest(body);

    return this.refundsService.calculateServiceFee(body);
  }

  @Post('request')
  @UseGuards(CustomerSessionGuard)
  async requestRefund(
    @Body() body: unknown,
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
  ) {
    assertRequestRefundRequest(body);

    const request: RequestRefundInput = {
      ...(body as RequestRefundRequest),
      customerId: customer.id,
    };

    return this.refundsService.requestRefund(request);
  }

  @Post('vendor-callback')
  @UseGuards(VendorCallbackSecretGuard)
  async handleVendorCallback(@Body() body: unknown) {
    assertVendorRefundCallbackRequest(body);

    const event: RecordVendorRefundInput = body;

    return this.refundsService.recordVendorRefund(event);
  }
}
