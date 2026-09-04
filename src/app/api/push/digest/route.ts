import { sendDailyDigests } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Daily digest sender. Point a cron job at this endpoint (any time before
 * the school morning) and every subscribed teacher gets one push with
 * today's collections and marking pace:
 *
 *   curl -X POST https://your-host/api/push/digest -H "Authorization: Bearer $CRON_SECRET"
 *
 * If CRON_SECRET is not set the endpoint is open (fine for LAN/preview,
 * set it for public deployments). Safe to call repeatedly — each user
 * gets at most one digest per day.
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    const url = new URL(request.url);
    const provided = auth.replace(/^Bearer\s+/i, "") || url.searchParams.get("secret") || "";
    if (provided !== secret) {
      return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }
  try {
    const result = await sendDailyDigests();
    return Response.json({ ok: true, ...result, at: new Date().toISOString() });
  } catch (err) {
    console.error("[digest] failed:", err);
    return Response.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
