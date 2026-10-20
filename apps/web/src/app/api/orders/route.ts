import { saveOrder } from "@/app/sales/actions";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON order." }, { status: 400 });
  }

  const result = await saveOrder(body);
  if (result.error) {
    const status = /session|access|sign in|shop/i.test(result.error) ? 401 : 400;
    return NextResponse.json(result, { status });
  }
  return NextResponse.json(result, { status: 200 });
}
