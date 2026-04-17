import { Module } from '@nestjs/common';

import { AdminApiSecretGuard } from '../../common/auth/admin-api-secret.guard';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, AdminApiSecretGuard],
  exports: [CatalogService],
})
export class CatalogModule {}
