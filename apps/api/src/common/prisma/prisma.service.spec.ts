import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  it('exposes Prisma lifecycle methods and delegates Nest hooks', async () => {
    const service = new PrismaService();
    const connectSpy = jest
      .spyOn(service, '$connect')
      .mockResolvedValue(undefined);
    const disconnectSpy = jest
      .spyOn(service, '$disconnect')
      .mockResolvedValue(undefined);

    expect(typeof service.$connect).toBe('function');
    expect(typeof service.$disconnect).toBe('function');

    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(connectSpy).toHaveBeenCalledTimes(1);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
