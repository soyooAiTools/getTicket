import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { VendorCallbackSecretGuard } from '../../common/auth/vendor-callback-secret.guard';
import { FulfillmentEventsService } from './fulfillment-events.service';

export type ManualIssuedRequest = {
  orderId: string;
  operatorId: string;
  ticketCode: string;
};

export type VendorCallbackIssuedRequest = {
  orderId: string;
  vendorEventId: string;
  ticketCode: string;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function assertManualIssuedRequest(
  body: unknown,
): asserts body is ManualIssuedRequest {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Manual issued payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId must be a non-empty string.');
  }

  if (!isNonEmptyString(candidate.operatorId)) {
    throw new BadRequestException('operatorId must be a non-empty string.');
  }

  if (!isNonEmptyString(candidate.ticketCode)) {
    throw new BadRequestException('ticketCode must be a non-empty string.');
  }
}

export function assertVendorCallbackIssuedRequest(
  body: unknown,
): asserts body is VendorCallbackIssuedRequest {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Vendor callback payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.orderId)) {
    throw new BadRequestException('orderId must be a non-empty string.');
  }

  if (!isNonEmptyString(candidate.vendorEventId)) {
    throw new BadRequestException('vendorEventId must be a non-empty string.');
  }

  if (!isNonEmptyString(candidate.ticketCode)) {
    throw new BadRequestException('ticketCode must be a non-empty string.');
  }
}

@Controller('fulfillment')
export class FulfillmentController {
  constructor(
    private readonly fulfillmentEventsService: FulfillmentEventsService,
  ) {}

  @Get('admin')
  @UseGuards(AdminApiSecretGuard)
  async listAdminOperations() {
    return {
      items: await this.fulfillmentEventsService.listAdminOperations(),
    };
  }

  @Post('manual-issued')
  @UseGuards(AdminApiSecretGuard)
  recordManualIssued(@Body() body: unknown) {
    assertManualIssuedRequest(body);

    return this.fulfillmentEventsService.recordManualIssued(body);
  }

  @Post('vendor-callback-issued')
  @UseGuards(VendorCallbackSecretGuard)
  recordVendorCallbackIssued(@Body() body: unknown) {
    assertVendorCallbackIssuedRequest(body);

    return this.fulfillmentEventsService.recordVendorCallbackIssued(body);
  }
}
