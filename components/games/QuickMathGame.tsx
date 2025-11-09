import React, { useMemo, useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	TouchableOpacity,
} from "react-native";
import { GameResult, QuickMathData } from "../../config/types";

interface QuickMathProps {
	inputData: QuickMathData;
	onComplete: (result: GameResult) => void;
	startTime?: number;
}

function evaluateExpression(expression: string): number {
	// PEMDAS is respected by JS eval for + - * / and parentheses when sanitized.
	// We only allow digits, spaces, parentheses and the operators + - * /.
	const safe = expression.replace(/[^0-9+\-*/()\s.]/g, "");
	// eslint-disable-next-line no-eval
	return Math.round((eval(safe) as number) * 1000) / 1000;
}

const QuickMathGame: React.FC<QuickMathProps> = ({
	inputData,
	onComplete,
	startTime: propStartTime,
}) => {
	const problems = useMemo(
		() => inputData.problems.slice(0, 5),
		[inputData.problems]
	);
	const [answers, setAnswers] = useState<string[]>(
		Array(problems.length).fill("")
	);
	const [submitted, setSubmitted] = useState(false);
	const [feedback, setFeedback] = useState<string | null>(null);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
	const [elapsedTime, setElapsedTime] = useState(0);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");

	// Use answers from Firestore instead of evaluating expressions
	const correctAnswers = useMemo(
		() => inputData.answers.slice(0, 5),
		[inputData.answers]
	);

	// Reset timer when puzzle changes (using a unique identifier from inputData)
	const puzzleSignature = `${inputData.problems.join(
		","
	)}-${inputData.answers.join(",")}`;

	useEffect(() => {
		// Only reset if this is a different puzzle
		const newStartTime = propStartTime || Date.now();
		if (puzzleIdRef.current !== puzzleSignature) {
			puzzleIdRef.current = puzzleSignature;
			setElapsedTime(0);
			setStartTime(newStartTime);
			setSubmitted(false);
			setFeedback(null);
			setAnswers(Array(problems.length).fill(""));
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
	}, [puzzleSignature, problems.length, propStartTime, startTime]);

	// Timer effect - updates every second
	useEffect(() => {
		if (submitted) {
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
	}, [submitted, startTime]);

	// Format time as MM:SS or SS
	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const handleChange = (idx: number, value: string) => {
		// Allow numeric including negative and decimal
		setAnswers((prev) => {
			const next = [...prev];
			next[idx] = value;
			return next;
		});
	};

	const handleSubmit = () => {
		if (submitted) return;

		// Check if all answers are filled
		const allFilled = answers.every((ans) => ans.trim() !== "");
		if (!allFilled) {
			setFeedback("Please fill in all answers before submitting.");
			return;
		}

		const timeTaken = Math.floor((Date.now() - startTime) / 1000);
		let correct = 0;
		let allCorrect = true;

		for (let i = 0; i < problems.length; i++) {
			const got = answers[i].trim();
			// Parse comma-separated answers from Firestore
			const validAnswers = correctAnswers[i]
				.split(",")
				.map((ans) => ans.trim());

			// Check if user's answer matches any of the valid answers
			const isCorrect = validAnswers.includes(got);

			if (isCorrect) {
				correct++;
			} else {
				allCorrect = false;
			}
		}

		// Only complete if ALL answers are correct
		if (allCorrect) {
			const accuracy = Math.round((correct / problems.length) * 100);
			setSubmitted(true);
			setFeedback(null);
			// Stop timer
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
			}
			setElapsedTime(timeTaken);
			onComplete({
				puzzleId: `quickmath_${Date.now()}`,
				completed: true,
				timeTaken,
				accuracy,
				completedAt: new Date().toISOString(),
			});
		} else {
			// Show feedback that not all answers are correct
			setFeedback(
				`Not all answers are correct. ${correct}/${problems.length} correct. Try again!`
			);
		}
	};

	return (
		<View style={styles.container}>
			<View style={styles.header}>
				<Text style={styles.title}>Quick Math</Text>
				<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
			</View>
			<View style={styles.boardContainer}>
				<View style={styles.problemList}>
					{problems.map((p, idx) => (
						<View key={idx} style={styles.problemRow}>
							<Text style={styles.problemText}>{p} =</Text>
							<TextInput
								style={styles.answerInput}
								value={answers[idx]}
								onChangeText={(t) =>
									handleChange(idx, t.replace(/[^0-9\-+.]/g, ""))
								}
								keyboardType="numbers-and-punctuation"
								returnKeyType="done"
							/>
						</View>
					))}
				</View>
			</View>
			<TouchableOpacity
				style={[styles.submit, submitted && styles.submitDisabled]}
				onPress={handleSubmit}
				disabled={submitted}
			>
				<Text style={styles.submitText}>Submit</Text>
			</TouchableOpacity>
			{feedback && <Text style={styles.feedback}>{feedback}</Text>}
			{submitted && (
				<View style={styles.completionContainer}>
					<Text style={styles.completionText}>🎉 Completed!</Text>
					<Text style={styles.completionSubtext}>
						Time: {formatTime(elapsedTime)} • Accuracy: 100%
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
	},
	problemList: {
		width: "100%",
		gap: 10,
	},
	problemRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 6,
		paddingHorizontal: 10,
		backgroundColor: "#fff",
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#e0e0e0",
	},
	problemText: {
		fontSize: 18,
		color: "#212121",
		marginRight: 8,
		flexShrink: 1,
	},
	answerInput: {
		width: 90,
		paddingVertical: 8,
		paddingHorizontal: 12,
		borderWidth: 1,
		borderColor: "#d3d6da",
		borderRadius: 6,
		backgroundColor: "#fff",
		textAlign: "center",
		fontSize: 18,
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
	submitDisabled: {
		opacity: 0.5,
	},
	feedback: {
		marginTop: 12,
		fontSize: 14,
		color: "#d32f2f",
		textAlign: "center",
		fontWeight: "500",
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

export default QuickMathGame;
