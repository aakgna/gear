import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
} from "react-native";
import { GameResult, RiddleData } from "../../config/types";

interface RiddleGameProps {
	inputData: RiddleData;
	onComplete: (result: GameResult) => void;
	startTime?: number;
}

const RiddleGame: React.FC<RiddleGameProps> = ({
	inputData,
	onComplete,
	startTime: propStartTime,
}) => {
	const [guess, setGuess] = useState("");
	const [feedback, setFeedback] = useState<string | null>(null);
	const [attempts, setAttempts] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");

	// Reset timer when puzzle changes (using prompt and answer as unique identifier)
	const puzzleSignature = `${inputData.prompt}-${inputData.answer}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setCompleted(false);
			setGuess("");
			setFeedback(null);
			setAttempts(0);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			// Reset timer when startTime prop changes (puzzle switch)
			setElapsedTime(0);
			setStartTime(propStartTime);
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		}
	}, [puzzleSignature, propStartTime, startTime]);

	// Timer effect - updates every second
	useEffect(() => {
		if (completed) {
			// Stop timer when game is completed
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			return;
		}

		// Clear any existing interval
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		// Start timer
		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
		}, 1000);

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
		};
	}, [completed, startTime]);

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const submit = () => {
		const normalized = guess.trim().toLowerCase();
		if (!normalized) return;

		// Parse comma-separated answers from Firestore
		const validAnswers = inputData.answer
			.split(",")
			.map((ans) => ans.trim().toLowerCase());

		const isCorrect = validAnswers.includes(normalized);
		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		setAttempts((a) => a + 1);
		if (isCorrect) {
			// Stop timer
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			setElapsedTime(timeTaken);
			setCompleted(true);
			setFeedback("Correct!");
			onComplete({
				puzzleId: `riddle_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: attempts + 1,
				completedAt: new Date().toISOString(),
			});
		} else {
			setFeedback("Try again.");
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Riddle</Text>
				<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
			</View>
			<View style={styles.boardContainer}>
				<Text style={styles.prompt}>{inputData.prompt}</Text>
			</View>
			<TextInput
				style={styles.input}
				value={guess}
				onChangeText={setGuess}
				autoCapitalize="none"
				autoCorrect={false}
				placeholder="Your answer"
				returnKeyType="done"
				onSubmitEditing={submit}
			/>
			<TouchableOpacity style={styles.submit} onPress={submit}>
				<Text style={styles.submitText}>Submit</Text>
			</TouchableOpacity>
			{inputData.hint && (
				<Text style={styles.hint}>Hint: {inputData.hint}</Text>
			)}
			{feedback && <Text style={styles.feedback}>{feedback}</Text>}
			{completed && (
				<View style={styles.completionContainer}>
					<Text style={styles.completionText}>🎉 Completed!</Text>
					<Text style={styles.completionSubtext}>
						Time: {formatTime(elapsedTime)} • Attempts: {attempts}
					</Text>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		paddingHorizontal: 20,
		paddingTop: 16,
		paddingBottom: 8,
		alignItems: "center",
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		marginBottom: 12,
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#212121",
	},
	timer: {
		fontSize: 20,
		fontWeight: "600",
		color: "#1e88e5",
		fontFamily: "monospace",
	},
	boardContainer: {
		flex: 1,
		width: "100%",
		justifyContent: "center",
		alignItems: "center",
		marginBottom: 8,
	},
	prompt: {
		fontSize: 20,
		color: "#212121",
		textAlign: "center",
	},
	input: {
		width: "100%",
		borderWidth: 1,
		borderColor: "#d3d6da",
		borderRadius: 8,
		paddingVertical: 12,
		paddingHorizontal: 16,
		backgroundColor: "#fff",
		fontSize: 18,
		textAlign: "center",
	},
	submit: {
		marginTop: 12,
		backgroundColor: "#1e88e5",
		paddingVertical: 12,
		paddingHorizontal: 24,
		borderRadius: 8,
	},
	submitText: {
		color: "#fff",
		fontSize: 16,
		fontWeight: "bold",
	},
	hint: {
		marginTop: 8,
		color: "#666",
	},
	feedback: {
		marginTop: 8,
		fontWeight: "600",
		color: "#212121",
	},
	completionContainer: {
		marginTop: 20,
		padding: 20,
		backgroundColor: "#e8f5e9",
		borderRadius: 12,
		alignItems: "center",
		borderWidth: 2,
		borderColor: "#4caf50",
	},
	completionText: {
		fontSize: 24,
		fontWeight: "bold",
		color: "#2e7d32",
		marginBottom: 8,
	},
	completionSubtext: {
		fontSize: 16,
		color: "#388e3c",
		fontWeight: "500",
	},
});

export default RiddleGame;
