import { GameResult } from "./types";

// Shared global storage for completed game results
// This Map stores the full GameResult for each completed puzzle
// Key: puzzleId, Value: GameResult
export const completedGameResults = new Map<string, GameResult>();

// Helper function to get completion result for a puzzle
export const getCompletedResult = (puzzleId: string): GameResult | undefined => {
	return completedGameResults.get(puzzleId);
};

// Helper function to set completion result for a puzzle
export const setCompletedResult = (puzzleId: string, result: GameResult): void => {
	completedGameResults.set(puzzleId, result);
};

// Helper function to check if a puzzle is completed
export const isPuzzleCompleted = (puzzleId: string): boolean => {
	return completedGameResults.has(puzzleId);
};

