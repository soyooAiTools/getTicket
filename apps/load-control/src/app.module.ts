import { Module } from '@nestjs/common';

import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { ControlModule } from './modules/control/control.module';
import { HealthModule } from './modules/health/health.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ScenariosModule } from './modules/scenarios/scenarios.module';
import { ValidationModule } from './modules/validation/validation.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    HealthModule,
    ScenariosModule,
    ValidationModule,
    ControlModule,
    ReportsModule,
  ],
})
export class AppModule {}
