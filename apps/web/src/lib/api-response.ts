import { NextResponse } from "next/server";

interface ApiError {
  code: string;
  message: string;
}

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data }, { status });
}

export function err(code: string, message: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message } satisfies ApiError },
    { status },
  );
}

export function paginated<T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): NextResponse {
  return NextResponse.json({
    success: true,
    data: {
      items,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
    },
  });
}
