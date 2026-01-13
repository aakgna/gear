import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Game Builder Types
export type GameTemplate = {
	id: string;
	name: string;
	type: string;
	category: "grid" | "path" | "word" | "logic" | "math" | "custom";
	icon: string;
	description: string;
	defaultConfig: Record<string, any>;
};

export type GameComponent = {
	id: string;
	type: string;
	label: string;
	position: { x: number; y: number };
	size: { width: number; height: number };
	properties: Record<string, any>;
	required: boolean;
};

export type GameRule = {
	id: string;
	type: string;
	targetComponentId: string;
	params: Record<string, any>;
	errorMessage?: string;
};

export type GameSolution = {
	type: string;
	data: any;
	givens?: Array<{ row: number; col: number; value: any }>;
};

export interface GameBuilderState {
	currentStep: number;
	gameTemplate: GameTemplate | null;
	gameConfig: {
		title: string;
		description: string;
		difficulty: "easy" | "medium" | "hard";
	};
	components: GameComponent[];
	rules: GameRule[];
	solution: GameSolution | null;
	previewMode: boolean;
	// Navigation
	goToStep: (step: number) => void;
	nextStep: () => void;
	previousStep: () => void;
	// Game building
	setGameTemplate: (template: GameTemplate | null) => void;
	updateGameConfig: (config: Partial<GameBuilderState["gameConfig"]>) => void;
	addComponent: (component: GameComponent) => void;
	updateComponent: (id: string, updates: Partial<GameComponent>) => void;
	deleteComponent: (id: string) => void;
	addRule: (rule: GameRule) => void;
	updateRule: (id: string, updates: Partial<GameRule>) => void;
	deleteRule: (id: string) => void;
	setSolution: (solution: GameSolution | null) => void;
	setPreviewMode: (mode: boolean) => void;
	reset: () => void;
}

const TOTAL_STEPS = 7;

export const useGameBuilderStore = create<GameBuilderState>()(
	persist(
		(set, get) => ({
			// Initial state
			currentStep: 0,
			gameTemplate: null,
			gameConfig: {
				title: "",
				description: "",
				difficulty: "easy",
			},
			components: [],
			rules: [],
			solution: null,
			previewMode: false,

			// Navigation
			goToStep: (step: number) => {
				if (step >= 0 && step < TOTAL_STEPS) {
					set({ currentStep: step });
				}
			},

			nextStep: () => {
				const { currentStep } = get();
				if (currentStep < TOTAL_STEPS - 1) {
					set({ currentStep: currentStep + 1 });
				}
			},

			previousStep: () => {
				const { currentStep } = get();
				if (currentStep > 0) {
					set({ currentStep: currentStep - 1 });
				}
			},

			// Game building
			setGameTemplate: (template) => set({ gameTemplate: template }),

			updateGameConfig: (config) =>
				set((state) => ({
					gameConfig: { ...state.gameConfig, ...config },
				})),

			addComponent: (component) =>
				set((state) => ({
					components: [...state.components, component],
				})),

			updateComponent: (id, updates) =>
				set((state) => ({
					components: state.components.map((comp) =>
						comp.id === id ? { ...comp, ...updates } : comp
					),
				})),

			deleteComponent: (id) =>
				set((state) => ({
					components: state.components.filter((comp) => comp.id !== id),
					rules: state.rules.filter((rule) => rule.targetComponentId !== id),
				})),

			addRule: (rule) =>
				set((state) => ({
					rules: [...state.rules, rule],
				})),

			updateRule: (id, updates) =>
				set((state) => ({
					rules: state.rules.map((rule) =>
						rule.id === id ? { ...rule, ...updates } : rule
					),
				})),

			deleteRule: (id) =>
				set((state) => ({
					rules: state.rules.filter((rule) => rule.id !== id),
				})),

			setSolution: (solution) => set({ solution }),

			setPreviewMode: (mode) => set({ previewMode: mode }),

			reset: () =>
				set({
					currentStep: 0,
					gameTemplate: null,
					gameConfig: {
						title: "",
						description: "",
						difficulty: "easy",
					},
					components: [],
					rules: [],
					solution: null,
					previewMode: false,
				}),
		}),
		{
			name: "game-builder-store",
			storage: createJSONStorage(() => AsyncStorage),
		}
	)
);
