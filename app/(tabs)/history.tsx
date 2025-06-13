import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { router } from "expo-router";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react-native";

export default function HistoryScreen() {
  // Example historical questions
  const pastQuestions = [
    {
      id: "1",
      text: "Should social media platforms be responsible for moderating misinformation?",
      date: "July 2, 2024",
      agreePercentage: 65,
      disagreePercentage: 35,
      totalResponses: 243,
      hasCommonGround: true,
    },
    {
      id: "2",
      text: "Is cryptocurrency the future of global finance?",
      date: "June 28, 2024",
      agreePercentage: 48,
      disagreePercentage: 52,
      totalResponses: 187,
      hasCommonGround: true,
    },
    {
      id: "3",
      text: "Should remote work become the standard for office jobs post-pandemic?",
      date: "June 25, 2024",
      agreePercentage: 72,
      disagreePercentage: 28,
      totalResponses: 312,
      hasCommonGround: true,
    },
    {
      id: "4",
      text: "Should college education be free for all citizens?",
      date: "June 20, 2024",
      agreePercentage: 58,
      disagreePercentage: 42,
      totalResponses: 278,
      hasCommonGround: false,
    },
  ];

  const handleQuestionPress = (questionId: string) => {
    router.push({
      pathname: "/expanded",
      params: { questionId },
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Previous Questions</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {pastQuestions.map((question, index) => (
          <Animated.View
            key={question.id}
            entering={SlideInRight.delay(index * 100).duration(400)}
          >
            <Pressable
              style={({ pressed }) => [
                styles.questionCard,
                { opacity: pressed ? 0.9 : 1 },
              ]}
              onPress={() => handleQuestionPress(question.id)}
            >
              <LinearGradient
                colors={["#222222", "#1A1A1A"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.cardGradient}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.dateText}>{question.date}</Text>
                  {question.hasCommonGround && (
                    <View style={styles.commonGroundBadge}>
                      <MessageCircle size={12} color="#9D00FF" />
                      <Text style={styles.badgeText}>Common Ground</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.questionText} numberOfLines={3}>
                  {question.text}
                </Text>

                <View style={styles.resultsContainer}>
                  <View style={styles.progressBackground}>
                    <View
                      style={[
                        styles.progressForeground,
                        { width: `${question.agreePercentage}%` },
                      ]}
                    >
                      <LinearGradient
                        colors={["#9D00FF", "#6A0DAD"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.progressGradient}
                      />
                    </View>
                  </View>

                  <View style={styles.resultsFooter}>
                    <View style={styles.resultItem}>
                      <ThumbsUp size={16} color="#9D00FF" />
                      <Text style={styles.resultText}>
                        {question.agreePercentage}%
                      </Text>
                    </View>

                    <Text style={styles.responsesText}>
                      {question.totalResponses} responses
                    </Text>

                    <View style={styles.resultItem}>
                      <Text style={styles.resultText}>
                        {question.disagreePercentage}%
                      </Text>
                      <ThumbsDown size={16} color="#777777" />
                    </View>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.viewDetailsText}>View Details</Text>
                  <ChevronRight size={20} color="#9D00FF" />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
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
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 30,
  },
  questionCard: {
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333333",
    overflow: "hidden",
  },
  cardGradient: {
    padding: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  dateText: {
    fontSize: 14,
    color: "#999999",
    fontFamily: "Inter-Regular",
  },
  commonGroundBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#9D00FF20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    color: "#9D00FF",
    marginLeft: 4,
    fontFamily: "Inter-Medium",
  },
  questionText: {
    fontSize: 18,
    color: "#ffffff",
    marginBottom: 16,
    lineHeight: 26,
    fontFamily: "Inter-Bold",
  },
  resultsContainer: {
    marginBottom: 16,
  },
  progressBackground: {
    height: 8,
    backgroundColor: "#333333",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressForeground: {
    height: "100%",
    borderRadius: 4,
  },
  progressGradient: {
    width: "100%",
    height: "100%",
  },
  resultsFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  resultText: {
    fontSize: 14,
    color: "#E6E6FA",
    marginHorizontal: 6,
    fontFamily: "Inter-Medium",
  },
  responsesText: {
    fontSize: 14,
    color: "#999999",
    fontFamily: "Inter-Regular",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  viewDetailsText: {
    fontSize: 16,
    color: "#9D00FF",
    marginRight: 4,
    fontFamily: "Inter-Medium",
  },
});
