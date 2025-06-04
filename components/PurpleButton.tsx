import { Text, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

interface PurpleButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
  variant?: "primary" | "secondary" | "outline";
}

export default function PurpleButton({
  title,
  onPress,
  disabled = false,
  fullWidth = true,
  variant = "primary",
}: PurpleButtonProps) {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 10 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 10 });
  };

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const getColors = () => {
    if (disabled) return ["#555555", "#333333"];

    switch (variant) {
      case "secondary":
        return ["#333333", "#222222"];
      case "outline":
        return ["transparent", "transparent"];
      case "primary":
      default:
        return ["#9D00FF", "#6A0DAD"];
    }
  };

  return (
    <Animated.View
      style={[styles.container, fullWidth && styles.fullWidth, animatedStyle]}
    >
      <Pressable
        style={({ pressed }) => [
          styles.button,
          variant === "outline" && styles.outlineButton,
          { opacity: pressed ? 0.9 : 1 },
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
      >
        <LinearGradient
          colors={getColors() as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientButton}
        >
          <Text
            style={[
              styles.buttonText,
              variant === "outline" && styles.outlineButtonText,
              disabled && styles.disabledText,
            ]}
          >
            {title}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: "hidden",
  },
  fullWidth: {
    width: "100%",
  },
  button: {
    elevation: 4,
  },
  outlineButton: {
    borderWidth: 1,
    borderColor: "#9D00FF",
    borderRadius: 12,
  },
  gradientButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  outlineButtonText: {
    color: "#9D00FF",
  },
  disabledText: {
    color: "#999999",
  },
});
