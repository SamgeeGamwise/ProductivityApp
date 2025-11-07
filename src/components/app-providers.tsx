"use client";

import { UiSettingsProvider } from "@/context/ui-settings";
import { useVirtualKeyboard } from "@/hooks/useVirtualKeyboard";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useVirtualKeyboard();
  return <UiSettingsProvider>{children}</UiSettingsProvider>;
}
