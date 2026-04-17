import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminApiSecretGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers?: Record<string, string | string[] | undefined>;
    }>();
    const expectedSecret = process.env.ADMIN_API_SECRET;
    const providedSecret = request.headers?.['x-admin-secret'];

    if (
      typeof expectedSecret !== 'string' ||
      expectedSecret.length === 0 ||
      typeof providedSecret !== 'string' ||
      providedSecret !== expectedSecret
    ) {
      throw new UnauthorizedException('Admin API secret is required.');
    }

    return true;
  }
}
