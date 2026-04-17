import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import {
  CurrentCustomer,
  type CurrentCustomerPrincipal,
} from '../../common/auth/current-customer.decorator';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';

import {
  CheckoutService,
  type CreateDraftOrderInput,
  type TicketType,
} from '../checkout/checkout.service';

import { OrdersService } from './orders.service';

const ALLOWED_TICKET_TYPES: TicketType[] = ['E_TICKET', 'PAPER_TICKET'];

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertCreateDraftOrderInput(
  body: unknown,
): asserts body is CreateDraftOrderInput {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Draft order payload is required.');
  }

  const candidate = body as Record<string, unknown>;

  if (!isNonEmptyString(candidate.tierId)) {
    throw new BadRequestException('tierId must be a non-empty string.');
  }

  if (
    !Array.isArray(candidate.viewerIds) ||
    candidate.viewerIds.length === 0 ||
    candidate.viewerIds.some((viewerId) => !isNonEmptyString(viewerId))
  ) {
    throw new BadRequestException(
      'viewerIds must be a non-empty array of non-empty strings.',
    );
  }

  if (
    !Number.isInteger(candidate.quantity) ||
    (candidate.quantity as number) <= 0
  ) {
    throw new BadRequestException('quantity must be a positive integer.');
  }

  if (candidate.viewerIds.length !== candidate.quantity) {
    throw new BadRequestException(
      'viewerIds length must match quantity for draft orders.',
    );
  }

  if (
    typeof candidate.ticketType !== 'string' ||
    !ALLOWED_TICKET_TYPES.includes(candidate.ticketType as TicketType)
  ) {
    throw new BadRequestException(
      'ticketType must be E_TICKET or PAPER_TICKET.',
    );
  }
}

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly checkoutService: CheckoutService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get('admin')
  @UseGuards(AdminApiSecretGuard)
  async listAdminOrders() {
    return {
      items: await this.ordersService.listAdminOrders(),
    };
  }

  @Get('my')
  @UseGuards(CustomerSessionGuard)
  async listMyOrders(@CurrentCustomer() customer: CurrentCustomerPrincipal) {
    return {
      items: await this.ordersService.listCustomerOrders(customer.id),
    };
  }

  @Get(':orderId')
  @UseGuards(CustomerSessionGuard)
  async getMyOrder(
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
    @Param('orderId') orderId: string,
  ) {
    return this.ordersService.getCustomerOrderDetail(customer.id, orderId);
  }

  @Post('draft')
  @UseGuards(CustomerSessionGuard)
  async createDraftOrder(
    @Body() body: unknown,
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
  ) {
    assertCreateDraftOrderInput(body);

    return this.checkoutService.createDraftOrder({
      ...(body as Omit<CreateDraftOrderInput, 'userId'>),
      userId: customer.id,
    });
  }
}
