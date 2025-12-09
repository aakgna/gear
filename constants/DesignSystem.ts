/**
 * Design System for GEAR - Logic Puzzle App
 * Light theme inspired by TikTok with unique vibrant twist
 */

import { ViewStyle } from "react-native";
import { PuzzleType } from "../config/types";

// Color System - Light Theme (TikTok-inspired)
export const Colors = {
	// Primary Colors - Unique vibrant twist
	primary: "#161823", // Deep dark blue-gray for headers, icons, main text
	accent: "#FE2C55", // Vibrant pink-red (TikTok-inspired but unique)
	secondaryAccent: "#25F4EE", // Cyan for secondary actions, highlights
	error: "#FF3040", // Bright red for wrong answers or alerts

	// Background - Light Theme
	background: {
		primary: "#FFFFFF", // Pure white
		secondary: "#F8F8F8", // Light gray for sections
		tertiary: "#F2F2F2", // Slightly darker gray for cards
		gradient: ["#FFFFFF", "#F5F5F5"] as const, // Light gradient
	},

	// Text Colors - Light Theme
	text: {
		primary: "#161823", // Dark text (almost black)
		secondary: "#8E8E93", // Medium gray for secondary text
		disabled: "#C7C7CC", // Light gray for disabled text
		white: "#FFFFFF", // White text (for dark backgrounds)
		accent: "#FE2C55", // Accent color for highlights
	},

	// Game States
	game: {
		correct: "#00C896", // Green for correct answers
		incorrect: "#FF3040", // Red for incorrect
		present: "#FFD93D", // Yellow for "present" state (Wordle)
		absent: "#E5E5E5", // Light gray for absent
	},
};

// Typography
export const Typography = {
	fontFamily: {
		primary: "Inter", // Fallback to system font if not loaded
		monospace: "monospace",
	},
	fontSize: {
		h1: 32,
		h2: 24,
		h3: 20,
		body: 16,
		caption: 14,
		small: 12,
	},
	fontWeight: {
		bold: "700" as const,
		semiBold: "600" as const,
		medium: "500" as const,
		regular: "400" as const,
	},
	lineHeight: {
		tight: 1.2,
		normal: 1.5,
		relaxed: 1.75,
	},
};

// Spacing System (8px multiples)
export const Spacing = {
	xxxxs: 0,
	xxxs: 1,
	xxs: 2,
	xs: 4,
	sm: 8,
	md: 16,
	lg: 24,
	xl: 32,
	xxl: 48,
};

// Border Radius
export const BorderRadius = {
	sm: 12,
	md: 16,
	lg: 20,
	xl: 24,
	pill: 9999,
};

// Shadows - Light theme with subtle depth
export const Shadows: {
	light: ViewStyle;
	medium: ViewStyle;
	heavy: ViewStyle;
	glow: ViewStyle;
} = {
	light: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.08,
		shadowRadius: 3,
		elevation: 2, // Android
	},
	medium: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.12,
		shadowRadius: 8,
		elevation: 4,
	},
	heavy: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.16,
		shadowRadius: 16,
		elevation: 8,
	},
	glow: {
		shadowColor: Colors.accent,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 6,
	},
};

// Animation Timing
export const Animation = {
	duration: {
		fast: 150,
		normal: 300,
		slow: 500,
	},
	easing: "cubic-bezier(0.4, 0, 0.2, 1)", // iOS feel
};

// Component Styles - Light Theme
export const ComponentStyles: {
	puzzleCard: ViewStyle;
	button: ViewStyle;
	input: ViewStyle;
	progressBar: ViewStyle;
	card: ViewStyle;
} = {
	// Puzzle Card
	puzzleCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.md,
		borderWidth: 0,
		borderColor: "transparent",
		...Shadows.medium,
	},

	// Button
	button: {
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		minHeight: 44, // Accessibility minimum
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},

	// Input
	input: {
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: "#E5E5E5",
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		backgroundColor: Colors.background.primary,
	},

	// Progress Bar
	progressBar: {
		height: 3,
		backgroundColor: Colors.secondaryAccent,
		borderRadius: BorderRadius.pill,
	},

	// Card
	card: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 0,
		borderColor: "transparent",
		...Shadows.light,
	},
};

// Layout Constants
export const Layout = {
	margin: Spacing.md, // 16px
	padding: Spacing.md, // 16px
	verticalRhythm: Spacing.sm, // 8px multiples
	tapTarget: 44, // Minimum tap target size
};

// Game-Specific Color Themes
// Each game gets a unique color to create visual distinction and variety
export const GameColors: Record<PuzzleType, string> = {
	wordle: "#3B82F6", // Vibrant blue
	sudoku: "#8B5CF6", // Deep purple
	riddle: "#F59E0B", // Orange
	trivia: "#14B8A6", // Teal
	quickMath: "#EF4444", // Red
	wordChain: "#10B981", // Green
	alias: "#EC4899", // Pink
	futoshiki: "#6366F1", // Indigo
	magicSquare: "#06B6D4", // Cyan
	hidato: "#F59E0B", // Amber
	sequencing: "#8B5CF6", // Violet
	mastermind: "#F43F5E", // Rose
	zip: "#10B981", // Emerald
};

/**
 * Get the game-specific accent color for a given puzzle type
 * @param gameType - The type of puzzle/game
 * @returns The unique color for that game type
 */
export const getGameColor = (gameType: PuzzleType): string => {
	return GameColors[gameType] || Colors.accent; // Fallback to default accent if type not found
};
