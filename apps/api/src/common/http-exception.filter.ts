import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { ZodError } from "zod";

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();

    if (exception instanceof ZodError) {
      response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: "Bad Request",
        message: "Validation failed.",
        details: exception.flatten(),
        path: request.url,
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const payload = exception.getResponse();

      response.status(statusCode).json({
        statusCode,
        error: HttpStatus[statusCode] ?? "Error",
        message:
          typeof payload === "string"
            ? payload
            : (payload as { message?: string }).message ?? exception.message,
        path: request.url,
        timestamp: new Date().toISOString()
      });
      return;
    }

    const error = exception instanceof Error ? exception : new Error("Unknown server error.");
    this.logger.error(error.message, error.stack);

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: error.message,
      path: request.url,
      timestamp: new Date().toISOString()
    });
  }
}

