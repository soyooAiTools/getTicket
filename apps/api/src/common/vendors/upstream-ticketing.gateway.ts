import { BadRequestException, Injectable } from '@nestjs/common';

type UpstreamResponse = {
  externalRef?: string;
  message?: string;
};

@Injectable()
export class UpstreamTicketingGateway {
  private buildHeaders() {
    const apiKey = process.env.VENDOR_API_KEY?.trim();

    if (!apiKey) {
      throw new BadRequestException(
        'Vendor upstream ticketing configuration is incomplete.',
      );
    }

    return {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    };
  }

  private getBaseUrl() {
    const baseUrl = process.env.VENDOR_API_BASE_URL?.trim();

    if (!baseUrl) {
      throw new BadRequestException(
        'Vendor upstream ticketing configuration is incomplete.',
      );
    }

    return baseUrl.replace(/\/+$/, '');
  }

  private async post<TBody extends Record<string, unknown>>(
    path: string,
    body: TBody,
  ): Promise<{ externalRef: string }> {
    const response = await fetch(`${this.getBaseUrl()}${path}`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(body),
    });

    const payload = (await response.json().catch(() => ({}))) as UpstreamResponse;

    if (!response.ok) {
      throw new BadRequestException(
        payload.message ?? 'Vendor upstream ticketing request failed.',
      );
    }

    if (!payload.externalRef?.trim()) {
      throw new BadRequestException(
        'Vendor upstream ticketing response is missing externalRef.',
      );
    }

    return {
      externalRef: payload.externalRef.trim(),
    };
  }

  submitOrder(input: { orderId: string }) {
    return this.post('/orders', input);
  }

  submitRefund(input: { amount: number; orderId: string; refundNo: string }) {
    return this.post('/refunds', input);
  }
}
