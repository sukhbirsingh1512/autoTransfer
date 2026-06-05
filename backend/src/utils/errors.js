export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'ERR_GENERIC') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const badRequest = (m, code = 'BAD_REQUEST') => new AppError(m, 400, code);
export const unauthorized = (m = 'Unauthorized', code = 'UNAUTHORIZED') => new AppError(m, 401, code);
export const forbidden = (m = 'Forbidden', code = 'FORBIDDEN') => new AppError(m, 403, code);
export const notFound = (m = 'Not found', code = 'NOT_FOUND') => new AppError(m, 404, code);
export const conflict = (m, code = 'CONFLICT') => new AppError(m, 409, code);

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
