import React, { useState, useEffect } from "react";
import {
	View,
	Text,
	TextInput,
	TouchableOpacity,
	StyleSheet,
	Alert,
} from "react-native";
import { ZipData, GameResult } from "../../config/types";

interface ZipGameProps {
	inputData: ZipData;
	onComplete: (result: GameResult) => void;
}

const ZipGame: React.FC<ZipGameProps> = ({ inputData, onComplete }) => {
	const [guess, setGuess] = useState("");
	const [attempts, setAttempts] = useState(0);
	const [isComplete, setIsComplete] = useState(false);
	const [showHint, setShowHint] = useState(false);
	const [startTime] = useState(Date.now());
	const maxAttempts = 3;

	const answer = inputData.answer.toUpperCase();

	const handleSubmit = () => {
		if (!guess.trim()) return;

		const normalizedGuess = guess.trim().toUpperCase();
		const newAttempts = attempts + 1;
		setAttempts(newAttempts);

		if (normalizedGuess === answer) {
			setIsComplete(true);
			const timeTaken = Math.floor((Date.now() - startTime) / 1000);
			onComplete({
				puzzleId: `zip_${Date.now()}`,
				completed: true,
				timeTaken,
				attempts: newAttempts,
				completedAt: new Date().toISOString(),
			});
		} else if (newAttempts >= maxAttempts) {
			Alert.alert("Out of Attempts", `The correct answer was: ${answer}`, [
				{
					text: "OK",
					onPress: () => {
						const timeTaken = Math.floor((Date.now() - startTime) / 1000);
						onComplete({
							puzzleId: `zip_${Date.now()}`,
							completed: false,
							timeTaken,
							attempts: newAttempts,
							completedAt: new Date().toISOString(),
						});
					},
				},
			]);
		} else {
			Alert.alert(
				"Incorrect",
				`Try again! ${maxAttempts - newAttempts} attempts left.`
			);
			setGuess("");
		}
	};

	const handleHint = () => {
		setShowHint(true);
	};

	if (isComplete) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>Zip Challenge</Text>

				<View style={styles.wordsContainer}>
					<Text style={styles.word}>{inputData.word1}</Text>
					<Text style={styles.connector}>→ ??? ←</Text>
					<Text style={styles.word}>{inputData.word2}</Text>
				</View>

				<View style={styles.answerContainer}>
					<Text style={styles.correctAnswer}>{answer}</Text>
					<Text style={styles.successText}>🎉 Correct!</Text>
				</View>
			</View>
		);
	}

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Zip Challenge</Text>

			<View style={styles.wordsContainer}>
				<Text style={styles.word}>{inputData.word1}</Text>
				<Text style={styles.connector}>→ ??? ←</Text>
				<Text style={styles.word}>{inputData.word2}</Text>
			</View>

			<Text style={styles.instruction}>
				Find the word that connects these two words!
			</Text>

			<View style={styles.inputContainer}>
				<TextInput
					style={styles.textInput}
					value={guess}
					onChangeText={setGuess}
					placeholder="Enter your answer..."
					autoCapitalize="characters"
					autoCorrect={false}
					maxLength={20}
					onSubmitEditing={handleSubmit}
				/>

				<TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
					<Text style={styles.submitButtonText}>Submit</Text>
				</TouchableOpacity>
			</View>

			<View style={styles.hintContainer}>
				{!showHint ? (
					<TouchableOpacity style={styles.hintButton} onPress={handleHint}>
						<Text style={styles.hintButtonText}>💡 Need a hint?</Text>
					</TouchableOpacity>
				) : (
					<View style={styles.hintBox}>
						<Text style={styles.hintText}>{inputData.hint}</Text>
					</View>
				)}
			</View>

			<View style={styles.attemptsContainer}>
				<Text style={styles.attemptsText}>
					Attempts: {attempts}/{maxAttempts}
				</Text>
			</View>
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 20,
		alignItems: "center",
		justifyContent: "center",
	},
	title: {
		fontSize: 24,
		fontWeight: "bold",
		marginBottom: 30,
		color: "#212121",
	},
	wordsContainer: {
		alignItems: "center",
		marginBottom: 20,
	},
	word: {
		fontSize: 28,
		fontWeight: "bold",
		color: "#1e88e5",
		marginVertical: 10,
	},
	connector: {
		fontSize: 18,
		color: "#666",
		marginVertical: 10,
	},
	instruction: {
		fontSize: 16,
		color: "#666",
		textAlign: "center",
		marginBottom: 30,
		paddingHorizontal: 20,
	},
	inputContainer: {
		width: "100%",
		maxWidth: 300,
		marginBottom: 20,
	},
	textInput: {
		borderWidth: 2,
		borderColor: "#d3d6da",
		borderRadius: 8,
		padding: 15,
		fontSize: 18,
		textAlign: "center",
		marginBottom: 15,
		backgroundColor: "#ffffff",
	},
	submitButton: {
		backgroundColor: "#1e88e5",
		padding: 15,
		borderRadius: 8,
		alignItems: "center",
	},
	submitButtonText: {
		fontSize: 18,
		fontWeight: "bold",
		color: "#ffffff",
	},
	hintContainer: {
		marginBottom: 20,
	},
	hintButton: {
		backgroundColor: "#ffc107",
		padding: 10,
		borderRadius: 8,
	},
	hintButtonText: {
		fontSize: 16,
		color: "#212121",
	},
	hintBox: {
		backgroundColor: "#fff3cd",
		padding: 15,
		borderRadius: 8,
		borderWidth: 1,
		borderColor: "#ffeaa7",
	},
	hintText: {
		fontSize: 16,
		color: "#856404",
		textAlign: "center",
	},
	attemptsContainer: {
		marginTop: 20,
	},
	attemptsText: {
		fontSize: 16,
		color: "#666",
	},
	answerContainer: {
		alignItems: "center",
		marginTop: 20,
	},
	correctAnswer: {
		fontSize: 32,
		fontWeight: "bold",
		color: "#4caf50",
		marginBottom: 10,
	},
	successText: {
		fontSize: 20,
		color: "#4caf50",
	},
});

export default ZipGame;
