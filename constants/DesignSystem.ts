/**
 * Design System for GEAR - Logic Puzzle App
 * Clean, minimal, modern UI with cognitive minimalism principles
 */

import { ViewStyle } from "react-native";

// Color System
export const Colors = {
	// Primary Colors
	primary: "#2B2D42", // Deep indigo for headers, icons, main text
	accent: "#3A86FF", // Electric blue for buttons, highlights, success
	secondaryAccent: "#FFBE0B", // Soft yellow for progress, hover, streaks
	error: "#FF4D6D", // Coral red for wrong answers or alerts

	// Background
	background: {
		primary: "#FFFFFF", // White
		secondary: "#F7F8FA", // Light gray
		gradient: ["#F7F8FA", "#FFFFFF"], // Gradient from light to white
	},

	// Text Colors
	text: {
		primary: "#1C1C1E", // Primary text
		secondary: "#7A7A7A", // Secondary text
		disabled: "#C4C4C4", // Disabled text
		white: "#FFFFFF", // White text for dark backgrounds
	},

	// Game States
	game: {
		correct: "#3A86FF", // Blue for correct answers
		incorrect: "#FF4D6D", // Red for incorrect
		present: "#FFBE0B", // Yellow for "present" state (Wordle)
		absent: "#7A7A7A", // Gray for absent
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

// Shadows
export const Shadows: {
	light: ViewStyle;
	medium: ViewStyle;
} = {
	light: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.05,
		shadowRadius: 8,
		elevation: 2, // Android
	},
	medium: {
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.1,
		shadowRadius: 12,
		elevation: 4,
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

// Component Styles
export const ComponentStyles: {
	puzzleCard: ViewStyle;
	button: ViewStyle;
	input: ViewStyle;
	progressBar: ViewStyle;
} = {
	// Puzzle Card
	puzzleCard: {
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		padding: Spacing.md,
		...Shadows.light,
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
		backgroundColor: Colors.background.primary,
	},

	// Progress Bar
	progressBar: {
		height: 2,
		backgroundColor: Colors.secondaryAccent,
		borderRadius: BorderRadius.pill,
	},
};

// Layout Constants
export const Layout = {
	margin: Spacing.md, // 16px
	padding: Spacing.md, // 16px
	verticalRhythm: Spacing.sm, // 8px multiples
	tapTarget: 44, // Minimum tap target size
};
