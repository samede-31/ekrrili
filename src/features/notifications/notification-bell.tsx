"use client";

import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { markNotificationsRead } from "@/features/dashboard/dashboard-actions";
import { getLocalMarketplace, saveLocalMarketplace, type LocalMarketplaceState } from "@/features/listings/local-marketplace";

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export function NotificationBell({
  demoMode = false,
  initialNotifications = [],
}: {
  demoMode?: boolean;
  initialNotifications?: NotificationItem[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!demoMode) return;
    const refresh = () => {
      const marketplace = getLocalMarketplace();
      setNotifications((marketplace.notifications ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        createdAt: item.createdAt,
        read: item.read,
      })));
    };
    refresh();
    window.addEventListener("ekrrili-local-marketplace-change", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("ekrrili-local-marketplace-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [demoMode]);

  const unread = notifications.filter((item) => !item.read);
  const markRead = async () => {
    setError("");
    if (demoMode) {
      const state: LocalMarketplaceState = getLocalMarketplace();
      saveLocalMarketplace({
        ...state,
        notifications: (state.notifications ?? []).map((item) => ({ ...item, read: true })),
      });
      return;
    }
    const result = await markNotificationsRead(unread.map((item) => item.id));
    if (result.error) setError(result.error);
    else setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={`الإشعارات${unread.length ? `، ${unread.length} غير مقروء` : ""}`} aria-expanded={open} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-[#e2e8e3] text-[#52645a] hover:bg-[#f4f7f4]">
        <Bell size={18} />
        {unread.length > 0 && <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#c74738] px-1 text-[10px] font-bold text-white">{unread.length > 9 ? "9+" : unread.length}</span>}
      </button>
      {open && (
        <section dir="rtl" aria-label="الإشعارات" className="absolute end-0 top-12 z-[60] w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[#e2e8e3] bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-3">
            <h2 className="text-sm font-extrabold">الإشعارات</h2>
            {unread.length > 0 && <button type="button" onClick={() => void markRead()} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#176744]"><CheckCheck size={14} /> تعليم كمقروء</button>}
          </div>
          {error && <p role="alert" className="px-4 pt-3 text-xs text-red-700">{error}</p>}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? <p className="p-5 text-center text-xs text-[#849087]">لا توجد إشعارات جديدة.</p> : notifications.slice(0, 20).map((item) => (
              <article key={item.id} className={`border-b border-[#f0f3f0] px-4 py-3 ${item.read ? "bg-white" : "bg-[#f1f7f2]"}`}>
                <p className="text-xs font-bold">{item.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-[#69776e]">{item.body}</p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
