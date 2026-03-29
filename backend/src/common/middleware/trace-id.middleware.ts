import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

@Injectable()
export class TraceIdMiddleware implements NestMiddleware {
  use(req: Request & { traceId?: string }, res: Response, next: NextFunction): void {
    const traceId = req.header("x-trace-id") ?? randomUUID();

    req.traceId = traceId;
    res.setHeader("x-trace-id", traceId);

    next();
  }
}
