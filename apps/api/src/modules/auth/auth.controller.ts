import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';

import { SessionBootstrapService } from './session-bootstrap.service';

type SessionBootstrapBody = {
  accountKey?: string;
  displayName?: string;
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly sessionBootstrapService: SessionBootstrapService,
  ) {}

  @Post('session/bootstrap')
  bootstrapSession(
    @Headers('x-load-test-secret') providedSecret: string | undefined,
    @Body() body: SessionBootstrapBody,
  ) {
    if (
      typeof process.env.LOAD_TEST_INTERNAL_SECRET !== 'string' ||
      process.env.LOAD_TEST_INTERNAL_SECRET.length === 0 ||
      providedSecret !== process.env.LOAD_TEST_INTERNAL_SECRET
    ) {
      throw new UnauthorizedException(
        'Load-test bootstrap secret is required.',
      );
    }

    if (
      !body ||
      typeof body.accountKey !== 'string' ||
      body.accountKey.trim().length === 0
    ) {
      throw new BadRequestException('accountKey is required.');
    }

    return this.sessionBootstrapService.bootstrapSession(body.accountKey.trim());
  }
}
