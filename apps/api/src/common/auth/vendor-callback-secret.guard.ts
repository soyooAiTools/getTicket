import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class VendorCallbackSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const expectedSecret = process.env.VENDOR_CALLBACK_SECRET;
    const providedSecret = request.headers?.['x-vendor-callback-secret'];

    if (
      typeof expectedSecret !== 'string' ||
      expectedSecret.length === 0 ||
      typeof providedSecret !== 'string' ||
      providedSecret !== expectedSecret
    ) {
      throw new UnauthorizedException('Vendor callback secret is required.');
    }

    return true;
  }
}
