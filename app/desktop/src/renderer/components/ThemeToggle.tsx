import { Monitor, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUiPreferencesStore, type ThemePreference } from "../app/ui-preferences.store";

const options: ReadonlyArray<{ value: ThemePreference; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo hệ thống", icon: Monitor },
];

export function ThemeToggle() {
  const theme = useUiPreferencesStore((state) => state.theme);
  const setTheme = useUiPreferencesStore((state) => state.setTheme);
  const Current = options.find((option) => option.value === theme)?.icon ?? Moon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="nx-icon-button" aria-label="Đổi giao diện sáng/tối" title="Giao diện">
          <Current size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => setTheme(value as ThemePreference)}>
          {options.map(({ value, label }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
