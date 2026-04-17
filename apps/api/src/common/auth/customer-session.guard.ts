import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';

import { PrismaService } from '../prisma/prisma.service';

import { type CurrentCustomerPrincipal } from './current-customer.decorator';

@Injectable()
export class CustomerSessionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      customer?: CurrentCustomerPrincipal;
      headers?: { authorization?: string | string[] };
    }>();
    const authorizationHeader = request.headers?.authorization;
    const bearerToken = this.extractBearerToken(authorizationHeader);

    if (!bearerToken) {
      throw new UnauthorizedException('Authorization bearer token is required.');
    }

    const tokenHash = createHash('sha256').update(bearerToken).digest('hex');
    const session = await this.prisma.customerSession.findFirst({
      include: {
        customer: {
          select: {
            id: true,
            wechatOpenId: true,
          },
        },
      },
      where: {
        expiresAt: {
          gt: new Date(),
        },
        tokenHash,
      },
    });

    if (!session?.customer) {
      throw new UnauthorizedException('Customer session is invalid or expired.');
    }

    request.customer = {
      id: session.customer.id,
      openId: session.customer.wechatOpenId,
    };

    return true;
  }

  private extractBearerToken(authorizationHeader?: string | string[]) {
    const value = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (typeof value !== 'string') {
      return null;
    }

    const match = value.trim().match(/^Bearer\s+(.+)$/i);

    return match?.[1]?.trim() ?? null;
  }
}
