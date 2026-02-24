import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export type ToastType =
	| "info"
	| "success"
	| "warning"
	| "error"
	| "coming-soon";

interface CustomToastProps {
	visible: boolean;
	message: string;
	type?: ToastType;
	duration?: number;
	onHide?: () => void;
	icon?: keyof typeof Ionicons.glyphMap;
}

const getToastConfig = (type: ToastType) => {
	switch (type) {
		case "success":
			return {
				icon: "checkmark-circle" as const,
				backgroundColor: Colors.game.correct + "E6",
				iconColor: Colors.text.white,
			};
		case "error":
			return {
				icon: "close-circle" as const,
				backgroundColor: Colors.error + "E6",
				iconColor: Colors.text.white,
			};
		case "warning":
			return {
				icon: "warning" as const,
				backgroundColor: Colors.secondaryAccent + "E6",
				iconColor: Colors.background.primary,
			};
		case "coming-soon":
			return {
				icon: "rocket" as const,
				backgroundColor: Colors.accent + "E6",
				iconColor: Colors.text.white,
			};
		case "info":
		default:
			return {
				icon: "information-circle" as const,
				backgroundColor: Colors.background.primary + "F5",
				iconColor: Colors.accent,
			};
	}
};

const CustomToast: React.FC<CustomToastProps> = ({
	visible,
	message,
	type = "info",
	duration = 2500,
	onHide,
	icon,
}) => {
	const translateY = useRef(new Animated.Value(-100)).current;
	const opacity = useRef(new Animated.Value(0)).current;

	const config = getToastConfig(type);
	const displayIcon = icon || config.icon;
	const textColor = type === "info" ? Colors.text.primary : Colors.text.white;

	useEffect(() => {
		if (visible) {
			// Slide in
			Animated.parallel([
				Animated.spring(translateY, {
					toValue: 0,
					useNativeDriver: true,
					tension: 80,
					friction: 10,
				}),
				Animated.timing(opacity, {
					toValue: 1,
					duration: 200,
					useNativeDriver: true,
				}),
			]).start();

			// Auto hide after duration
			const timeout = setTimeout(() => {
				hideToast();
			}, duration);

			return () => clearTimeout(timeout);
		}
	}, [visible]);

	const hideToast = () => {
		Animated.parallel([
			Animated.timing(translateY, {
				toValue: -100,
				duration: 250,
				useNativeDriver: true,
			}),
			Animated.timing(opacity, {
				toValue: 0,
				duration: 200,
				useNativeDriver: true,
			}),
		]).start(() => {
			onHide?.();
		});
	};

	if (!visible) return null;

	return (
		<Animated.View
			style={[
				styles.container,
				{
					backgroundColor: config.backgroundColor,
					transform: [{ translateY }],
					opacity,
				},
			]}
		>
			<View style={styles.content}>
				<View style={styles.iconContainer}>
					<Ionicons name={displayIcon} size={24} color={config.iconColor} />
				</View>
				<View style={styles.textContainer}>
					{type === "coming-soon" && (
						<Text style={[styles.labelText, { color: textColor }]}>
							Coming Soon
						</Text>
					)}
					<Text style={[styles.messageText, { color: textColor }]}>
						{message}
					</Text>
				</View>
			</View>
			<View style={styles.progressBar}>
				<Animated.View
					style={[
						styles.progressFill,
						{
							width: "100%",
						},
					]}
				/>
			</View>
		</Animated.View>
	);
};

const styles = StyleSheet.create({
	container: {
		position: "absolute",
		top: 60,
		left: Spacing.lg,
		right: Spacing.lg,
		borderRadius: BorderRadius.lg,
		overflow: "hidden",
		zIndex: 9999,
		...Shadows.heavy,
	},
	content: {
		flexDirection: "row",
		alignItems: "center",
		padding: Spacing.md,
		gap: Spacing.md,
	},
	iconContainer: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: Colors.accent + "20",
		alignItems: "center",
		justifyContent: "center",
	},
	textContainer: {
		flex: 1,
	},
	labelText: {
		fontSize: Typography.fontSize.small,
		fontWeight: Typography.fontWeight.bold,
		textTransform: "uppercase",
		letterSpacing: 1,
		opacity: 0.8,
		marginBottom: Spacing.xs,
	},
	messageText: {
		fontSize: Typography.fontSize.body,
		fontWeight: Typography.fontWeight.medium,
	},
	progressBar: {
		height: 3,
		backgroundColor: Colors.background.tertiary,
	},
	progressFill: {
		height: "100%",
		backgroundColor: Colors.accent,
	},
});

export default CustomToast;

// Toast Context for global usage
import { createContext, useContext, useState, ReactNode } from "react";

interface ToastContextType {
	showToast: (
		message: string,
		type?: ToastType,
		icon?: keyof typeof Ionicons.glyphMap
	) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({
	children,
}) => {
	const [toastState, setToastState] = useState({
		visible: false,
		message: "",
		type: "info" as ToastType,
		icon: undefined as keyof typeof Ionicons.glyphMap | undefined,
	});

	const showToast = (
		message: string,
		type: ToastType = "info",
		icon?: keyof typeof Ionicons.glyphMap
	) => {
		setToastState({
			visible: true,
			message,
			type,
			icon,
		});
	};

	const hideToast = () => {
		setToastState((prev) => ({ ...prev, visible: false }));
	};

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			<CustomToast
				visible={toastState.visible}
				message={toastState.message}
				type={toastState.type}
				icon={toastState.icon}
				onHide={hideToast}
			/>
		</ToastContext.Provider>
	);
};

export const useToast = () => {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
};

