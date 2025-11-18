"use client";

import { UiSettingsProvider } from "@/context/ui-settings";
import { ErrorLogProvider } from "@/context/error-log";
import { useVirtualKeyboard } from "@/hooks/useVirtualKeyboard";

export function AppProviders({ children }: { children: React.ReactNode }) {
  useVirtualKeyboard();
  return (
    <UiSettingsProvider>
      <ErrorLogProvider>{children}</ErrorLogProvider>
    </UiSettingsProvider>
  );
}
