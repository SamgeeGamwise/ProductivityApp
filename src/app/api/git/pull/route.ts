import { NextResponse } from "next/server";

export const dynamic = "force-static";

const DISABLED_MESSAGE =
  "git pull is not available in static deployments. Use your Git provider or hosting pipeline to publish updates.";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: DISABLED_MESSAGE,
    },
    { status: 405 }
  );
}

export async function GET() {
  return NextResponse.json({
    success: false,
    error: DISABLED_MESSAGE,
  });
}
