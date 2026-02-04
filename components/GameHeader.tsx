import React, { useEffect, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	Animated,
	TouchableOpacity,
	Modal,
	TouchableWithoutFeedback,
	ScrollView,
	Alert,
	ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import auth from "@react-native-firebase/auth";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	Animation,
	getGameColor,
} from "../constants/DesignSystem";
import {
	getDifficultyLabel,
	getDifficultyColor,
	gameInstructions,
} from "../config/gameInstructions";
import { PuzzleType } from "../config/types";
import { db, parsePuzzleId } from "../config/firebase";
import { getCurrentUser } from "../config/auth";

interface GameHeaderProps {
	title: string;
	elapsedTime: number;
	difficulty?: number;
	showDifficulty?: boolean;
	subtitle?: string;
	gameType?: PuzzleType;
	puzzleId?: string; // Add puzzleId prop for reporting
}

const GameHeader: React.FC<GameHeaderProps> = ({
	title,
	elapsedTime,
	difficulty = 1,
	showDifficulty = true,
	subtitle,
	gameType,
	puzzleId,
}) => {
	const [showHelp, setShowHelp] = useState(false);
	const [showReportModal, setShowReportModal] = useState(false);
	const [reporting, setReporting] = useState(false);
	
	const instructions = gameType ? gameInstructions[gameType] : null;
	const gameColor = gameType ? getGameColor(gameType) : Colors.accent;
	const currentUser = getCurrentUser();
	// Animation for entrance
	const fadeAnim = useRef(new Animated.Value(0)).current;
	const slideAnim = useRef(new Animated.Value(-10)).current;

	useEffect(() => {
		Animated.parallel([
			Animated.timing(fadeAnim, {
				toValue: 1,
				duration: Animation.duration.normal,
				useNativeDriver: true,
			}),
			Animated.spring(slideAnim, {
				toValue: 0,
				tension: 50,
				friction: 7,
				useNativeDriver: true,
			}),
		]).start();
	}, []);

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const difficultyLabel = getDifficultyLabel(difficulty);
	const difficultyColor = getDifficultyColor(difficulty);

	// Create gradient colors for difficulty badge
	const getDifficultyGradient = (color: string): [string, string] => {
		return [color, color + "DD"];
	};

	const handleOpenReportModal = async () => {
		if (!puzzleId || !currentUser) {
			Alert.alert("Error", "Unable to report game. Please try again.");
			return;
		}

		try {
			const firestore = require("@react-native-firebase/firestore").default;
			
			// Check if user has already reported this game
			const reportRef = db
				.collection("users")
				.doc(currentUser.uid)
				.collection("reports")
				.doc(puzzleId);

			const existingReport = await reportRef.get();
			const reportExists = typeof existingReport.exists === "function" 
				? existingReport.exists() 
				: existingReport.exists;
			if (reportExists) {
				Alert.alert("Already Reported", "You have already reported this game.");
				return;
			}

			// If not already reported, open the modal
			setShowHelp(false);
			setShowReportModal(true);
		} catch (error: any) {
			console.error("Error checking report status:", error);
			Alert.alert("Error", "Failed to check report status. Please try again.");
		}
	};

	const handleReportGame = async (reportType: "wrong_solution" | "offensive") => {
		if (!puzzleId || !currentUser) {
			Alert.alert("Error", "Unable to report game. Please try again.");
			return;
		}

		setReporting(true);
		try {
			const firestore = require("@react-native-firebase/firestore").default;
			const parsed = parsePuzzleId(puzzleId);
			
			if (!parsed) {
				throw new Error("Invalid puzzleId format");
			}

			// Create reportRef for storing the report
			const reportRef = db
				.collection("users")
				.doc(currentUser.uid)
				.collection("reports")
				.doc(puzzleId);

			const { gameType, difficulty, gameId } = parsed;
			const gameRef = db
				.collection("games")
				.doc(gameType)
				.collection(difficulty)
				.doc(gameId);

			const gameDoc = await gameRef.get();
			const gameExists = typeof gameDoc.exists === "function" 
				? gameDoc.exists() 
				: gameDoc.exists;
			if (!gameExists) {
				throw new Error("Game not found");
			}

			const gameData = gameDoc.data();
			const creatorUserId = gameData?.uid || gameData?.createdBy;

			if (reportType === "wrong_solution") {
				// Handle wrong solution report
				const currentDownVote = gameData?.downVote || 0;
				const newDownVote = currentDownVote + 1;

				// Update downVote using increment (atomic operation)
				// FieldValue.increment(1) on non-existent field creates it as 1
				const updateData: any = {
					downVote: firestore.FieldValue.increment(1),
				};

				// If downVote reaches 10, set visible to false
				if (newDownVote == 10) {
					updateData.visible = false;

					// Increment gameStrikeCount of creator
					if (creatorUserId) {
						const creatorRef = db.collection("users").doc(creatorUserId);
						const creatorDoc = await creatorRef.get();
						const creatorData = creatorDoc.data();
						const currentGameStrikeCount = creatorData?.gameStrikeCount || 0;

						await creatorRef.update({
							gameStrikeCount: currentGameStrikeCount + 1,
							updatedAt: firestore.FieldValue.serverTimestamp(),
						});
					}
				}

				await gameRef.update(updateData);

				// Store the report in user's reports collection
				await reportRef.set({
					gameId: puzzleId,
					reportType: reportType,
					reportedAt: firestore.FieldValue.serverTimestamp(),
				});
			} else if (reportType === "offensive") {
				// Handle offensive report
				// Check each field individually for better detection
				const excludedFields = ["uid", "createdBy", "username", "approved", "createdAt", "downVote", "visible"];
				const fieldsToCheck = Object.entries(gameData || {})
					.filter(([key]) => !excludedFields.includes(key));

				let hasAnyViolations = false;

				// Get auth token once
				const currentAuthUser = auth().currentUser;
				if (!currentAuthUser) {
					throw new Error("Not authenticated");
				}

				const idToken = await currentAuthUser.getIdToken();
				const analyzeUrl = "https://us-central1-gear-ff009.cloudfunctions.net/analyze_game";

				// Check each field individually
				for (const [key, value] of fieldsToCheck) {
					// Convert field value to string for analysis
					let fieldString = "";
					if (Array.isArray(value)) {
						// For arrays, check the whole array as JSON
						fieldString = JSON.stringify(value);
					} else if (typeof value === "object" && value !== null) {
						// For objects, convert to JSON string
						fieldString = JSON.stringify(value);
					} else {
						// For primitives, convert to string
						fieldString = String(value);
					}

				// Skip empty strings
				if (!fieldString || fieldString.trim().length === 0) {
					continue;
				}

				// Call Firebase function to analyze this field
				const analyzeResponse = await fetch(analyzeUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${idToken}`,
					},
					body: JSON.stringify({
						data: {
							gameData: fieldString,
						},
					}),
				});

				if (analyzeResponse.ok) {
					const analyzeResult = await analyzeResponse.json();
					const result = analyzeResult.result || analyzeResult;

					if (result.hasViolations === true) {
						hasAnyViolations = true;
						break; // Found violation, no need to check other fields
					}
				}
				}

				// Always increment downVote for offensive reports
				const currentDownVote = gameData?.downVote || 0;
				const newDownVote = currentDownVote + 1;

				const updateData: any = {
					downVote: firestore.FieldValue.increment(1),
				};

				// If any field has violations, set visible to false
				if (hasAnyViolations) {
					updateData.visible = false;
				}

				// If downVote reaches 10, increment gameStrikeCount
				if (newDownVote >= 10) {
					if (creatorUserId) {
						const creatorRef = db.collection("users").doc(creatorUserId);
						const creatorDoc = await creatorRef.get();
						const creatorData = creatorDoc.data();
						const currentGameStrikeCount = creatorData?.gameStrikeCount || 0;

						await creatorRef.update({
							gameStrikeCount: currentGameStrikeCount + 1,
							updatedAt: firestore.FieldValue.serverTimestamp(),
						});
					}
				}

				await gameRef.update(updateData);

				// Store the report in user's reports collection
				await reportRef.set({
					gameId: puzzleId,
					reportType: reportType,
					reportedAt: firestore.FieldValue.serverTimestamp(),
				});
			}

			// Reset reporting state first, then close modal after a brief delay
			// This ensures loading stays visible during modal close animation
			setTimeout(() => {
				setShowReportModal(false);
				setTimeout(() => {
					setReporting(false);
					Alert.alert("Success", "Thank you for reporting. The game has been reviewed.");
				}, 300);
			}, 100);
		} catch (error: any) {
			console.error("Error reporting game:", error);
			setTimeout(() => {
				setShowReportModal(false);
				setTimeout(() => {
					setReporting(false);
					Alert.alert("Error", "Failed to report game. Please try again.");
				}, 300);
			}, 100);
		}
	};

	return (
		<>
			<Animated.View
				style={[
					styles.header,
					{
						opacity: fadeAnim,
						transform: [{ translateY: slideAnim }],
					},
				]}
			>
				<View style={styles.headerLeft}>
					<View style={styles.titleRow}>
						<Text style={styles.title}>{title}</Text>
						{gameType && instructions && (
							<TouchableOpacity
								onPress={() => setShowHelp(true)}
								style={styles.helpButton}
								activeOpacity={0.7}
							>
								<Ionicons
									name="help-circle-outline"
									size={22}
									color={gameColor}
								/>
							</TouchableOpacity>
						)}
					</View>
					{subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
				</View>
				<View style={styles.headerRight}>
					{showDifficulty && (
						<LinearGradient
							colors={getDifficultyGradient(difficultyColor)}
							start={{ x: 0, y: 0 }}
							end={{ x: 1, y: 1 }}
							style={styles.difficultyBadge}
						>
							<Text style={styles.difficultyText}>{difficultyLabel}</Text>
						</LinearGradient>
					)}
					<LinearGradient
						colors={[Colors.accent + "20", Colors.accent + "10"]}
						start={{ x: 0, y: 0 }}
						end={{ x: 1, y: 1 }}
						style={styles.timerBadge}
					>
						<Text style={styles.timer}>{formatTime(elapsedTime)}</Text>
					</LinearGradient>
				</View>
			</Animated.View>

			{/* Instructions Modal */}
			{gameType && instructions && (
				<Modal
					visible={showHelp}
					transparent={true}
					animationType="fade"
					onRequestClose={() => setShowHelp(false)}
				>
					<TouchableWithoutFeedback onPress={() => setShowHelp(false)}>
						<View style={styles.modalOverlay}>
							<TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
								<View style={styles.helpModal}>
									<View style={styles.helpHeader}>
										<Text style={styles.helpTitle}>How to Play</Text>
										<TouchableOpacity
											onPress={() => setShowHelp(false)}
											style={styles.closeButton}
										>
											<Ionicons
												name="close"
												size={24}
												color={Colors.text.primary}
											/>
										</TouchableOpacity>
									</View>
								<ScrollView
									style={styles.helpScrollView}
									contentContainerStyle={styles.helpContent}
									showsVerticalScrollIndicator={true}
									bounces={true}
									nestedScrollEnabled={true}
								>
										{instructions.instructions.map((instruction, index) => (
											<View key={index} style={styles.instructionItem}>
												<View style={[styles.instructionBullet, { backgroundColor: gameColor }]}>
													<Text style={styles.bulletText}>{index + 1}</Text>
												</View>
												<Text style={styles.instructionText}>
													{instruction}
												</Text>
											</View>
										))}
										<View style={[styles.exampleContainer, { borderLeftColor: gameColor }]}>
											<Text style={[styles.exampleLabel, { color: gameColor }]}>Example</Text>
											<Text style={styles.exampleText}>
												{instructions.example}
											</Text>
										</View>
									</ScrollView>
									{puzzleId && currentUser && (
										<TouchableOpacity
											style={styles.reportButton}
											onPress={handleOpenReportModal}
											activeOpacity={0.7}
										>
											<Ionicons name="flag-outline" size={18} color={Colors.text.secondary} />
											<Text style={styles.reportButtonText}>Report Game</Text>
										</TouchableOpacity>
									)}
								</View>
							</TouchableWithoutFeedback>
						</View>
					</TouchableWithoutFeedback>
				</Modal>
			)}

			{/* Report Modal */}
			{puzzleId && (
				<Modal
					visible={showReportModal}
					transparent={true}
					animationType="fade"
					onRequestClose={() => {
						if (!reporting) {
							setShowReportModal(false);
						}
					}}
				>
					<View style={styles.modalOverlay}>
						<View style={styles.reportModalContent}>
							<View style={styles.reportModalHeader}>
								<Text style={styles.reportModalTitle}>Report Game</Text>
								<TouchableOpacity
									onPress={() => {
										if (!reporting) {
											setShowReportModal(false);
										}
									}}
									style={styles.closeButton}
								>
									<Ionicons name="close" size={24} color={Colors.text.primary} />
								</TouchableOpacity>
							</View>

							{reporting ? (
								<View style={styles.reportLoadingContainer}>
									<ActivityIndicator size="large" color={Colors.accent} />
									<Text style={styles.reportLoadingText}>Processing report...</Text>
								</View>
							) : (
								<View style={styles.reportOptionsContainer}>
									<TouchableOpacity
										style={styles.reportOptionButton}
										onPress={() => handleReportGame("wrong_solution")}
										activeOpacity={0.7}
									>
										<Ionicons name="close-circle-outline" size={24} color={Colors.error} />
										<View style={styles.reportOptionTextContainer}>
											<Text style={styles.reportOptionTitle}>Wrong Solution or No Solution</Text>
											<Text style={styles.reportOptionSubtitle}>The game has incorrect answers or no valid solution</Text>
										</View>
									</TouchableOpacity>

									<TouchableOpacity
										style={styles.reportOptionButton}
										onPress={() => handleReportGame("offensive")}
										activeOpacity={0.7}
									>
										<Ionicons name="warning-outline" size={24} color={Colors.secondaryAccent} />
										<View style={styles.reportOptionTextContainer}>
											<Text style={styles.reportOptionTitle}>Offensive</Text>
											<Text style={styles.reportOptionSubtitle}>The game contains inappropriate content</Text>
										</View>
									</TouchableOpacity>
								</View>
							)}
						</View>
					</View>
				</Modal>
			)}
		</>
	);
};

const styles = StyleSheet.create({
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		width: "100%",
		paddingHorizontal: Spacing.md,
		paddingTop: Spacing.md,
		paddingBottom: Spacing.sm,
	},
	headerLeft: {
		flex: 1,
	},
	headerRight: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.sm,
	},
	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: Spacing.xs,
	},
	title: {
		fontSize: Typography.fontSize.h2,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		letterSpacing: Typography.letterSpacing.tight,
	},
	helpButton: {
		padding: Spacing.xs,
	},
	subtitle: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.secondary,
		marginTop: Spacing.xs,
	},
	difficultyBadge: {
		paddingHorizontal: Spacing.sm,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.sm,
		overflow: "hidden",
		...Shadows.light,
	},
	difficultyText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: Typography.letterSpacing.wideUppercase,
		color: Colors.text.white,
	},
	timerBadge: {
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.xs,
		borderRadius: BorderRadius.sm,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
		overflow: "hidden",
		...Shadows.glowAccent,
	},
	timer: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.4)",
		justifyContent: "center",
		alignItems: "center",
	},
	helpModal: {
		width: "85%",
		maxHeight: "75%",
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.lg,
		...Shadows.medium,
	},
	helpHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	helpTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	closeButton: {
		padding: Spacing.xs,
	},
	helpScrollView: {
		flexGrow: 1,
		flexShrink: 1,
	},
	helpContent: {
		padding: Spacing.lg,
		paddingTop: Spacing.md,
		gap: Spacing.md,
	},
	instructionItem: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.sm,
	},
	instructionBullet: {
		width: 24,
		height: 24,
		borderRadius: 12,
		backgroundColor: Colors.accent,
		justifyContent: "center",
		alignItems: "center",
	},
	bulletText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.white,
	},
	instructionText: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		lineHeight: 22,
	},
	exampleContainer: {
		marginTop: Spacing.md,
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderLeftWidth: 3,
		borderLeftColor: Colors.accent,
	},
	exampleLabel: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		marginBottom: Spacing.xs,
		textTransform: "uppercase",
		letterSpacing: 0.5,
	},
	exampleText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		lineHeight: 20,
	},
	reportButton: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: Spacing.xs,
		padding: Spacing.md,
		marginTop: Spacing.lg,
		borderTopWidth: 1,
		borderTopColor: "rgba(255, 255, 255, 0.1)",
	},
	reportButtonText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
	},
	reportModalContent: {
		width: "85%",
		maxWidth: 400,
		backgroundColor: Colors.background.primary,
		borderRadius: BorderRadius.xl,
		...Shadows.heavy,
	},
	reportModalHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: Spacing.lg,
		paddingBottom: Spacing.md,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	reportModalTitle: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
	},
	reportLoadingContainer: {
		alignItems: "center",
		padding: Spacing.xl,
	},
	reportLoadingText: {
		fontSize: Typography.fontSize.body,
		color: Colors.text.secondary,
		marginTop: Spacing.md,
	},
	reportOptionsContainer: {
		padding: Spacing.lg,
		gap: Spacing.md,
	},
	reportOptionButton: {
		flexDirection: "row",
		alignItems: "flex-start",
		gap: Spacing.md,
		padding: Spacing.md,
		backgroundColor: Colors.background.secondary,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.text.secondary + "20",
	},
	reportOptionTextContainer: {
		flex: 1,
	},
	reportOptionTitle: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	reportOptionSubtitle: {
		fontSize: Typography.fontSize.small,
		color: Colors.text.secondary,
	},
});

export default React.memo(GameHeader);
