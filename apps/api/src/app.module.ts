import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { CheckoutModule } from './modules/checkout/checkout.module';
import { FulfillmentModule } from './modules/fulfillment/fulfillment.module';
import { HealthModule } from './modules/health/health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { RefundsModule } from './modules/refunds/refunds.module';
import { RiskModule } from './modules/risk/risk.module';
import { ViewersModule } from './modules/viewers/viewers.module';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    ViewersModule,
    CatalogModule,
    CheckoutModule,
    FulfillmentModule,
    PaymentsModule,
    RefundsModule,
    RiskModule,
    NotificationsModule,
  ],
})
export class AppModule {}
