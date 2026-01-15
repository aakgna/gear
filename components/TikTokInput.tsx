import React, { useState } from "react";
import {
	View,
	TextInput,
	Text,
	StyleSheet,
	TextInputProps,
} from "react-native";
import {
	Colors,
	Typography,
	Spacing,
	BorderRadius,
	Shadows,
} from "../constants/DesignSystem";

interface TikTokInputProps extends TextInputProps {
	label?: string;
	error?: string;
	containerStyle?: any;
}

const TikTokInput: React.FC<TikTokInputProps> = ({
	label,
	error,
	containerStyle,
	style,
	...props
}) => {
	const [isFocused, setIsFocused] = useState(false);

	return (
		<View style={[styles.container, containerStyle]}>
			{label && <Text style={styles.label}>{label}</Text>}
			<View
				style={[
					styles.inputContainer,
					isFocused && styles.inputFocused,
					error && styles.inputError,
				]}
			>
				<TextInput
					style={[styles.input, style]}
					placeholderTextColor={Colors.text.secondary}
					onFocus={(e) => {
						setIsFocused(true);
						props.onFocus?.(e);
					}}
					onBlur={(e) => {
						setIsFocused(false);
						props.onBlur?.(e);
					}}
					{...props}
				/>
			</View>
			{error && <Text style={styles.errorText}>{error}</Text>}
		</View>
	);
};

const styles = StyleSheet.create({
	container: {
		marginBottom: Spacing.md,
	},
	label: {
		fontSize: Typography.fontSize.caption,
		fontWeight: Typography.fontWeight.medium,
		color: Colors.text.primary,
		marginBottom: Spacing.xs,
	},
	inputContainer: {
		height: 52,
		borderRadius: BorderRadius.md,
		borderWidth: 1,
		borderColor: Colors.border,
		backgroundColor: Colors.background.primary,
		paddingHorizontal: Spacing.md,
		justifyContent: "center",
	},
	inputFocused: {
		borderColor: Colors.accent,
		borderWidth: 2,
		...Shadows.light,
	},
	inputError: {
		borderColor: Colors.error,
	},
	input: {
		flex: 1,
		fontSize: Typography.fontSize.body,
		color: Colors.text.primary,
		padding: 0,
	},
	errorText: {
		fontSize: Typography.fontSize.small,
		color: Colors.error,
		marginTop: Spacing.xs,
	},
});

export default React.memo(TikTokInput);

