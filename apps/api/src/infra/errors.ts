import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public type: string,
    message: string,
    public extensions?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    super(404, 'not-found', id ? `${entity} '${id}' not found` : `${entity} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'conflict', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(403, 'forbidden', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'unauthorized', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, errors?: unknown[]) {
    super(422, 'validation', message, { errors });
  }
}

export class GateFailedError extends AppError {
  constructor(message: string, gateResult: unknown) {
    super(422, 'gate-failed', message, { gate_result: gateResult });
  }
}

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      type: `https://meridian.dev/errors/${error.type}`,
      title: error.type.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      status: error.statusCode,
      detail: error.message,
      ...(error.extensions || {}),
    });
  }

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(422).send({
      type: 'https://meridian.dev/errors/validation',
      title: 'Validation Error',
      status: 422,
      detail: error.errors.map((e) => e.message).join(', '),
      errors: error.errors,
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(422).send({
      type: 'https://meridian.dev/errors/validation',
      title: 'Validation Error',
      status: 422,
      detail: error.message,
      errors: error.validation,
    });
  }

  // Unknown errors
  request.log.error(error);
  return reply.status(500).send({
    type: 'https://meridian.dev/errors/internal',
    title: 'Internal Server Error',
    status: 500,
    detail: 'An unexpected error occurred',
  });
}
