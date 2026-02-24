import { useRef, useState } from "react";
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from "react-native-gesture-handler";
import { Dimensions } from "react-native";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export interface DragState {
	isDragging: boolean;
	position: { x: number; y: number };
	startPosition: { x: number; y: number };
}

export interface UseDragAndDropOptions {
	onDragStart?: () => void;
	onDrag?: (position: { x: number; y: number }) => void;
	onDragEnd?: (position: { x: number; y: number }) => void;
	enabled?: boolean;
	snapToGrid?: boolean;
	gridSize?: number;
	bounds?: {
		minX?: number;
		maxX?: number;
		minY?: number;
		maxY?: number;
	};
}

export const useDragAndDrop = (options: UseDragAndDropOptions = {}) => {
	const {
		onDragStart,
		onDrag,
		onDragEnd,
		enabled = true,
		snapToGrid = false,
		gridSize = 10,
		bounds,
	} = options;

	const [dragState, setDragState] = useState<DragState>({
		isDragging: false,
		position: { x: 0, y: 0 },
		startPosition: { x: 0, y: 0 },
	});

	const translateX = useRef(0);
	const translateY = useRef(0);

	const snapToGridValue = (value: number, grid: number): number => {
		return Math.round(value / grid) * grid;
	};

	const constrainToBounds = (
		x: number,
		y: number,
		bounds?: UseDragAndDropOptions["bounds"]
	): { x: number; y: number } => {
		if (!bounds) return { x, y };

		let constrainedX = x;
		let constrainedY = y;

		if (bounds.minX !== undefined) constrainedX = Math.max(constrainedX, bounds.minX);
		if (bounds.maxX !== undefined) constrainedX = Math.min(constrainedX, bounds.maxX);
		if (bounds.minY !== undefined) constrainedY = Math.max(constrainedY, bounds.minY);
		if (bounds.maxY !== undefined) constrainedY = Math.min(constrainedY, bounds.maxY);

		return { x: constrainedX, y: constrainedY };
	};

	const panGesture = Gesture.Pan()
		.enabled(enabled)
		.onStart(() => {
			setDragState((prev) => ({
				...prev,
				isDragging: true,
				startPosition: { x: translateX.current, y: translateY.current },
			}));
			onDragStart?.();
		})
		.onUpdate((e) => {
			let newX = translateX.current + e.translationX;
			let newY = translateY.current + e.translationY;

			// Apply snap to grid if enabled
			if (snapToGrid) {
				newX = snapToGridValue(newX, gridSize);
				newY = snapToGridValue(newY, gridSize);
			}

			// Apply bounds constraints
			const constrained = constrainToBounds(newX, newY, bounds);
			newX = constrained.x;
			newY = constrained.y;

			translateX.current = newX;
			translateY.current = newY;

			setDragState((prev) => ({
				...prev,
				position: { x: newX, y: newY },
			}));

			onDrag?.({ x: newX, y: newY });
		})
		.onEnd(() => {
			setDragState((prev) => ({
				...prev,
				isDragging: false,
			}));
			onDragEnd?.({ x: translateX.current, y: translateY.current });
		});

	const resetPosition = () => {
		translateX.current = 0;
		translateY.current = 0;
		setDragState({
			isDragging: false,
			position: { x: 0, y: 0 },
			startPosition: { x: 0, y: 0 },
		});
	};

	const setPosition = (x: number, y: number) => {
		const constrained = constrainToBounds(x, y, bounds);
		translateX.current = constrained.x;
		translateY.current = constrained.y;
		setDragState((prev) => ({
			...prev,
			position: constrained,
		}));
	};

	return {
		gesture: panGesture,
		dragState,
		translateX: translateX.current,
		translateY: translateY.current,
		resetPosition,
		setPosition,
	};
};

