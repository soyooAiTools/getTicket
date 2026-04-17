import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

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

  @Post('manual-issued')
  recordManualIssued(@Body() body: unknown) {
    assertManualIssuedRequest(body);

    return this.fulfillmentEventsService.recordManualIssued(body);
  }

  @Post('vendor-callback-issued')
  recordVendorCallbackIssued(@Body() body: unknown) {
    assertVendorCallbackIssuedRequest(body);

    return this.fulfillmentEventsService.recordVendorCallbackIssued(body);
  }
}
