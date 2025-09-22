import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeIn } from "react-native-reanimated";

interface TopicCardProps {
  question: string;
  date?: string;
}

export default function TopicCard({ question, date }: TopicCardProps) {
  return (
    <Animated.View entering={FadeIn.duration(600)}>
      <LinearGradient
        colors={["#9D00FF20", "#6A0DAD20"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topicCard}
      >
        {date && <Text style={styles.dateText}>{date}</Text>}
        <Text style={styles.topicText}>{question}</Text>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topicCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: "#9D00FF40",
  },
  dateText: {
    fontSize: 14,
    color: "#999999",
    marginBottom: 12,
    fontFamily: "Inter-Regular",
  },
  topicText: {
    fontSize: 24,
    color: "#ffffff",
    textAlign: "center",
    lineHeight: 34,
    fontFamily: "Inter-Bold",
  },
});
