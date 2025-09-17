import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import Animated, { SlideInRight } from "react-native-reanimated";
import { logScreenView } from "@/analytics/analyticsEvents";
import { LinearGradient } from "expo-linear-gradient";
import {
  ChevronRight,
  MessageCircle,
  ThumbsUp,
  ThumbsDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
// Update Firebase imports to use new modular SDK
import { getAuth } from "@react-native-firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getDoc,
  doc,
} from "@react-native-firebase/firestore";

interface HistoricQuestion {
  id: string;
  text: string;
  date: string;
  agreePercentage: number;
  disagreePercentage: number;
  totalResponses: number;
  hasCommonGround: boolean;
  top: string;
  bottom: string;
}

export default function HistoryScreen() {
  const [historicQuestions, setHistoricQuestions] = useState<
    HistoricQuestion[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreData, setHasMoreData] = useState(true);
  const [lastDoc, setLastDoc] = useState(null);

  // Memoize processed questions to avoid unnecessary re-processing
  const processedQuestions = useMemo(() => {
    return historicQuestions;
  }, [historicQuestions]);

  useEffect(() => {
    (async () => {
      try {
        // Use new modular SDK API
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        await logScreenView("History", uid);
      } catch (error) {
        console.error("Analytics error:", error);
      }
    })();

    const fetchHistoricQuestions = async () => {
      // Set 'today' to the start of the current day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      try {
        // Use new modular SDK API
        const firestore = getFirestore();
        // get user school
        const auth = getAuth();
        const uid = auth.currentUser?.uid;
        if (!uid) return;
        const userDocRef = doc(firestore, "users", uid);
        const userDoc = await getDoc(userDocRef);
        const userData = userDoc.data();
        const school = userData?.school;
        const questionsRef = collection(firestore, "dailyQuestions");
        const q = query(
          questionsRef,
          where("date", "<", today),
          orderBy("date", "desc"),
          limit(20)
        );

        const snapshot = await getDocs(q);

        const questions = snapshot.docs
          .map((doc: any) => {
            const data = doc.data();
            if (data.school !== undefined && data.school == school) {
              const totalResponses =
                (data.topCount || 0) + (data.bottomCount || 0);
              const agreePercentage = totalResponses
                ? Math.round((data.topCount / totalResponses) * 100)
                : 0;
              const disagreePercentage = 100 - agreePercentage;

              return {
                id: doc.id,
                text: data.question,
                date: data.date?.toDate().toLocaleDateString() || "",
                agreePercentage,
                disagreePercentage,
                totalResponses,
                hasCommonGround:
                  Array.isArray(data.commonGroundNotes) &&
                  data.commonGroundNotes.length > 0,
                top: data.top,
                bottom: data.bottom,
              };
            } else if (data.school == undefined) {
              const totalResponses =
                (data.topCount || 0) + (data.bottomCount || 0);
              const agreePercentage = totalResponses
                ? Math.round((data.topCount / totalResponses) * 100)
                : 0;
              const disagreePercentage = 100 - agreePercentage;

              return {
                id: doc.id,
                text: data.question,
                date: data.date?.toDate().toLocaleDateString() || "",
                agreePercentage,
                disagreePercentage,
                totalResponses,
                hasCommonGround:
                  Array.isArray(data.commonGroundNotes) &&
                  data.commonGroundNotes.length > 0,
                top: data.top,
                bottom: data.bottom,
              };
            }
            return null; // Return null for questions that don't match the school
          })
          .filter((question: HistoricQuestion | null) => question !== null); // Filter out null values

        // Update pagination state
        setHistoricQuestions(questions);
        setHasMoreData(snapshot.docs.length === 20);
        if (snapshot.docs.length > 0) {
          setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
        }
        setCurrentPage(1);
      } catch (error) {
        console.error("Error fetching historic questions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistoricQuestions();
  }, []);

  const loadMoreQuestions = async () => {
    if (isLoadingMore || !hasMoreData || !lastDoc) return;

    setIsLoadingMore(true);

    try {
      const firestore = getFirestore();
      const auth = getAuth();
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      const userDocRef = doc(firestore, "users", uid);
      const userDoc = await getDoc(userDocRef);
      const userData = userDoc.data();
      const school = userData?.school;

      const questionsRef = collection(firestore, "dailyQuestions");
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const q = query(
        questionsRef,
        where("date", "<", today),
        orderBy("date", "desc"),
        startAfter(lastDoc),
        limit(20)
      );

      const snapshot = await getDocs(q);

      const newQuestions = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          // Skip questions that don't match the user's school
          if (data.school !== undefined && data.school !== school) {
            return null;
          }

          const totalResponses = (data.topCount || 0) + (data.bottomCount || 0);
          const agreePercentage = totalResponses
            ? Math.round((data.topCount / totalResponses) * 100)
            : 0;
          const disagreePercentage = 100 - agreePercentage;

          return {
            id: doc.id,
            text: data.question,
            date: data.date?.toDate().toLocaleDateString() || "",
            agreePercentage,
            disagreePercentage,
            totalResponses,
            hasCommonGround:
              Array.isArray(data.commonGroundNotes) &&
              data.commonGroundNotes.length > 0,
            top: data.top,
            bottom: data.bottom,
          };
        })
        .filter((question: HistoricQuestion | null) => question !== null); // Filter out null values

      // Update state with new questions
      setHistoricQuestions((prev) => [...prev, ...newQuestions]);
      setHasMoreData(snapshot.docs.length === 20);
      if (snapshot.docs.length > 0) {
        setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      }
      setCurrentPage((prev) => prev + 1);
    } catch (error) {
      console.error("Error loading more questions:", error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleQuestionPress = (questionId: string) => {
    router.push({
      pathname: "/expanded",
      params: { questionId },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={["#120318", "#1C0529"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#9D00FF" />
        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Previous Questions</Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {processedQuestions.map((question, index) => (
          <Animated.View
            key={question.id}
            entering={SlideInRight.delay(index * 20).duration(200)}
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
                      {/* <Text style={styles.resultText}>
												{question.top || "Top"}:
											</Text> */}
                      <ArrowLeft size={16} color="#E6E6FA" />
                      <Text style={styles.resultText}>
                        {question.agreePercentage}%
                      </Text>
                    </View>

                    <Text style={styles.responsesText}>
                      {question.totalResponses} responses
                    </Text>

                    <View style={styles.resultItem}>
                      {/* <Text style={styles.resultText}>
												{question.bottom || "Bottom"}:
											</Text> */}
                      <Text style={styles.resultText}>
                        {question.disagreePercentage}%
                      </Text>
                      <ArrowRight size={16} color="#E6E6FA" />
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
        {/* Pagination UI */}
        {!isLoading && processedQuestions.length > 0 && (
          <View style={styles.paginationContainer}>
            {isLoadingMore ? (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color="#9D00FF" />
                <Text style={styles.loadingMoreText}>
                  Loading more questions...
                </Text>
              </View>
            ) : hasMoreData ? (
              <Pressable
                style={styles.loadMoreButton}
                onPress={loadMoreQuestions}
              >
                <LinearGradient
                  colors={["#9D00FF", "#6A0DAD"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.loadMoreGradient}
                >
                  <Text style={styles.loadMoreText}>Load More</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={styles.endContainer}>
                <Text style={styles.endText}>You've reached the end</Text>
              </View>
            )}
          </View>
        )}
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
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 30,
    color: "#ffffff",
    fontFamily: "Inter-Bold",
    fontWeight: "bold",
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
    marginHorizontal: 2,
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#9D00FF",
    fontSize: 16,
    marginTop: 16,
    fontFamily: "Inter-Medium",
  },
  paginationContainer: {
    marginTop: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  loadMoreButton: {
    borderRadius: 25,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadMoreGradient: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreText: {
    color: "#ffffff",
    fontSize: 16,
    fontFamily: "Inter-Bold",
    fontWeight: "bold",
  },
  loadingMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  loadingMoreText: {
    color: "#9D00FF",
    fontSize: 14,
    fontFamily: "Inter-Medium",
    marginLeft: 10,
  },
  endContainer: {
    paddingVertical: 20,
    alignItems: "center",
  },
  endText: {
    color: "#666666",
    fontSize: 14,
    fontFamily: "Inter-Regular",
    fontStyle: "italic",
  },
});
