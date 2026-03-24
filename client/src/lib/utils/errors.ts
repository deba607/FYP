export class ApiError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function toErrorMessage(error: unknown, fallback = 'Unexpected server error') {
  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}
