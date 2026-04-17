import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
  Logger,
} from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
    }>();
    const startedAt = Date.now();
    const response = context.switchToHttp().getResponse<{
      statusCode?: number;
    }>();

    const logRequest = (outcome: 'SUCCESS' | 'FAILED', statusCode: number) => {
      const path = request.originalUrl ?? request.url ?? '';
      const method = request.method ?? 'UNKNOWN';

      this.logger.log(
        `${method} ${path} outcome=${outcome} status=${statusCode} durationMs=${Date.now() - startedAt}`,
      );
    };

    return next.handle().pipe(
      tap(() => {
        logRequest('SUCCESS', response.statusCode ?? 200);
      }),
      catchError((error: unknown) => {
        const statusCode =
          error instanceof HttpException
            ? error.getStatus()
            : response.statusCode && response.statusCode >= 400
              ? response.statusCode
              : 500;

        logRequest('FAILED', statusCode);

        return throwError(() => error);
      }),
    );
  }
}
