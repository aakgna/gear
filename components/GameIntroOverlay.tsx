import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
	Animated,
	Dimensions,
	Modal,
	TouchableWithoutFeedback,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PuzzleType } from "../config/types";
import {
	gameInstructions,
	getDifficultyLabel,
	getDifficultyColor,
} from "../config/gameInstructions";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	getGameColor,
	Animation,
} from "../constants/DesignSystem";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Animation component for each game type
const GameIntroAnimation: React.FC<{
	gameType: PuzzleType;
	gameColor: string;
}> = ({ gameType, gameColor }) => {
	const anims = useRef<Animated.Value[]>([]).current;

	useEffect(() => {
		// Initialize animations based on game type
		const animationCount = getAnimationCount(gameType);
		for (let i = 0; i < animationCount; i++) {
			if (!anims[i]) {
				anims[i] = new Animated.Value(0);
			}
		}

		// Start animations
		const animations = createAnimations(gameType, anims, gameColor);
		Animated.loop(Animated.parallel(animations)).start();

		return () => {
			animations.forEach((anim) => anim.stop());
		};
	}, [gameType, gameColor]);

	return (
		<View style={styles.animationContainer}>
			{renderAnimation(gameType, anims, gameColor)}
		</View>
	);
};

const getAnimationCount = (gameType: PuzzleType): number => {
	switch (gameType) {
		case "wordform":
			return 6;
		case "sudoku":
			return 9;
		case "riddle":
			return 3;
		case "trivia":
			return 4;
		case "quickMath":
			return 6;
		case "wordChain":
			return 4;
		case "inference":
			return 5;
		case "futoshiki":
			return 6;
		case "magicSquare":
			return 9;
		case "trailfinder":
			return 8;
		case "sequencing":
			return 5;
		case "codebreaker":
			return 6;
		case "maze":
			return 7;
		default:
			return 4;
	}
};

const createAnimations = (
	gameType: PuzzleType,
	anims: Animated.Value[],
	gameColor: string
): Animated.CompositeAnimation[] => {
	const animations: Animated.CompositeAnimation[] = [];

	anims.forEach((anim, index) => {
		const delay = index * 150;
		const duration = 3000 + Math.random() * 2000;

		animations.push(
			Animated.sequence([
				Animated.delay(delay),
				Animated.loop(
					Animated.sequence([
						Animated.timing(anim, {
							toValue: 1,
							duration,
							useNativeDriver: true,
						}),
						Animated.timing(anim, {
							toValue: 0,
							duration,
							useNativeDriver: true,
						}),
					])
				),
			])
		);
	});

	return animations;
};

const renderAnimation = (
	gameType: PuzzleType,
	anims: Animated.Value[],
	gameColor: string
): React.ReactNode => {
	switch (gameType) {
		case "wordform":
			return renderWordFormAnimation(anims, gameColor);
		case "sudoku":
			return renderSudokuAnimation(anims, gameColor);
		case "riddle":
			return renderRiddleAnimation(anims, gameColor);
		case "trivia":
			return renderTriviaAnimation(anims, gameColor);
		case "quickMath":
			return renderQuickMathAnimation(anims, gameColor);
		case "wordChain":
			return renderWordChainAnimation(anims, gameColor);
		case "inference":
			return renderInferenceAnimation(anims, gameColor);
		case "futoshiki":
			return renderFutoshikiAnimation(anims, gameColor);
		case "magicSquare":
			return renderMagicSquareAnimation(anims, gameColor);
		case "trailfinder":
			return renderTrailFinderAnimation(anims, gameColor);
		case "sequencing":
			return renderSequencingAnimation(anims, gameColor);
		case "codebreaker":
			return renderCodeBreakerAnimation(anims, gameColor);
		case "maze":
			return renderMazeAnimation(anims, gameColor);
		default:
			return null;
	}
};

// WordForm: Floating letter tiles
const renderWordFormAnimation = (anims: Animated.Value[], gameColor: string) => {
	const letters = ["W", "O", "R", "D", "L", "E"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.3 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.15 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.6 },
	];

	return letters.map((letter, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const rotate =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: ["0deg", "15deg", "0deg"],
			}) || "0deg";
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [1, 1.15, 1],
			}) || 1;

		return (
			<Animated.View
				key={i}
				style={[
					styles.wordleTile,
					{
						left: startPositions[i].x - 20,
						top: startPositions[i].y,
						backgroundColor: gameColor + "50",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { rotate }, { scale }],
					},
				]}
			>
				<Text style={[styles.wordFormLetter, { color: gameColor }]}>
					{letter}
				</Text>
			</Animated.View>
		);
	});
};

// Sudoku: Grid cells filling with numbers
const renderSudokuAnimation = (anims: Animated.Value[], gameColor: string) => {
	const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9];
	const gridSize = 3;
	const cellSize = 30;
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.35 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.35 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.35 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.75 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.75 },
	];

	return numbers.map((num, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const opacity = anims[i] || new Animated.Value(0);
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0.5, 1],
			}) || 0.5;

		return (
			<Animated.View
				key={i}
				style={[
					styles.sudokuCell,
					{
						left: startPositions[i].x,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						opacity,
						transform: [{ translateX }, { translateY }, { scale }],
					},
				]}
			>
				<Text style={[styles.sudokuNumber, { color: gameColor }]}>{num}</Text>
			</Animated.View>
		);
	});
};

// Riddle: Question marks pulsing
const renderRiddleAnimation = (anims: Animated.Value[], gameColor: string) => {
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.1 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
	];

	return startPositions.map((startPos, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [1, 1.4, 1],
			}) || 1;
		const opacity =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.6, 1, 0.6],
			}) || 0.6;

		return (
			<Animated.View
				key={i}
				style={[
					styles.riddleMark,
					{
						left: startPositions[i].x - 20,
						top: startPositions[i].y,
						transform: [{ translateX }, { translateY }, { scale }],
						opacity,
					},
				]}
			>
				<Text style={[styles.riddleText, { color: gameColor }]}>?</Text>
			</Animated.View>
		);
	});
};

// Trivia: Quiz cards flipping
const renderTriviaAnimation = (anims: Animated.Value[], gameColor: string) => {
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.65 },
	];

	return startPositions.map((startPos, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const rotate =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: ["0deg", "180deg", "360deg"],
			}) || "0deg";
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [1, 1.3, 1],
			}) || 1;

		return (
			<Animated.View
				key={i}
				style={[
					styles.triviaCard,
					{
						left: startPositions[i].x - 25,
						top: startPositions[i].y,
						backgroundColor: gameColor + "70",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { rotate }, { scale }],
					},
				]}
			>
				<Text style={[styles.triviaIcon, { color: gameColor }]}>★</Text>
			</Animated.View>
		);
	});
};

// QuickMath: Numbers floating and equations
const renderQuickMathAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const equations = ["2+2", "3×3", "5-1", "8÷2", "4+4", "6×2"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.3 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.35 },
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.75 },
	];

	return equations.map((eq, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const opacity =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.5, 1, 0.5],
			}) || 0.5;

		return (
			<Animated.View
				key={i}
				style={[
					styles.mathEquation,
					{
						left: startPositions[i].x - 30,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }],
						opacity,
					},
				]}
			>
				<Text style={[styles.mathText, { color: gameColor }]}>{eq}</Text>
			</Animated.View>
		);
	});
};

// WordChain: Words chaining together
const renderWordChainAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const words = ["CAT", "TAP", "PAN", "NET"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.35, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.65, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.2 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.65 },
	];

	return words.map((word, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.8, 1.3, 0.8],
			}) || 0.8;

		return (
			<Animated.View
				key={i}
				style={[
					styles.wordChainItem,
					{
						left: startPositions[i].x - 35,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { scale }],
					},
				]}
			>
				<Text style={[styles.wordChainText, { color: gameColor }]}>{word}</Text>
				{i < words.length - 1 && (
					<Text style={[styles.chainArrow, { color: gameColor }]}>→</Text>
				)}
			</Animated.View>
		);
	});
};

// Inference: Words appearing and connecting
const renderInferenceAnimation = (anims: Animated.Value[], gameColor: string) => {
	const words = ["WORD", "MEAN", "GUESS", "CLUE", "HINT"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.3 },
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.75 },
	];

	return words.map((word, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const opacity =
			anims[i]?.interpolate({
				inputRange: [0, 0.3, 0.7, 1],
				outputRange: [0, 1, 1, 0],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.3, 0.7, 1],
				outputRange: [0.5, 1.2, 1, 0.5],
			}) || 0.5;

		return (
			<Animated.View
				key={i}
				style={[
					styles.aliasWord,
					{
						left: startPositions[i].x - 40,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						opacity,
						transform: [{ translateX }, { translateY }, { scale }],
					},
				]}
			>
				<Text style={[styles.inferenceText, { color: gameColor }]}>{word}</Text>
			</Animated.View>
		);
	});
};

// Futoshiki: Grid with inequality symbols
const renderFutoshikiAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const cells = [1, 2, 3, 4, 5, 6];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.3 },
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.75 },
		{ x: SCREEN_WIDTH * 0.6, y: SCREEN_HEIGHT * 0.65 },
	];

	return cells.map((num, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.8, 1.2, 0.8],
			}) || 0.8;
		const rotate =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: ["0deg", "360deg"],
			}) || "0deg";

		return (
			<Animated.View
				key={i}
				style={[
					styles.futoshikiCell,
					{
						left: startPositions[i].x - 20,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { scale }, { rotate }],
					},
				]}
			>
				<Text style={[styles.futoshikiNumber, { color: gameColor }]}>
					{num}
				</Text>
			</Animated.View>
		);
	});
};

// MagicSquare: Numbers arranging in square
const renderMagicSquareAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const numbers = [2, 7, 6, 9, 5, 1, 4, 3, 8];
	const gridSize = 3;
	const cellSize = 28;
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.05 },
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.35 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.35 },
		{ x: SCREEN_WIDTH * 0.45, y: SCREEN_HEIGHT * 0.35 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.55, y: SCREEN_HEIGHT * 0.75 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.75 },
	];

	return numbers.map((num, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const opacity = anims[i] || new Animated.Value(0);
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, 1],
			}) || 0;

		return (
			<Animated.View
				key={i}
				style={[
					styles.magicSquareCell,
					{
						left: startPositions[i].x,
						top: startPositions[i].y,
						backgroundColor: gameColor + "65",
						borderColor: gameColor,
						opacity,
						transform: [{ translateX }, { translateY }, { scale }],
					},
				]}
			>
				<Text style={[styles.magicSquareNumber, { color: gameColor }]}>
					{num}
				</Text>
			</Animated.View>
		);
	});
};

// TrailFinder: Path connecting numbers
const renderTrailFinderAnimation = (anims: Animated.Value[], gameColor: string) => {
	const path = [1, 2, 3, 4, 5, 6, 7, 8];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.6, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.7, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.6, y: SCREEN_HEIGHT * 0.75 },
		{ x: SCREEN_WIDTH * 0.85, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.7 },
	];

	return path.map((num, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.7, 1.3, 0.7],
			}) || 0.7;
		const opacity =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.5, 1, 0.5],
			}) || 0.5;

		return (
			<Animated.View
				key={i}
				style={[
					styles.hidatoCell,
					{
						left: startPositions[i].x - 18,
						top: startPositions[i].y,
						backgroundColor: gameColor + "65",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { scale }],
						opacity,
					},
				]}
			>
				<Text style={[styles.trailFinderNumber, { color: gameColor }]}>{num}</Text>
			</Animated.View>
		);
	});
};

// Sequencing: Items sliding into sequence
const renderSequencingAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const items = ["1st", "2nd", "3rd", "4th", "5th"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.2 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.1 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.3 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.25 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.75 },
	];

	return items.map((item, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.8, 1.2, 0.8],
			}) || 0.8;

		return (
			<Animated.View
				key={i}
				style={[
					styles.sequencingItem,
					{
						left: startPositions[i].x - 30,
						top: startPositions[i].y,
						backgroundColor: gameColor + "60",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { scale }],
					},
				]}
			>
				<Text style={[styles.sequencingText, { color: gameColor }]}>
					{item}
				</Text>
			</Animated.View>
		);
	});
};

// CodeBreaker: Color pegs appearing
const renderCodeBreakerAnimation = (
	anims: Animated.Value[],
	gameColor: string
) => {
	const colors = ["🔴", "🔵", "🟢", "🟡", "🟠", "🟣"];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.25, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.5, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.75, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.2 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.75 },
	];

	return colors.map((color, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.3, 0.7, 1],
				outputRange: [0, 1.4, 1, 0.8],
			}) || 0;
		const rotate =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: ["0deg", "360deg"],
			}) || "0deg";

		return (
			<Animated.View
				key={i}
				style={[
					styles.mastermindPeg,
					{
						left: startPositions[i].x - 20,
						top: startPositions[i].y,
						transform: [{ translateX }, { translateY }, { scale }, { rotate }],
					},
				]}
			>
				<Text style={styles.codeBreakerEmoji}>{color}</Text>
			</Animated.View>
		);
	});
};

// Maze: Path connecting cells
const renderMazeAnimation = (anims: Animated.Value[], gameColor: string) => {
	const cells = [1, 2, 3, 4, 5, 6, 7];
	const startPositions = [
		{ x: SCREEN_WIDTH * 0.05, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.6, y: SCREEN_HEIGHT * 0.15 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.08 },
		{ x: SCREEN_WIDTH * 0.3, y: SCREEN_HEIGHT * 0.25 },
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.2 },
	];
	const endPositions = [
		{ x: SCREEN_WIDTH * 0.9, y: SCREEN_HEIGHT * 0.6 },
		{ x: SCREEN_WIDTH * 0.1, y: SCREEN_HEIGHT * 0.55 },
		{ x: SCREEN_WIDTH * 0.2, y: SCREEN_HEIGHT * 0.7 },
		{ x: SCREEN_WIDTH * 0.8, y: SCREEN_HEIGHT * 0.5 },
		{ x: SCREEN_WIDTH * 0.4, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.95, y: SCREEN_HEIGHT * 0.65 },
		{ x: SCREEN_WIDTH * 0.15, y: SCREEN_HEIGHT * 0.75 },
	];

	return cells.map((num, i) => {
		const translateX =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].x - startPositions[i].x],
			}) || 0;
		const translateY =
			anims[i]?.interpolate({
				inputRange: [0, 1],
				outputRange: [0, endPositions[i].y - startPositions[i].y],
			}) || 0;
		const scale =
			anims[i]?.interpolate({
				inputRange: [0, 0.5, 1],
				outputRange: [0.6, 1.3, 0.6],
			}) || 0.6;
		const opacity =
			anims[i]?.interpolate({
				inputRange: [0, 0.3, 0.7, 1],
				outputRange: [0.4, 1, 1, 0.4],
			}) || 0.4;

		return (
			<Animated.View
				key={i}
				style={[
					styles.zipCell,
					{
						left: startPositions[i].x - 20,
						top: startPositions[i].y,
						backgroundColor: gameColor + "65",
						borderColor: gameColor,
						transform: [{ translateX }, { translateY }, { scale }],
						opacity,
					},
				]}
			>
				<Text style={[styles.zipNumber, { color: gameColor }]}>{num}</Text>
			</Animated.View>
		);
	});
};

interface GameIntroScreenProps {
	gameType: PuzzleType;
	difficulty: number;
	username?: string;
	onPlay: () => void;
}

const GameIntroScreen: React.FC<GameIntroScreenProps> = ({
	gameType,
	difficulty,
	username,
	onPlay,
}) => {
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const [showInstructions, setShowInstructions] = useState(false);
	const rotateAnim = useRef(new Animated.Value(0)).current;
	const heightAnim = useRef(new Animated.Value(0)).current;
	const pulseAnim = useRef(new Animated.Value(1)).current;
	const buttonScale = useRef(new Animated.Value(1)).current;


	const instructions = gameInstructions[gameType] || {
		instructions: ["Complete the puzzle to win!"],
		example: "Follow the on-screen instructions.",
	};
	const difficultyLabel = getDifficultyLabel(difficulty);
	const difficultyColor = getDifficultyColor(difficulty);
	const gameColor = getGameColor(gameType); // Get game-specific color

	const formatGameType = (type: PuzzleType): string => {
		const formatted = type
			.replace(/([A-Z])/g, " $1")
			.replace(/^./, (str) => str.toUpperCase())
			.trim();

		const specialCases: Record<string, string> = {
			quickMath: "Quick Math",
			wordChain: "Word Chain",
			magicSquare: "Magic Square",
			wordform: "WordForm",
			trailfinder: "TrailFinder",
			maze: "Maze",
			codebreaker: "CodeBreaker",
			inference: "Inference",
		};

		return specialCases[type] || formatted;
	};

	useEffect(() => { //useeffect to animate the how to play button
		Animated.parallel([
			Animated.timing(rotateAnim, {
				toValue: showInstructions ? 1 : 0,
				duration: Animation.duration.normal,
				useNativeDriver: true,
			}),
			Animated.timing(heightAnim, {
				toValue: showInstructions ? 1 : 0,
				duration: Animation.duration.normal,
				useNativeDriver: false,
			}),
		]).start();
	}, [showInstructions]);

	useEffect(() => { //useeffect to pulse the play button
		Animated.loop(
			Animated.sequence([
				Animated.timing(pulseAnim, {
					toValue: 1.05,
					duration: 2000,
					useNativeDriver: true,
				}),
				Animated.timing(pulseAnim, {
					toValue: 1,
					duration: 2000,
					useNativeDriver: true,
				}),
			])
		).start();
	}, []);

	return (
		<View style={styles.container}>
			{/* Animated Background */}
			<GameIntroAnimation gameType={gameType} gameColor={gameColor} />

			<ScrollView
				style={styles.scrollView}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
				bounces={true}
			>
				{/* Game Title */}
				<View style={styles.titleSection}>
				<Animated.View
					style={[
						styles.difficultyBadge,
						{
							backgroundColor: difficultyColor + "20",
							borderColor: difficultyColor,
							transform: [{ scale: pulseAnim }],
						},
					]}
				>
					<Text style={[styles.difficultyText, { color: difficultyColor }]}>
						{difficultyLabel}
					</Text>
				</Animated.View>
					<Text style={styles.gameTitle}>{formatGameType(gameType)}</Text>
					{username && (
						<TouchableOpacity
							onPress={() => router.push(`/user/${username}`)}
							activeOpacity={0.7}
						>
							<Text style={styles.createdByText}>created by {username}</Text>
						</TouchableOpacity>
					)}
				</View>

				{/* How to Play Section */}
				<TouchableOpacity
					style={[styles.howToPlayButton, { borderColor: gameColor + "40" }]}
					onPress={() => setShowInstructions(!showInstructions)}
					activeOpacity={0.7}
				>
					<View style={styles.howToPlayHeader}>
						<Ionicons name="help-circle-outline" size={22} color={gameColor} />
						<Text style={styles.howToPlayText}>How to Play</Text>
						<Animated.View 
							style={{ 
								transform: [{ rotate: rotateAnim.interpolate({
									inputRange: [0, 1],
									outputRange: ['0deg', '180deg'],
								}) }],
							}}
						>
							<Ionicons
								name="chevron-down"
								size={20}
								color={Colors.text.secondary}
								style={styles.chevronIcon}
							/>
						</Animated.View>
					</View>
				</TouchableOpacity>

								{/* Instructions Content */}
								<Animated.View
					style={[
						styles.instructionsContainer,
						{
							maxHeight: heightAnim.interpolate({
								inputRange: [0, 1],
								outputRange: [0, 1000],
							}),
							opacity: heightAnim,
							overflow: 'hidden',
						},
					]}
				>
					<View style={styles.instructionsContent}>
						{instructions.instructions.map((instruction, index) => (
							<View key={index} style={styles.instructionItem}>
								<View
									style={[
										styles.instructionNumber,
										{ backgroundColor: gameColor + "30" },
									]}
								>
									<Text
										style={[
											styles.instructionNumberText,
											{ color: gameColor },
										]}
									>
										{index + 1}
									</Text>
								</View>
								<Text style={styles.instructionText}>{instruction}</Text>
							</View>
						))}
						<View
							style={[
								styles.exampleContainer,
								{
									backgroundColor: gameColor + "15",
									borderLeftColor: gameColor,
								},
							]}
						>
							<View style={styles.exampleHeader}>
								<Ionicons name="bulb-outline" size={16} color={gameColor} />
								<Text style={[styles.exampleLabel, { color: gameColor }]}>
									Example
								</Text>
							</View>
							<Text style={styles.exampleText}>{instructions.example}</Text>
						</View>
					</View>
				</Animated.View>

				{/* Play Button */}
				<TouchableOpacity
					activeOpacity={1}
					onPress={onPlay}
					onPressIn={() => {
						Animated.spring(buttonScale, {
							toValue: 0.95,
							useNativeDriver: true,
							tension: 300,
							friction: 10,
						}).start();
					}}
					onPressOut={() => {
						Animated.spring(buttonScale, {
							toValue: 1,
							useNativeDriver: true,
							tension: 300,
							friction: 10,
						}).start();
					}}
				>
					<Animated.View
						style={[
							styles.playButton,
							{
								backgroundColor: gameColor,
								transform: [{ scale: buttonScale }],
								...Shadows.medium, // Shadow when not pressed
							},
						]}
					>
						<Ionicons name="play" size={28} color={Colors.text.white} />
						<Text style={[styles.playButtonText, { color: Colors.text.white }]}>
							Start Game
						</Text>
					</Animated.View>
				</TouchableOpacity>
			</ScrollView>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background.secondary,
		width: "100%",
		height: "100%",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	scrollView: {
		flex: 1,
		zIndex: 1,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	scrollContent: {
		padding: Spacing.xl,
		paddingTop: Spacing.xl * 2,
		paddingBottom: Spacing.xl * 2,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	titleSection: {
		alignItems: "center",
		marginBottom: Spacing.xl * 1.5,
	},
	difficultyBadge: {
		paddingHorizontal: Spacing.lg,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.pill,
		borderWidth: 2,
		marginBottom: Spacing.lg,
	},
	difficultyText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 1.5,
	},
	gameTitle: {
		fontSize: Typography.fontSize.h1 * 1.15,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		textAlign: "center",
		letterSpacing: -0.8,
	},
	createdByText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.regular,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
		textAlign: "center",
	},
	howToPlayButton: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.lg,
		borderWidth: 1.5,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
		// borderColor will be set inline with gameColor
	},
	howToPlayHeader: {
		flexDirection: "row",
		alignItems: "center",
	},
	howToPlayText: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.semiBold,
		color: Colors.text.primary,
		marginLeft: Spacing.sm,
		flex: 1,
	},
	chevronIcon: {
		marginLeft: Spacing.sm,
	},
	instructionsContainer: {
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.lg,
		padding: Spacing.lg,
		marginBottom: Spacing.xl,
		borderWidth: 1.5,
		borderColor: "#E5E5E5",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	instructionsContent: {
		gap: Spacing.md,
	},
	instructionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.md,
	},
	instructionNumber: {
		width: 28,
		height: 28,
		borderRadius: 14,
		alignItems: "center",
		justifyContent: "center",
		marginTop: 2,
		// backgroundColor and color will be set inline with gameColor
	},
	instructionNumberText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		// color will be set inline with gameColor
	},
	instructionText: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: Typography.fontSize.body * 1.5,
	},
	exampleContainer: {
		marginTop: Spacing.sm,
		padding: Spacing.md,
		borderRadius: BorderRadius.md,
		borderLeftWidth: 4,
		// backgroundColor and borderLeftColor will be set inline with gameColor
	},
	exampleHeader: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
		marginBottom: Spacing.sm,
	},
	exampleLabel: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 1,
		// color will be set inline with gameColor
	},
	exampleText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: Typography.fontSize.body * 1.5,
		fontStyle: "italic",
	},
	playButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		borderRadius: BorderRadius.lg,
		paddingVertical: Spacing.xl,
		paddingHorizontal: Spacing.xl,
		marginTop: -40,
		minHeight: 56,
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
		gap: Spacing.sm,
		// backgroundColor will be set inline with gameColor
	},
	playButtonText: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		letterSpacing: 0.5,
		// color will be set inline
	},
	animationContainer: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 0,
		pointerEvents: "none",
		overflow: "hidden",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	wordleTile: {
		position: "absolute",
		width: 40,
		height: 40,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	wordFormLetter: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
	},
	sudokuCell: {
		position: "absolute",
		width: 30,
		height: 30,
		borderRadius: BorderRadius.sm,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	sudokuNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
	riddleMark: {
		position: "absolute",
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	riddleText: {
		fontSize: 48,
		fontWeight: Typography.fontWeight.bold,
	},
	triviaCard: {
		position: "absolute",
		width: 50,
		height: 50,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	triviaIcon: {
		fontSize: 24,
	},
	mathEquation: {
		position: "absolute",
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	mathText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
	wordChainItem: {
		position: "absolute",
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		flexDirection: "row",
		alignItems: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	wordChainText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
	},
	chainArrow: {
		fontSize: Typography.fontSize.body,
		marginLeft: Spacing.xs,
	},
	aliasWord: {
		position: "absolute",
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	inferenceText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
	},
	futoshikiCell: {
		position: "absolute",
		width: 40,
		height: 40,
		borderRadius: BorderRadius.sm,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	futoshikiNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
	magicSquareCell: {
		position: "absolute",
		width: 28,
		height: 28,
		borderRadius: BorderRadius.sm,
		borderWidth: 1.5,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	magicSquareNumber: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
	},
	hidatoCell: {
		position: "absolute",
		width: 36,
		height: 36,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	trailFinderNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
	sequencingItem: {
		position: "absolute",
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	sequencingText: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.bold,
	},
	mastermindPeg: {
		position: "absolute",
		width: 40,
		height: 40,
		alignItems: "center",
		justifyContent: "center",
	},
	codeBreakerEmoji: {
		fontSize: 32,
	},
	zipCell: {
		position: "absolute",
		width: 40,
		height: 40,
		borderRadius: BorderRadius.md,
		borderWidth: 2,
		alignItems: "center",
		justifyContent: "center",
		elevation: 0,
		shadowOpacity: 0,
		shadowRadius: 0,
		shadowOffset: { width: 0, height: 0 },
		shadowColor: "transparent",
	},
	zipNumber: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
	},
});

export default GameIntroScreen;
