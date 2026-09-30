import { Settings as SettingsIcon } from "lucide-react";

export default function PlatformSettings() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink dark:text-ink-dark tracking-tight">Settings</h1>
        <p className="text-sm text-muted dark:text-muted-dark mt-1">
          Platform-wide configuration.
        </p>
      </div>

      <div className="bg-card dark:bg-card-dark border border-border dark:border-border-dark rounded-xl2 py-14 text-center text-sm text-muted dark:text-muted-dark flex flex-col items-center gap-3 shadow-card">
        <SettingsIcon className="w-6 h-6 opacity-40" />
        Nothing configurable here yet — this is a placeholder for things like pricing plans,
        notification preferences, and platform-wide defaults once those exist.
      </div>
    </div>
  );
}
