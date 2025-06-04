import { View, Text, StyleSheet, Pressable } from "react-native";
import { router } from "expo-router";
import { useState } from "react";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut } from "lucide-react-native";

export default function TopicScreen() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const agreeScale = useSharedValue(1);
  const disagreeScale = useSharedValue(1);

  const handleOptionSelect = (option: string) => {
    setSelectedOption(option);

    if (option === "agree") {
      agreeScale.value = withSpring(1.05, { damping: 15 }, () => {
        agreeScale.value = withSpring(1);
      });
    } else {
      disagreeScale.value = withSpring(1.05, { damping: 15 }, () => {
        disagreeScale.value = withSpring(1);
      });
    }

    setTimeout(() => {
      router.push("/(tabs)/results");
    }, 500);
  };

  const agreeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: agreeScale.value }],
  }));

  const disagreeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disagreeScale.value }],
  }));

  const handleLogout = () => {
    router.replace("/(auth)");
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Today's Topic</Text>

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

        <View style={styles.optionsContainer}>
          <Animated.View style={agreeAnimatedStyle}>
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                selectedOption === "agree" && styles.selectedOption,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => handleOptionSelect("agree")}
              disabled={selectedOption !== null}
            >
              <LinearGradient
                colors={
                  selectedOption === "agree"
                    ? ["#9D00FF", "#6A0DAD"]
                    : ["#333333", "#222222"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.optionGradient}
              >
                <Text style={styles.optionText}>Agree</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          <Animated.View style={disagreeAnimatedStyle}>
            <Pressable
              style={({ pressed }) => [
                styles.optionButton,
                selectedOption === "disagree" && styles.selectedOption,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => handleOptionSelect("disagree")}
              disabled={selectedOption !== null}
            >
              <LinearGradient
                colors={
                  selectedOption === "disagree"
                    ? ["#9D00FF", "#6A0DAD"]
                    : ["#333333", "#222222"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.optionGradient}
              >
                <Text style={styles.optionText}>Disagree</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Choose carefully - your response contributes to finding common
            ground
          </Text>
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
    justifyContent: "center",
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
  optionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  optionButton: {
    flex: 1,
    borderRadius: 28,
    overflow: "hidden",
    marginHorizontal: 8,
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  optionGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: "Inter-Bold",
  },
  selectedOption: {
    borderWidth: 2,
    borderColor: "#9D00FF",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 24,
    right: 24,
    alignItems: "center",
  },
  footerText: {
    color: "#999999",
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
});
