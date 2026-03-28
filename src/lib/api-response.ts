import { NextResponse } from "next/server";

/**
 * 統一APIレスポンスヘルパー
 */
export function apiError(
  message: string,
  status = 400,
  headers?: HeadersInit,
) {
  return NextResponse.json({ data: null, error: message }, { status, headers });
}
