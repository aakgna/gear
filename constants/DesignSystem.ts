/**
 * Design System for ThinkTok - Logic Puzzle App
 * Vibrant & Energetic theme with modern visual effects
 */

import { ViewStyle } from "react-native";
import { PuzzleType } from "../config/types";

// Color System - Vibrant & Energetic Theme
export const Colors = {
	background: {
		primary: "#fefdfb",        // Lighter warm cream background (top) - was #faf8f5
		secondary: "#faf8f5",      // Lighter warm cream background (bottom) - was #f5f1ea
		tertiary: "#fffcf9",       // Card backgrounds (keep as is - already very light)
		quaternary: "#ffffff",     // Game preview section (keep as is - white)
		gradient: ["#fefdfb", "#faf8f5"] as const, // Updated lighter gradient
		outerGradient: ["#fefdfb", "#faf8f5", "#f5f1ea"] as const, // Lighter outer gradient
	},


	// Required for compatibility
	primary: "#44403c",          // For game text
	accent: "#fcd34d",           // Main accent (maps to accent.primary)
	secondaryAccent: "#fde68a",  // Secondary accent (maps to accent.secondary)
	error: "#ef4444",            // Error color (red for wrong answers)

	text: {
		primary: "#44403c",        // Dark warm brown
		secondary: "#78716c",      // Medium warm brown
		accent: "#fcd34d",         // Golden yellow
		inactive: "#a8a29e",       // Light warm brown
		disabled: "#a8a29e",       // Used in games
		white: "#44403c",          // Used in buttons/games
	},

	// Required for game states
	game: {
		correct: "#10b981",        // Green for correct answers
		incorrect: "#ef4444",      // Red for incorrect
		present: "#fbbf24",        // Yellow for "present" (Wordle)
		absent: "#d6d3d1",         // Warm gray for absent
	},

	borders: {
		primary: "#d6d3d1",        // Warm stone border
		subtle: "#e7e5e4",         // Lighter warm stone
	},

	// Keep singular border for backward compatibility
	border: "#d6d3d1",

	overlay: {
		card: "rgba(255, 252, 249, 0.9)",
		preview: "rgba(250, 248, 245, 0.5)",
		stats: "rgba(250, 248, 245, 0.9)",
	}
};

// Typography - Enhanced for better readability and hierarchy
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
	letterSpacing: {
		tight: -0.5,
		normal: 0,
		wide: 0.5,
		wideUppercase: 1.2, // For uppercase labels
	},
};

// Spacing System (8px multiples) - Optimized for better breathing room
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
	// Additional spacing for better vertical rhythm
	cardPadding: 20, // Increased from 16px for cards
	buttonPadding: 18, // Better padding for buttons
	sectionGap: 32, // Gap between major sections
};

// Border Radius
export const BorderRadius = {
	sm: 12,
	md: 16,
	lg: 20,
	xl: 24,
	pill: 9999,
};

// Shadows - Enhanced depth with colored tints and glow effects
export const Shadows: {
	light: ViewStyle;
	medium: ViewStyle;
	heavy: ViewStyle;
	glow: ViewStyle;
	glowAccent: ViewStyle;
	glowSecondary: ViewStyle;
	colored: (color: string) => ViewStyle;
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
	glowAccent: {
		shadowColor: Colors.accent,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.5,
		shadowRadius: 16,
		elevation: 8,
	},
	glowSecondary: {
		shadowColor: Colors.secondaryAccent,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.4,
		shadowRadius: 12,
		elevation: 6,
	},
	colored: (color: string): ViewStyle => ({
		shadowColor: color,
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 8,
		elevation: 4,
	}),
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

// Gradient Utilities
export const Gradients = {
	primary: [Colors.accent, Colors.background.primary] as const,
	secondary: [Colors.secondaryAccent, "#00A8CC"] as const,
	accent: [Colors.accent, Colors.secondaryAccent] as const,
	background: Colors.background.gradient,
	button: [Colors.accent, Colors.background.primary] as const,
	buttonSecondary: [Colors.secondaryAccent, "#00A8CC"] as const,
};

// Component Styles - Enhanced with better spacing
export const ComponentStyles: {
	puzzleCard: ViewStyle;
	button: ViewStyle;
	input: ViewStyle;
	progressBar: ViewStyle;
	card: ViewStyle;
} = {
	// Puzzle Card - Increased padding
	puzzleCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.cardPadding,
		borderWidth: 0,
		borderColor: "transparent",
		...Shadows.medium,
	},

	// Button - Enhanced with better padding
	button: {
		backgroundColor: Colors.accent,
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.buttonPadding,
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
		borderColor: Colors.border,
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

	// Card - Enhanced spacing
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
	cardPadding: Spacing.cardPadding, // 20px for cards
	buttonPadding: Spacing.buttonPadding, // 18px for buttons
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
