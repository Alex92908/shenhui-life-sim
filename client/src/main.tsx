import { spaceQueryClient } from "@hatch/space-sdk/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { Component, StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { App, LS_KEY } from "./App";
import { AdminPage } from "./Admin";
import { World2App } from "./world2/World2App";
import { installErrorReporting, reportCrash } from "./analytics";
import "./theme.css";

// The game is a full-window app: a trackpad pinch (ctrl+wheel in Chrome /
// Edge / Firefox, gesture events in Safari) must not magnify the page — the
// visual zoom pushes the header, search bar and side panels off screen with
// no obvious way back (only ⌘0). The map handles pinch itself; keyboard
// zoom (⌘+ / ⌘−) keeps working for anyone who wants bigger text.
window.addEventListener("wheel", (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
for (const t of ["gesturestart", "gesturechange"]) document.addEventListener(t, (e) => e.preventDefault(), { passive: false });

installErrorReporting();
/* 运营后台：网址后面加 #admin 打开（需要服务器上设置的 ADMIN_TOKEN） */
const isAdminPage = window.location.hash === "#admin";
/* 2.0 深圳切片：网址后面加 #world2 打开（Stage 1，不动 1.0 启动页） */
const isWorld2 = window.location.hash === "#world2";

const rootEl = document.querySelector<HTMLElement>("[data-generated-space-root]");
if (!rootEl) {
  throw new Error("missing generated space root element");
}

// Last-resort safety net: any render/effect crash (a stale local save, a
// WebGL failure inside the Mac app's webview, …) used to unmount the whole
// tree and leave a permanent fully-white panel with no way out. The boundary
// turns that into a readable recovery screen: reload, or clear the local
// save and start over. Server-side multiplayer data is untouched either way.
class RootErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error): void {
    reportCrash(error);
  }
  override render() {
    if (!this.state.failed) return this.props.children;
    const clearAndReload = () => {
      try {
        localStorage.removeItem(LS_KEY);
      } catch { /* storage unavailable */ }
      window.location.reload();
    };
    return (
      <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#faf6ef", color: "#1a1512", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p style={{ fontSize: 40, margin: "0 0 8px" }}>🧭</p>
          <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>页面打开时出了点问题</h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#6f6455", margin: "0 0 20px" }}>
            多半是这台设备里存着一份旧版本留下的存档，和现在的游戏对不上号。先点「重新打开」试一次；还不行就清掉本地存档重新开始——联机排行榜和城市数据在服务器上，不受影响。
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button type="button" onClick={() => window.location.reload()} style={{ padding: "10px 18px", borderRadius: 12, border: "2px solid #1a1512", background: "#e63a1f", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              重新打开
            </button>
            <button type="button" onClick={clearAndReload} style={{ padding: "10px 18px", borderRadius: 12, border: "2px solid #1a1512", background: "#fffdf8", color: "#1a1512", fontWeight: 700, cursor: "pointer" }}>
              清除本地存档并重新开始
            </button>
          </div>
        </div>
      </div>
    );
  }
}

// If you edit this file: keep `<QueryClientProvider client={spaceQueryClient}>`
// wrapping the app (every space shares the SDK's QueryClient), and keep
// BOTH the `hatch-space-root` class AND the `data-hatch-space-root`
// attribute on the outer div. The SDK styles select on
// `.hatch-space-root[data-hatch-space-root]` to apply mobile safe-area
// insets (notches, gesture bars, etc.), correct viewport sizing, and the
// hosting header/chrome offsets — dropping either breaks layout silently.
createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={spaceQueryClient}>
      <div className="hatch-space-root" data-hatch-space-root>
        <RootErrorBoundary>
          {isAdminPage ? <AdminPage /> : isWorld2 ? <World2App /> : <App />}
        </RootErrorBoundary>
      </div>
    </QueryClientProvider>
  </StrictMode>,
);
