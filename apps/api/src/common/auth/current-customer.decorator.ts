import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type CurrentCustomerPrincipal = {
  id: string;
  openId: string;
};

export const CurrentCustomer = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<{
      customer?: CurrentCustomerPrincipal;
    }>();

    return request.customer;
  },
);
