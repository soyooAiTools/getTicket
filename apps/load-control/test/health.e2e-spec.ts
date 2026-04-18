import { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createLoadControlE2eApp } from './e2e-app';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createLoadControlE2eApp();
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
