import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  FadeIn,
} from "react-native-reanimated";
import { useEffect } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react-native";

interface ResultsBarProps {
  agreePercentage: number;
  disagreePercentage: number;
  totalVotes: number;
  showLabel?: boolean;
  compact?: boolean;
}

export default function ResultsBar({
  agreePercentage,
  disagreePercentage,
  totalVotes,
  showLabel = true,
  compact = false,
}: ResultsBarProps) {
  const progressValue = useSharedValue(0);

  useEffect(() => {
    progressValue.value = withTiming(agreePercentage / 100, { duration: 1000 });
  }, [agreePercentage]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressValue.value * 100}%`,
    };
  });

  return (
    <Animated.View entering={FadeIn.duration(600)} style={styles.container}>
      {showLabel && <Text style={styles.resultsTitle}>Results</Text>}

      <View style={styles.progressContainer}>
        <View
          style={[styles.progressBackground, compact && styles.progressCompact]}
        >
          <Animated.View style={[styles.progressForeground, progressStyle]}>
            <LinearGradient
              colors={["#9D00FF", "#6A0DAD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.progressGradient}
            />
          </Animated.View>
        </View>

        <View style={styles.resultsTextContainer}>
          <View style={styles.resultItem}>
            <ThumbsUp size={16} color="#9D00FF" />
            <Text style={styles.resultText}>
              {agreePercentage.toFixed(1)}% (
              {Math.round((totalVotes * agreePercentage) / 100)})
            </Text>
          </View>

          {!compact && (
            <Text style={styles.responsesText}>
              {totalVotes} {totalVotes === 1 ? "response" : "responses"}
            </Text>
          )}

          <View style={styles.resultItem}>
            <Text style={styles.resultText}>
              {disagreePercentage.toFixed(1)}% (
              {Math.round((totalVotes * disagreePercentage) / 100)})
            </Text>
            <ThumbsDown size={16} color="#777777" />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 30,
  },
  resultsTitle: {
    fontSize: 24,
    color: "#ffffff",
    marginBottom: 20,
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  progressContainer: {
    width: "100%",
  },
  progressBackground: {
    height: 12,
    backgroundColor: "#333333",
    borderRadius: 6,
    overflow: "hidden",
  },
  progressCompact: {
    height: 8,
  },
  progressForeground: {
    height: "100%",
    borderRadius: 6,
  },
  progressGradient: {
    width: "100%",
    height: "100%",
  },
  resultsTextContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultText: {
    color: "#E6E6FA",
    fontSize: 14,
    marginHorizontal: 6,
    fontFamily: "Inter-Medium",
  },
  responsesText: {
    color: "#999999",
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
});
