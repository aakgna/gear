import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut, MessageCircle } from "lucide-react-native";

export default function ResultsScreen() {
  const progressValue = useSharedValue(0);

  // Simulate results data
  const results = {
    agree: 90,
    disagree: 10,
    totalVotes: 10,
  };

  // Animate progress bar on component mount
  useState(() => {
    progressValue.value = withTiming(results.agree / 100, { duration: 1500 });
  });

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value * 100}%`,
  }));

  const handleJoinDiscussion = () => {
    router.push("/discussion");
  };

  const handleLogout = () => {
    router.replace("/");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Results</Text>

          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
            <LogOut size={16} color="#E6E6FA" />
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <LinearGradient
          colors={["#9D00FF20", "#6A0DAD20"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.topicCard}
        >
          <Text style={styles.topicText}>
            Does Congress's nationwide TikTok ban unconstitutionally limit free
            speech and harm American creators' livelihoods?
          </Text>
        </LinearGradient>

        <View style={styles.resultsContainer}>
          <View style={styles.progressContainer}>
            <View style={styles.progressBackground}>
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
              <Text style={styles.resultsText}>
                Agree: {results.agree}% (
                {Math.round((results.totalVotes * results.agree) / 100)})
              </Text>
              <Text style={styles.resultsText}>
                Disagree: {results.disagree}% (
                {Math.round((results.totalVotes * results.disagree) / 100)})
              </Text>
            </View>

            <Text style={styles.totalVotes}>
              Total Responses: {results.totalVotes}
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.discussionButton,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleJoinDiscussion}
          >
            <LinearGradient
              colors={["#9D00FF", "#6A0DAD"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.buttonGradient}
            >
              <MessageCircle
                size={24}
                color="#FFFFFF"
                style={styles.buttonIcon}
              />
              <Text style={styles.buttonText}>Join Discussion</Text>
            </LinearGradient>

            <View style={styles.discussionInfo}>
              <Text style={styles.discussionInfoText}>
                Max 3 Messages Per Day
              </Text>
              <Text style={styles.discussionInfoText}>
                Strikes Remaining: 5
              </Text>
            </View>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 32,
    color: "#ffffff",
    fontFamily: "Inter-Bold",
    fontWeight: "bold",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333333",
    padding: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#444444",
  },
  logoutText: {
    color: "#E6E6FA",
    marginRight: 6,
    fontSize: 14,
    fontFamily: "Inter-Medium",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  topicCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "#9D00FF40",
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  topicText: {
    fontSize: 24,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 34,
    fontFamily: "Inter-Bold",
  },
  resultsContainer: {
    flex: 1,
    alignItems: "center",
  },
  progressContainer: {
    width: "100%",
    marginBottom: 40,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: "#333333",
  },
  progressBackground: {
    height: 12,
    backgroundColor: "#333333",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
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
    marginBottom: 12,
  },
  resultsText: {
    color: "#E6E6FA",
    fontSize: 16,
    fontFamily: "Inter-Medium",
  },
  totalVotes: {
    color: "#999999",
    fontSize: 14,
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  discussionButton: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 16,
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonGradient: {
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  discussionInfo: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    padding: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  discussionInfoText: {
    color: "#9D00FF",
    fontSize: 14,
    fontFamily: "Inter-Medium",
    marginVertical: 2,
  },
});
