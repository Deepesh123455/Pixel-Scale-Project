export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly operational: boolean;
  public readonly errors?: any; // 👈 1. Class property define karo

  constructor(message: string, statusCode: number, errorDetails?: any) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype); // Restore prototype chain

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";
    this.operational = true; // Mark as trusted error
    this.errors = errorDetails; // 👈 2. Parameter ko property mein save karo

    Error.captureStackTrace(this, this.constructor);
  }
}
