import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger
} from "@nestjs/common";
import { ZodError } from "zod";

export function buildHttpExceptionResponse(exception: unknown, path: string) {
  if (exception instanceof ZodError) {
    return {
      statusCode: HttpStatus.BAD_REQUEST,
      body: {
        statusCode: HttpStatus.BAD_REQUEST,
        error: "Bad Request",
        message: "Validation failed.",
        details: exception.flatten(),
        path,
        timestamp: new Date().toISOString()
      }
    };
  }

  if (exception instanceof HttpException) {
    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    const responseBody =
      typeof payload === "string"
        ? { message: payload }
        : payload && typeof payload === "object"
          ? payload
          : { message: exception.message };

    return {
      statusCode,
      body: {
        statusCode,
        error: HttpStatus[statusCode] ?? "Error",
        path,
        timestamp: new Date().toISOString(),
        ...responseBody
      }
    };
  }

  const error = exception instanceof Error ? exception : new Error("Unknown server error.");

  return {
    statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    body: {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: "Internal Server Error",
      message: error.message,
      path,
      timestamp: new Date().toISOString()
    },
    error
  };
}

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalHttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse();
    const request = context.getRequest();
    const result = buildHttpExceptionResponse(exception, request.url);

    if (result.error != null) {
      this.logger.error(result.error.message, result.error.stack);
    }

    response.status(result.statusCode).json(result.body);
  }
}
