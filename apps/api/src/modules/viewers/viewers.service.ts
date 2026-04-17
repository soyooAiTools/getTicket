import { Injectable } from '@nestjs/common';
import { createCipheriv, randomBytes } from 'crypto';

import { PrismaService } from '../../common/prisma/prisma.service';

type CreateViewerInput = {
  userId: string;
  name: string;
  idCard: string;
  mobile: string;
};

type ViewerRecord = {
  id: string;
  name: string;
  mobile: string;
};

const PUBLIC_VIEWER_SELECT = {
  id: true,
  mobile: true,
  name: true,
} as const;

@Injectable()
export class ViewersService {
  constructor(private readonly prisma: PrismaService) {}

  async createViewer({
    userId,
    name,
    idCard,
    mobile,
  }: CreateViewerInput): Promise<ViewerRecord> {
    return this.prisma.viewer.create({
      select: PUBLIC_VIEWER_SELECT,
      data: {
        idCardEncrypted: this.encryptIdCard(idCard),
        mobile,
        name,
        userId,
      },
    });
  }

  async listViewersByUserId(userId: string): Promise<ViewerRecord[]> {
    return this.prisma.viewer.findMany({
      select: PUBLIC_VIEWER_SELECT,
      orderBy: { createdAt: 'desc' },
      where: { userId },
    });
  }

  private encryptIdCard(idCard: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(
      'aes-256-gcm',
      Buffer.from(this.resolveEncryptionKey(), 'hex'),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(idCard, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [iv, authTag, encrypted]
      .map((segment) => segment.toString('base64'))
      .join('.');
  }

  private resolveEncryptionKey() {
    const encryptionKey =
      process.env.VIEWER_ID_CARD_KEY ?? process.env.PII_KEY;

    if (!encryptionKey || !/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
      throw new Error(
        'VIEWER_ID_CARD_KEY or PII_KEY must be set to a 64-character hex string.',
      );
    }

    return encryptionKey;
  }
}
