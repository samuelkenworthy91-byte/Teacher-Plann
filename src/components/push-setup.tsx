"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCircle2, Smartphone, XCircle } from "lucide-react";
import { removePushSubscriptionAction, savePushSubscriptionAction, sendTestPushAction } from "@/actions/push";
import { Spinner } from "@/components/ui";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type Status = "unknown" | "enabled" | "disabled" | "unsupported";

export function PushSetup({ publicKey, deviceCount }: { publicKey: string | null; deviceCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<Status>("unknown");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState(deviceCount);

  const probe = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setStatus(
        sub && Notification.permission === "granted" ? "enabled" : "disabled",
      );
    } catch {
      setStatus("disabled");
    }
  }, []);

  useEffect(() => {
    // Sync React state with the browser's push state (an external system).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void probe();
  }, [probe]);

  async function enable() {
    setError(null);
    setMessage(null);
    if (!publicKey) {
      setError("The server has no VAPID keys configured yet (set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notifications were blocked for this site — allow them in your browser settings and try again.");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }));
      const json = sub.toJSON();
      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint as string,
        keys: json.keys as { p256dh: string; auth: string },
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save the subscription.");
        return;
      }
      setStatus("enabled");
      setDevices((n) => n + 1);
      setMessage("This device will now get marking nudges.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Could not enable notifications.");
    }
  }

  async function disable() {
    setError(null);
    setMessage(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await removePushSubscriptionAction(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("disabled");
      setDevices((n) => Math.max(0, n - 1));
      setMessage("Notifications off for this device.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message || "Could not disable.");
    }
  }

  function test() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await sendTestPushAction();
      if (res.ok) setMessage("Sent — check your notifications.");
      else setError(res.error ?? "No device received it.");
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pen-soft text-pen">
          <BellRing size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[0.86rem] font-bold leading-snug text-ink">Push notifications</p>
          <p className="mt-0.5 text-[0.76rem] leading-relaxed text-ink-soft">
            One quiet nudge each morning with today&apos;s collections and marking pace — plus a
            heads-up when a pile is running late. Nothing buzzes mid-lesson.
          </p>
        </div>
        <span
          className={`chip !border-0 ${
            status === "enabled"
              ? "!bg-good-soft !text-good"
              : status === "unsupported"
                ? "!bg-warn-soft !text-warn"
                : "!bg-ink/5 !text-ink-soft"
          }`}
        >
          {status === "enabled" ? "On" : status === "unsupported" ? "N/A" : "Off"}
        </span>
      </div>

      {status === "unsupported" ? (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-[0.78rem] leading-relaxed text-warn">
          This browser doesn&apos;t support web push. On iPhone/iPad you need iOS 16.4+ and the app
          added to your Home Screen first (Share → Add to Home Screen).
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {status === "enabled" ? (
            <button type="button" className="btn btn-ghost" onClick={disable} disabled={pending}>
              <XCircle size={14} /> Turn off on this device
            </button>
          ) : (
            <button type="button" className="btn btn-pen" onClick={enable} disabled={pending}>
              <BellRing size={14} /> Enable on this device
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={test}
            disabled={pending || devices === 0}
            title={devices === 0 ? "Enable a device first" : "Send a test notification"}
          >
            {pending ? <Spinner /> : <CheckCircle2 size={14} />} Send test
          </button>
          <span className="flex items-center gap-1.5 text-[0.74rem] font-semibold text-ink-faint">
            <Smartphone size={13} />
            {devices === 0 ? "no devices yet" : `${devices} device${devices === 1 ? "" : "s"} subscribed`}
          </span>
        </div>
      )}

      {message ? (
        <p className="pop rounded-xl bg-good-soft px-4 py-3 text-[0.8rem] font-medium text-good">{message}</p>
      ) : null}
      {error ? (
        <p className="pop rounded-xl bg-bad-soft px-4 py-3 text-[0.8rem] font-medium text-bad">{error}</p>
      ) : null}
    </div>
  );
}
