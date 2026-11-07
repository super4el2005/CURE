export type Device = "desktop" | "mobile";

type DeviceSignals = {
  userAgent?: string | undefined;
  mobileHint?: string | undefined;
};

// Device class, not viewport size. Tablets use the mobile application too.
export function detectDevice({ userAgent = "", mobileHint }: DeviceSignals): Device {
  if (mobileHint === "?1") return "mobile";
  if (/iPad|Tablet|Kindle|Silk|PlayBook|Android(?!.*Mobile)/i.test(userAgent)) return "mobile";
  if (mobileHint === "?0") return "desktop";
  return /Mobi|iPhone|iPod|Android|Windows Phone/i.test(userAgent) ? "mobile" : "desktop";
}

export function resolveClientDevice(
  serverDevice: string | undefined,
  signals: DeviceSignals,
): Device {
  // Keep the server's choice during hydration and subsequent navigation.
  if (serverDevice === "mobile" || serverDevice === "desktop") return serverDevice;
  return detectDevice(signals);
}
