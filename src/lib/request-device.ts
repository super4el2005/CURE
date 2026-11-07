import { createIsomorphicFn } from "@tanstack/react-start";
import {
  getRequestHeader,
  getResponseHeader,
  setResponseHeader,
} from "@tanstack/react-start/server";

import { detectDevice, resolveClientDevice } from "@/src/lib/device";

export const getRequestDevice = createIsomorphicFn()
  .server(() => {
    const vary = getResponseHeader("Vary");
    setResponseHeader("Vary", [vary, "User-Agent", "Sec-CH-UA-Mobile"].filter(Boolean).join(", "));
    setResponseHeader("Cache-Control", "private, no-store");
    return detectDevice({
      userAgent: getRequestHeader("user-agent"),
      mobileHint: getRequestHeader("sec-ch-ua-mobile"),
    });
  })
  .client(() => {
    const browser = navigator as Navigator & { userAgentData?: { mobile: boolean } };
    return resolveClientDevice(document.documentElement.dataset.device, {
      userAgent: browser.userAgent,
      mobileHint:
        browser.userAgentData === undefined
          ? undefined
          : browser.userAgentData.mobile
            ? "?1"
            : "?0",
    });
  });
