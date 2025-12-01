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

interface SequencingGameProps {
	inputData: SequencingData;
	onComplete: (result: GameResult) => void;
	onAttempt?: (puzzleId: string) => void;
	startTime?: number;
	puzzleId?: string;
	onShowStats?: () => void;
}

const SequencingGame: React.FC<SequencingGameProps> = ({
	inputData,
	onComplete,
	onAttempt,
	startTime: propStartTime,
	puzzleId,
	onShowStats,
}) => {
	// currentPlacement: index is slot position, value is entity index or null
	const [currentPlacement, setCurrentPlacement] = useState<(number | null)[]>(
		new Array(inputData.numSlots).fill(null)
	);
	const [selectedEntity, setSelectedEntity] = useState<number | null>(null);
	const [isCorrect, setIsCorrect] = useState(false);
	const [placementCount, setPlacementCount] = useState(0);
	const [startTime, setStartTime] = useState(propStartTime || Date.now());
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
			setStartTime(propStartTime || Date.now());
			setElapsedTime(0);
			setCompleted(false);
			setCurrentPlacement(new Array(inputData.numSlots).fill(null));
			setSelectedEntity(null);
			setIsCorrect(false);
			setPlacementCount(0);
			hasAttemptedRef.current = false;
		}

		// Set up new timer
		const newStartTime = propStartTime || Date.now();
		setStartTime(newStartTime);
		timerIntervalRef.current = setInterval(() => {
			setElapsedTime(Math.floor((Date.now() - newStartTime) / 1000));
		}, 1000);

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
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
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
			<View style={styles.header}>
				<View style={styles.headerRow}>
					<Ionicons
						name="trophy"
						size={24}
						color={Colors.primary}
					/>
					<Text style={styles.title}>Sequencing</Text>
				</View>
				<View style={styles.headerInfo}>
					<Text style={styles.infoText}>Placements: {placementCount}</Text>
					<Text style={styles.infoText}>⏱️ {formatTime(elapsedTime)}</Text>
				</View>
			</View>

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
		marginBottom: Spacing.md,
	},
	headerRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: Spacing.xs,
		gap: Spacing.xs,
	},
	title: {
		...Typography.h2,
		color: Colors.text,
		flex: 1,
	},
	headerInfo: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	infoText: {
		...Typography.body,
		color: "#CCCCCC",
		fontSize: 16,
		fontWeight: "500",
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
		fontSize: 16,
		fontWeight: "600",
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
		fontSize: 14,
		fontWeight: "500",
	},
	ruleTextViolated: {
		color: "#FF4444",
		fontWeight: "700",
		fontSize: 15,
	},
	slotsContainer: {
		marginBottom: Spacing.md,
	},
	sectionLabel: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		marginBottom: Spacing.xs,
		fontSize: 16,
		fontWeight: "600",
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
		fontSize: 12,
		marginBottom: Spacing.xs,
		fontWeight: "500",
	},
	slotEntity: {
		...Typography.bodyBold,
		color: "#FFFFFF",
		fontSize: 16,
		textAlign: "center",
		fontWeight: "600",
	},
	slotEmpty: {
		...Typography.body,
		color: "#888888",
		fontSize: 13,
		fontStyle: "italic",
		fontWeight: "500",
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
		fontSize: 16,
		fontWeight: "600",
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
		fontSize: 14,
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
		fontWeight: "600",
	},
});

export default SequencingGame;

