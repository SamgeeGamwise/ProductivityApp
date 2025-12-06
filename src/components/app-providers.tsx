"use client";

import { UiSettingsProvider } from "@/context/ui-settings";
import { ErrorLogProvider } from "@/context/error-log";
import { OnScreenKeyboard } from "./on-screen-keyboard";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UiSettingsProvider>
      <ErrorLogProvider>
        {children}
        <OnScreenKeyboard />
      </ErrorLogProvider>
    </UiSettingsProvider>
  );
}
