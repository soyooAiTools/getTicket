import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';

import {
  eventOperationsUpdateSchema,
} from '../../../../../packages/contracts/src';
import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('admin/events')
  @UseGuards(AdminApiSecretGuard)
  async listAdminEvents() {
    return {
      items: await this.catalogService.listAdminEvents(),
    };
  }

  @Get('events')
  async listEvents() {
    return {
      items: await this.catalogService.listPublishedEvents(),
    };
  }

  @Get('events/:eventId')
  async getEventDetail(@Param('eventId') eventId: string) {
    return this.catalogService.getEventDetail(eventId);
  }

  @Patch('admin/events/:eventId')
  @UseGuards(AdminApiSecretGuard)
  async updateEventOperations(
    @Param('eventId') eventId: string,
    @Body() body: unknown,
  ) {
    const parsedBody = eventOperationsUpdateSchema.safeParse(body);

    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.issues[0]?.message);
    }

    return this.catalogService.updateEventOperations(eventId, parsedBody.data);
  }
}
