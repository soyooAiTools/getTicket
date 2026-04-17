import { BadRequestException } from '@nestjs/common';

import { ViewersController } from './viewers.controller';
import { ViewersService } from './viewers.service';

describe('ViewersController', () => {
  const viewersServiceMock = {
    createViewer: jest.fn(),
    listViewersByUserId: jest.fn(),
  } as unknown as ViewersService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists viewers for the authenticated customer', async () => {
    (viewersServiceMock.listViewersByUserId as jest.Mock).mockResolvedValue([
      { id: 'viewer_1', mobile: '13800138000', name: '寮犱笁' },
    ]);

    const controller = new ViewersController(viewersServiceMock);
    const result = await controller.list({ id: 'cust_123', openId: 'openid_abc' });

    expect(viewersServiceMock.listViewersByUserId).toHaveBeenCalledWith(
      'cust_123',
    );
    expect(result).toEqual({
      items: [{ id: 'viewer_1', mobile: '13800138000', name: '寮犱笁' }],
    });
  });

  it('creates a viewer for the authenticated customer', async () => {
    (viewersServiceMock.createViewer as jest.Mock).mockResolvedValue({
      id: 'viewer_2',
      mobile: '13800138001',
      name: '鏉庡洓',
    });

    const controller = new ViewersController(viewersServiceMock);
    const result = await controller.create(
      {
        idCard: '110101199001011234',
        mobile: '13800138001',
        name: '鏉庡洓',
      },
      { id: 'cust_123', openId: 'openid_abc' },
    );

    expect(viewersServiceMock.createViewer).toHaveBeenCalledWith({
      idCard: '110101199001011234',
      mobile: '13800138001',
      name: '鏉庡洓',
      userId: 'cust_123',
    });
    expect(result).toEqual({
      id: 'viewer_2',
      mobile: '13800138001',
      name: '鏉庡洓',
    });
  });

  it('rejects malformed create payloads', async () => {
    const controller = new ViewersController(viewersServiceMock);

    await expect(
      controller.create(
        {
          idCard: '',
          mobile: 'not-a-phone',
          name: '',
        },
        { id: 'cust_123', openId: 'openid_abc' },
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
