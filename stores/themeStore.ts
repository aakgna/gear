import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Theme = "light" | "dark";

interface ThemeState {
	theme: Theme;
	toggleTheme: () => void;
	setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
	persist(
		(set) => ({
			theme: "light",
			toggleTheme: () =>
				set((state) => ({
					theme: state.theme === "light" ? "dark" : "light",
				})),
			setTheme: (theme: Theme) => set({ theme }),
		}),
		{
			name: "gear-theme-storage",
			storage: createJSONStorage(() => AsyncStorage),
		}
	)
);
