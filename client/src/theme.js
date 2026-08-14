import { useEffect, useState } from "react";

/**
 * Theme handling — mirrors the vanilla pages:
 * stores "theme" in localStorage and toggles the `dark` class on <html>.
 */
export function useTheme() {
  const [dark, setDark] = useState(
    () => (localStorage.getItem("theme") || "light") === "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const toggleTheme = () => {
    setDark((d) => {
      localStorage.setItem("theme", d ? "light" : "dark");
      return !d;
    });
  };

  return { dark, toggleTheme };
}
