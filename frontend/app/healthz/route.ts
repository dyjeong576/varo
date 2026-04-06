import { NextResponse } from "next/server";

export const dynamic = "force-static";

export function GET(): NextResponse {
  return NextResponse.json({
    status: "ok",
    service: "frontend",
  });
}
