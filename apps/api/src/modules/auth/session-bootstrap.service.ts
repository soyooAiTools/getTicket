import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SessionBootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrapSession(accountKey: string) {
    const customer = await this.findOrCreateCustomer(accountKey);

    const token = randomBytes(24).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.prisma.customerSession.create({
      data: {
        customerId: customer.id,
        expiresAt,
        tokenHash,
      },
    });

    return {
      token,
      customer: {
        id: customer.id,
        accountKey: customer.accountKey,
      },
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async findOrCreateCustomer(accountKey: string) {
    try {
      return await this.prisma.customerAccount.upsert({
        where: { accountKey },
        update: {},
        create: { accountKey },
        select: { accountKey: true, id: true },
      });
    } catch (error) {
      if (!this.isAccountKeyConflict(error)) {
        throw error;
      }

      return this.prisma.customerAccount.findUniqueOrThrow({
        where: { accountKey },
        select: { accountKey: true, id: true },
      });
    }
  }

  private isAccountKeyConflict(error: unknown): boolean {
    if (typeof error !== 'object' || error === null) {
      return false;
    }

    const candidate = error as {
      code?: unknown;
      meta?: {
        target?: unknown;
      };
    };

    if (candidate.code !== 'P2002') {
      return false;
    }

    const target = candidate.meta?.target;

    if (target === undefined) {
      return true;
    }

    if (Array.isArray(target)) {
      return target.includes('accountKey');
    }

    return target === 'accountKey';
  }
}
