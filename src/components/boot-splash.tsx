import { Logo } from "@/components/ui";

/** Shown for the single frame before the on-device database is read. */
export function BootSplash() {
  return (
    <div className="grid min-h-screen place-items-center bg-paper">
      <div className="flex flex-col items-center gap-4">
        <Logo size={44} />
        <p className="text-[0.78rem] font-medium text-ink-faint">Opening your marking plan…</p>
      </div>
    </div>
  );
}
