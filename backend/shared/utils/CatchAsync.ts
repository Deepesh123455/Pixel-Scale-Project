import { Request, Response, NextFunction } from 'express';

// Define the type for the async controller function
type AsyncFunction = (req: Request, res: Response, next: NextFunction) => Promise<any>;

export const catchAsync = (fn: AsyncFunction) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};