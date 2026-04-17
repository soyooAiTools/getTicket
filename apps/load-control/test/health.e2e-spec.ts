import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('control');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns the load-control health payload', async () => {
    await request(app.getHttpServer())
      .get('/control/health')
      .expect(200)
      .expect({
        status: 'ok',
        service: 'ticketing-load-control',
      });
  });
});
