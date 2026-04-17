import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';

import {
  CurrentCustomer,
  type CurrentCustomerPrincipal,
} from '../../common/auth/current-customer.decorator';
import { CustomerSessionGuard } from '../../common/auth/customer-session.guard';

import { ViewersService } from './viewers.service';

type CreateViewerBody = {
  name: string;
  idCard: string;
  mobile: string;
};

@UseGuards(CustomerSessionGuard)
@Controller('viewers')
export class ViewersController {
  constructor(private readonly viewersService: ViewersService) {}

  @Get()
  async list(@CurrentCustomer() customer: CurrentCustomerPrincipal) {
    return {
      items: await this.viewersService.listViewersByUserId(customer.id),
    };
  }

  @Post()
  async create(
    @Body() body: CreateViewerBody,
    @CurrentCustomer() customer: CurrentCustomerPrincipal,
  ) {
    if (!body || !this.isCreateViewerBody(body)) {
      throw new BadRequestException(
        'name, idCard, and mobile are required.',
      );
    }

    return this.viewersService.createViewer({
      userId: customer.id,
      name: body.name.trim(),
      idCard: body.idCard.trim(),
      mobile: body.mobile.trim(),
    });
  }

  private isCreateViewerBody(body: CreateViewerBody) {
    return (
      typeof body.name === 'string' &&
      body.name.trim().length > 0 &&
      typeof body.idCard === 'string' &&
      body.idCard.trim().length === 18 &&
      typeof body.mobile === 'string' &&
      /^1\d{10}$/.test(body.mobile.trim())
    );
  }
}
