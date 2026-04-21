import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import { ZodError } from 'zod';

type JsonResponse = {
  status(code: number): JsonResponse;
  json(body: unknown): void;
};

@Catch(ZodError)
export class ZodValidationFilter implements ExceptionFilter<ZodError> {
  catch(exception: ZodError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<JsonResponse>();
    const messages = exception.issues.map((issue) => issue.message);

    response.status(400).json({
      statusCode: 400,
      error: 'Bad Request',
      message: messages.length === 1 ? messages[0] : messages,
    });
  }
}
