/**
 * Design System for GEAR - Logic Puzzle App
 * Clean, minimal, modern UI with cognitive minimalism principles
 */

import { ViewStyle } from "react-native";

// Color System - Dark Theme
export const Colors = {
	// Primary Colors
	primary: "#E8EAF6", // Light indigo for headers, icons, main text
	accent: "#00D4AA", // Vibrant teal for buttons, highlights, success
	secondaryAccent: "#FFD54F", // Golden yellow for progress, hover, streaks
	error: "#FF5252", // Bright red for wrong answers or alerts

	// Background - Dark Theme
	background: {
		primary: "#121212", // Deep black
		secondary: "#1E1E1E", // Dark gray
		tertiary: "#2C2C2C", // Medium dark gray for cards
		gradient: ["#1A1A2E", "#16213E"] as const, // Dark gradient
	},

	// Text Colors - Dark Theme
	text: {
		primary: "#FFFFFF", // Primary text (white)
		secondary: "#B0B0B0", // Secondary text (light gray)
		disabled: "#666666", // Disabled text (medium gray)
		white: "#FFFFFF", // White text
		accent: "#00D4AA", // Accent color for highlights
	},

	// Game States
	game: {
		correct: "#4CAF50", // Green for correct answers
		incorrect: "#FF5252", // Red for incorrect
		present: "#FFD54F", // Yellow for "present" state (Wordle)
		absent: "#424242", // Dark gray for absent
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

// Shadows - Enhanced for dark theme
export const Shadows: {
	light: ViewStyle;
	medium: ViewStyle;
	heavy: ViewStyle;
	glow: ViewStyle;
} = {
	light: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.3,
		shadowRadius: 4,
		elevation: 3, // Android
	},
	medium: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.4,
		shadowRadius: 8,
		elevation: 6,
	},
	heavy: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 8 },
		shadowOpacity: 0.5,
		shadowRadius: 16,
		elevation: 10,
	},
	glow: {
		shadowColor: Colors.accent,
		shadowOffset: { width: 0, height: 0 },
		shadowOpacity: 0.6,
		shadowRadius: 12,
		elevation: 8,
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

// Component Styles - Dark Theme
export const ComponentStyles: {
	puzzleCard: ViewStyle;
	button: ViewStyle;
	input: ViewStyle;
	progressBar: ViewStyle;
	card: ViewStyle;
} = {
	// Puzzle Card
	puzzleCard: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.md,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.1)",
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
		borderColor: Colors.text.disabled,
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.md,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		backgroundColor: Colors.background.tertiary,
	},

	// Progress Bar
	progressBar: {
		height: 3,
		backgroundColor: Colors.secondaryAccent,
		borderRadius: BorderRadius.pill,
	},

	// Card
	card: {
		backgroundColor: Colors.background.tertiary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		borderWidth: 1,
		borderColor: "rgba(255, 255, 255, 0.08)",
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
