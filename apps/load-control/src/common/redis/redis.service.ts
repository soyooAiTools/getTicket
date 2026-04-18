import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: Redis;

  constructor() {
    this.client = new Redis(
      process.env.REDIS_URL ?? 'redis://localhost:6379',
      { lazyConnect: true },
    );
  }

  async onModuleInit() {
    await this.client.connect();
  }

  async onModuleDestroy() {
    await this.client.quit();
  }

  async getJson<T>(key: string): Promise<T | null> {
    const value = await this.client.get(key);

    if (!value) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async setJson<T>(
    key: string,
    value: T,
    ttlSeconds?: number,
  ): Promise<void> {
    const payload = JSON.stringify(value);

    if (ttlSeconds) {
      await this.client.set(key, payload, 'EX', ttlSeconds);
      return;
    }

    await this.client.set(key, payload);
  }

  async delete(key: string): Promise<number> {
    return this.client.del(key);
  }
}
