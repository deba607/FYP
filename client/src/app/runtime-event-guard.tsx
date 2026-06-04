export function RuntimeEventGuard() {
  const script = `
    (() => {
      if (window.__BMT_RAW_EVENT_GUARD_INSTALLED__) {
        return;
      }
      window.__BMT_RAW_EVENT_GUARD_INSTALLED__ = true;

      const isRawEvent = (value) => (
        typeof Event !== "undefined" &&
        value instanceof Event
      );

      const swallowRawEvent = (event) => {
        const raw = event && (
          event.reason ||
          event.error ||
          event.detail ||
          event
        );

        if (!isRawEvent(raw)) {
          return false;
        }

        console.warn("Ignored raw browser event runtime error:", raw.type || "unknown");
        try {
          const readableError = new Error("Ignored browser event: " + (raw.type || "unknown"));
          if ("reason" in event) {
            Object.defineProperty(event, "reason", { configurable: true, value: readableError });
          }
          if ("error" in event) {
            Object.defineProperty(event, "error", { configurable: true, value: readableError });
          }
        } catch (_) {}
        event.preventDefault?.();
        event.stopImmediatePropagation?.();
        return true;
      };

      window.addEventListener("unhandledrejection", (event) => {
        swallowRawEvent(event);
      }, true);

      window.addEventListener("error", (event) => {
        swallowRawEvent(event);
      }, true);

      const originalWindowAddEventListener = window.addEventListener.bind(window);
      window.addEventListener = (type, listener, options) => {
        if ((type === "error" || type === "unhandledrejection") && typeof listener === "function") {
          return originalWindowAddEventListener(type, (event) => {
            if (swallowRawEvent(event)) {
              return;
            }
            return listener.call(window, event);
          }, options);
        }

        return originalWindowAddEventListener(type, listener, options);
      };
    })();
  `;

  return <script id="bmt-raw-event-guard" dangerouslySetInnerHTML={{ __html: script }} />;
}
