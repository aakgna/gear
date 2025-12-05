import React, { useState, useEffect, useRef } from "react";
import {
	View,
	Text,
	StyleSheet,
	TouchableOpacity,
	ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GameResult, SequencingData } from "../../config/types";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
	ComponentStyles,
} from "../../constants/DesignSystem";
import GameHeader from "../GameHeader";

interface SequencingGameProps {
	inputData: SequencingData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
	isActive?: boolean;
}

const SequencingGame: React.FC<SequencingGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
	isActive = true,
}) => {
	// currentPlacement: index is slot position, value is entity index or null
	const [currentPlacement, setCurrentPlacement] = useState<(number | null)[]>(
		new Array(inputData.numSlots).fill(null)
	);
	const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
	const [isCorrect, setIsCorrect] = useState(false);
	const [placementCount, setPlacementCount] = useState(0);
	const [startTime, setStartTime] = useState<number | undefined>(propStartTime);
	const [elapsedTime, setElapsedTime] = useState(0);
	const [completed, setCompleted] = useState(false);
	const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
	const puzzleIdRef = useRef<string>("");
	const hasAttemptedRef = useRef(false);

	// Get unplaced entities
	const getUnplacedEntities = (): number[] => {
		const placed = new Set(currentPlacement.filter((idx) => idx !== null));
		return inputData.entities
			.map((_, idx) => idx)
			.filter((idx) => !placed.has(idx));
	};

	// Validate placement against solution from Firestore
	const validatePlacement = (): boolean => {
		// Check if all slots are filled
		if (currentPlacement.some((idx) => idx === null)) {
			return false;
		}
		
		// Compare current placement to solution
		// Solution is array of entity indices in correct order (0-based)
		return JSON.stringify(currentPlacement) === JSON.stringify(inputData.solution);
	};

	// Setup timer and puzzleId tracking
	useEffect(() => {
		// Clear any existing timer
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}

		// Reset if puzzle changed
		if (puzzleId && puzzleIdRef.current !== puzzleId) {
			puzzleIdRef.current = puzzleId;
			setElapsedTime(0);
			setCompleted(false);
			setCurrentPlacement(new Array(inputData.numSlots).fill(null));
			setSelectedEntity(null);
			setIsCorrect(false);
			setPlacementCount(0);
			hasAttemptedRef.current = false;
			// Only set startTime if propStartTime is provided
			if (propStartTime) {
				setStartTime(propStartTime);
			} else {
				setStartTime(undefined);
			}
		} else if (propStartTime && startTime !== propStartTime) {
			setStartTime(propStartTime);
		} else if (!propStartTime && startTime !== undefined) {
			setStartTime(undefined);
		}

		// Only set up timer if startTime is provided and game is active
		if (startTime && isActive) {
			timerIntervalRef.current = setInterval(() => {
				setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
			}, 1000);
		} else if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}

		return () => {
			if (timerIntervalRef.current) {
				clearInterval(timerIntervalRef.current);
				timerIntervalRef.current = null;
			}
		};
	}, [puzzleId, propStartTime, inputData.numSlots]);

	// Validate on placement change
	useEffect(() => {
		const correct = validatePlacement();
		setIsCorrect(correct);
		
		// Check completion
		if (!completed && correct) {
			handleGameComplete();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentPlacement, completed]);

	const handleEntitySelect = (entityIdx: number) => {
		if (selectedEntity === entityIdx) {
			setSelectedEntity(null);
		} else {
			setSelectedEntity(entityIdx);
		}
	};

	const handleSlotTap = (slotIdx: number) => {
		if (selectedEntity === null) {
			// If no entity selected, remove entity from this slot if present
			if (currentPlacement[slotIdx] !== null) {
				const newPlacement = [...currentPlacement];
				newPlacement[slotIdx] = null;
				setCurrentPlacement(newPlacement);
				setPlacementCount(placementCount + 1);
			}
		} else {
			// Place selected entity in slot
			const newPlacement = [...currentPlacement];
			const existingEntity = newPlacement[slotIdx];

			// If slot already has entity, swap
			if (existingEntity !== null) {
				// Find where selected entity currently is
				const currentPos = newPlacement.indexOf(selectedEntity);
				if (currentPos !== -1) {
					newPlacement[currentPos] = existingEntity;
				}
			}

			newPlacement[slotIdx] = selectedEntity;
			setCurrentPlacement(newPlacement);
			setSelectedEntity(null);
			setPlacementCount(placementCount + 1);

			if (!hasAttemptedRef.current && onAttempt && puzzleIdRef.current) {
				onAttempt(puzzleIdRef.current);
				hasAttemptedRef.current = true;
			}
		}
	};

	const handleGameComplete = () => {
		if (completed) return;

		setCompleted(true);
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
		}

		const finalTime = Math.floor((Date.now() - startTime) / 1000);

		onComplete({
			puzzleId: puzzleIdRef.current || "",
			completed: true,
			timeTaken: finalTime,
			attempts: placementCount,
			completedAt: new Date().toISOString(),
		});
	};

	const formatTime = (seconds: number): string => {
		if (seconds < 60) {
			return `${seconds}s`;
		}
		const minutes = Math.floor(seconds / 60);
		const remainingSeconds = seconds % 60;
		return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
	};

	const unplacedEntities = getUnplacedEntities();
	const allSlotsFilled = currentPlacement.every((idx) => idx !== null);

	// Slot labels (always runners format)
	const getSlotLabel = (slotIdx: number): string => {
		const positions = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
		return positions[slotIdx] || `${slotIdx + 1}th`;
	};

	return (
		<View style={styles.container}>
			{/* Header */}
			<GameHeader
				title="Sequencing"
				elapsedTime={elapsedTime}
				showDifficulty={false}
				subtitle={`Placements: ${placementCount}`}
			/>

			{/* Rules Display */}
			<View style={styles.rulesContainer}>
				<Text style={styles.rulesTitle}>Rules:</Text>
				<ScrollView style={styles.rulesScroll}>
					{inputData.rules.map((rule, idx) => (
						<View key={idx} style={styles.ruleItem}>
							<Text style={styles.ruleText}>
								• {rule.description}
							</Text>
						</View>
					))}
				</ScrollView>
			</View>

			{/* Slots */}
			<View style={styles.slotsContainer}>
				<Text style={styles.sectionLabel}>Slots:</Text>
				<View style={styles.slotsGrid}>
					{currentPlacement.map((entityIdx, slotIdx) => {
						// Check if this slot has the correct entity
						const slotIsCorrect = allSlotsFilled && entityIdx === inputData.solution[slotIdx];
						const slotIsIncorrect = allSlotsFilled && !slotIsCorrect && entityIdx !== null;
						
						return (
						<TouchableOpacity
							key={slotIdx}
							style={[
								styles.slot,
								entityIdx !== null && styles.slotFilled,
								slotIsCorrect && styles.slotValid,
								slotIsIncorrect && styles.slotInvalid,
							]}
							onPress={() => handleSlotTap(slotIdx)}
						>
							<Text style={styles.slotLabel}>{getSlotLabel(slotIdx)}</Text>
							{entityIdx !== null ? (
								<Text style={styles.slotEntity}>
									{inputData.entities[entityIdx]}
								</Text>
							) : (
								<Text style={styles.slotEmpty}>Empty</Text>
							)}
						</TouchableOpacity>
						);
					})}
				</View>
			</View>

			{/* Entity Pool */}
			<View style={styles.poolContainer}>
				<Text style={styles.sectionLabel}>Available Entities:</Text>
				<ScrollView horizontal showsHorizontalScrollIndicator={false}>
					<View style={styles.pool}>
						{unplacedEntities.map((entityIdx) => (
							<TouchableOpacity
								key={entityIdx}
								style={[
									styles.entityButton,
									selectedEntity === entityIdx && styles.entitySelected,
								]}
								onPress={() => handleEntitySelect(entityIdx)}
							>
								<Text style={styles.entityText}>
									{inputData.entities[entityIdx]}
								</Text>
							</TouchableOpacity>
						))}
					</View>
				</ScrollView>
			</View>

			{/* Instructions */}
			{selectedEntity !== null && (
				<View style={styles.instructionContainer}>
					<Text style={styles.instructionText}>
						Tap a slot to place "{inputData.entities[selectedEntity]}"
					</Text>
				</View>
			)}

			{/* Completion Message */}
			{completed && (
				<View style={styles.completionContainer}>
					<Text style={styles.completionText}>🎉 Puzzle Complete!</Text>
					<TouchableOpacity
						style={styles.statsButton}
						onPress={onShowStats}
					>
						<Text style={styles.statsButtonText}>View Stats</Text>
					</TouchableOpacity>
				</View>
			)}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: Colors.background,
		padding: Spacing.md,
	},
	header: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "flex-start",
		width: "100%",
		paddingHorizontal: Spacing.xl,
		paddingTop: Spacing.xl,
		paddingBottom: Spacing.md,
		marginBottom: Spacing.lg,
	},
	headerLeft: {
		flex: 1,
	},
	title: {
		fontSize: Typography.fontSize.h1,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.primary,
		letterSpacing: -0.5,
		marginBottom: Spacing.xs,
	},
	progressInfo: {
		fontSize: Typography.fontSize.caption,
		color: Colors.text.secondary,
		fontWeight: Typography.fontWeight.medium,
	},
	timerBadge: {
		backgroundColor: Colors.accent + "20",
		paddingHorizontal: Spacing.md,
		paddingVertical: Spacing.sm,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.accent + "40",
	},
	timer: {
		fontSize: Typography.fontSize.h3,
		fontWeight: Typography.fontWeight.bold,
		color: Colors.accent,
		fontFamily: Typography.fontFamily.monospace,
	},
	rulesContainer: {
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		padding: Spacing.sm,
		marginBottom: Spacing.md,
		...Shadows.small,
		maxHeight: 150,
	},
	rulesTitle: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		marginBottom: Spacing.xs,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
	},
	rulesScroll: {
		maxHeight: 120,
	},
	ruleItem: {
		paddingVertical: Spacing.xs,
	},
	ruleViolated: {
		backgroundColor: Colors.error + "20",
		borderRadius: BorderRadius.sm,
		padding: Spacing.xs,
	},
	ruleText: {
		...Typography.body,
		color: "#FFFFFF",
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
	},
	ruleTextViolated: {
		color: "#FF4444",
		fontWeight: Typography.fontWeight.bold,
		fontSize: Typography.fontSize.body,
	},
	slotsContainer: {
		marginBottom: Spacing.md,
	},
	sectionLabel: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		marginBottom: Spacing.xs,
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
	},
	slotsGrid: {
		flexDirection: "row",
		flexWrap: "wrap",
		gap: Spacing.sm,
	},
	slotsCalendar: {
		// Calendar-style layout (could be enhanced)
	},
	slotsPodium: {
		// Podium-style layout (could be enhanced)
	},
	slot: {
		minWidth: 120,
		minHeight: 80,
		padding: Spacing.md,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		borderWidth: 3,
		borderColor: "#666666",
		alignItems: "center",
		justifyContent: "center",
		...Shadows.medium,
	},
	slotFilled: {
		backgroundColor: "#1a1a1a",
		borderColor: Colors.primary,
		borderWidth: 3,
	},
	slotValid: {
		borderColor: "#4CAF50",
		backgroundColor: "#4CAF50" + "30",
		borderWidth: 4,
	},
	slotInvalid: {
		borderColor: "#FF4444",
		backgroundColor: "#FF4444" + "30",
		borderWidth: 4,
	},
	slotLabel: {
		...Typography.caption,
		color: "#AAAAAA",
		fontSize: Typography.fontSize.small,
		marginBottom: Spacing.xs,
		fontWeight: Typography.fontWeight.medium,
	},
	slotEntity: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		fontSize: Typography.fontSize.body,
		textAlign: "center",
		fontWeight: Typography.fontWeight.semiBold,
	},
	slotEmpty: {
		...Typography.body,
		color: "#888888",
		fontSize: Typography.fontSize.caption,
		fontStyle: "italic",
		fontWeight: Typography.fontWeight.medium,
	},
	poolContainer: {
		marginBottom: Spacing.md,
	},
	pool: {
		flexDirection: "row",
		gap: Spacing.sm,
		paddingVertical: Spacing.xs,
	},
	entityButton: {
		paddingVertical: Spacing.md,
		paddingHorizontal: Spacing.lg,
		backgroundColor: Colors.surface,
		borderRadius: BorderRadius.md,
		borderWidth: 3,
		borderColor: "#666666",
		...Shadows.medium,
		minHeight: 50,
	},
	entitySelected: {
		borderColor: Colors.primary,
		backgroundColor: Colors.primary + "30",
		borderWidth: 4,
	},
	entityText: {
		...Typography.body,
		color: "#FFFFFF",
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.semiBold,
	},
	instructionContainer: {
		backgroundColor: Colors.primary + "20",
		padding: Spacing.sm,
		borderRadius: BorderRadius.md,
		marginBottom: Spacing.md,
	},
	instructionText: {
		...Typography.body,
		color: Colors.primary,
		textAlign: "center",
		fontSize: Typography.fontSize.caption,
	},
	completionContainer: {
		backgroundColor: Colors.success + "20",
		padding: Spacing.md,
		borderRadius: BorderRadius.lg,
		alignItems: "center",
	},
	completionText: {
		...Typography.h3,
		color: Colors.success,
		marginBottom: Spacing.md,
	},
	statsButton: {
		...ComponentStyles.button,
		width: "100%",
	},
	statsButtonText: {
		...Typography.buttonLarge,
		color: ComponentStyles.button.textColor,
		fontWeight: Typography.fontWeight.semiBold,
	},
});

export default SequencingGame;

