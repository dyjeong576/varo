import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequest, RequestActor } from "../types/authenticated-request";

export const CurrentActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestActor | undefined => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    return request.currentActor;
  },
);
