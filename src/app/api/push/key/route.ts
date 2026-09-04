import { getVapidKeys } from "@/lib/push";

export const dynamic = "force-dynamic";

/** Public VAPID key for pushManager.subscribe(). */
export async function GET() {
  const keys = await getVapidKeys();
  if (!keys) return Response.json({ error: "push not configured" }, { status: 503 });
  return Response.json({ publicKey: keys.publicKey });
}
