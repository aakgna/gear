import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GameResult, UserProfile } from "../config/types";

interface GameStore {
	// User data
	userProfile: UserProfile | null;
	isAuthenticated: boolean;

	// Game progress
	completedPuzzles: GameResult[];
	currentPuzzleIndex: number;

	// Actions
	setUserProfile: (profile: UserProfile | null) => void;
	setAuthenticated: (authenticated: boolean) => void;
	addCompletedPuzzle: (result: GameResult) => void;
	setCurrentPuzzleIndex: (index: number) => void;
	resetProgress: () => void;

	// Computed stats
	getTotalPuzzlesSolved: () => number;
	getAverageSolveTime: () => number;
	getCurrentStreak: () => number;
}

export const useGameStore = create<GameStore>()(
	persist(
		(set, get) => ({
			// Initial state
			userProfile: null,
			isAuthenticated: false,
			completedPuzzles: [],
			currentPuzzleIndex: 0,

			// Actions
			setUserProfile: (profile) => set({ userProfile: profile }),

			setAuthenticated: (authenticated) =>
				set({ isAuthenticated: authenticated }),

			addCompletedPuzzle: (result) =>
				set((state) => ({
					completedPuzzles: [...state.completedPuzzles, result],
					userProfile: state.userProfile
						? {
								...state.userProfile,
								puzzlesSolved: state.userProfile.puzzlesSolved + 1,
								lastActive: new Date().toISOString(),
								averageSolveTime: calculateAverageTime([
									...state.completedPuzzles,
									result,
								]),
						  }
						: null,
				})),

			setCurrentPuzzleIndex: (index) => set({ currentPuzzleIndex: index }),

			resetProgress: () =>
				set({
					completedPuzzles: [],
					currentPuzzleIndex: 0,
				}),

			// Computed stats
			getTotalPuzzlesSolved: () => get().completedPuzzles.length,

			getAverageSolveTime: () => {
				const puzzles = get().completedPuzzles;
				if (puzzles.length === 0) return 0;

				const totalTime = puzzles.reduce(
					(sum, puzzle) => sum + puzzle.timeTaken,
					0
				);
				return Math.round(totalTime / puzzles.length);
			},

			getCurrentStreak: () => {
				const puzzles = get().completedPuzzles;
				if (puzzles.length === 0) return 0;

				// Sort by completion date (most recent first)
				const sortedPuzzles = [...puzzles].sort(
					(a, b) =>
						new Date(b.completedAt).getTime() -
						new Date(a.completedAt).getTime()
				);

				let streak = 0;
				const today = new Date();
				today.setHours(0, 0, 0, 0);

				// Check consecutive days
				for (let i = 0; i < sortedPuzzles.length; i++) {
					const puzzleDate = new Date(sortedPuzzles[i].completedAt);
					puzzleDate.setHours(0, 0, 0, 0);

					const daysDiff = Math.floor(
						(today.getTime() - puzzleDate.getTime()) / (1000 * 60 * 60 * 24)
					);

					if (daysDiff === streak) {
						streak++;
					} else {
						break;
					}
				}

				return streak;
			},
		}),
		{
			name: "game-store",
			storage: createJSONStorage(() => AsyncStorage),
			// Only persist these fields
			partialize: (state) => ({
				userProfile: state.userProfile,
				isAuthenticated: state.isAuthenticated,
				completedPuzzles: state.completedPuzzles,
				currentPuzzleIndex: state.currentPuzzleIndex,
			}),
		}
	)
);

// Helper function to calculate average solve time
function calculateAverageTime(puzzles: GameResult[]): number {
	if (puzzles.length === 0) return 0;
	const totalTime = puzzles.reduce((sum, puzzle) => sum + puzzle.timeTaken, 0);
	return Math.round(totalTime / puzzles.length);
}
