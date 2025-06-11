// StartPage.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  AppState,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { LogOut } from "lucide-react-native";

const StartPage = () => {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [hasVoted, setHasVoted] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [agreeCount, setAgreeCount] = useState(0);
  const [disagreeCount, setDisagreeCount] = useState(0);
  const [strikes, setStrikes] = useState(0);
  const [answer, setAnswer] = useState(false);

  // animation hooks
  const agreeScale = useSharedValue(1);
  const disagreeScale = useSharedValue(1);
  const agreeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: agreeScale.value }],
  }));
  const disagreeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: disagreeScale.value }],
  }));

  // AppState refetch
  function useAppState() {
    const [state, setState] = useState(AppState.currentState);
    useEffect(() => {
      const sub = AppState.addEventListener("change", setState);
      return () => sub.remove();
    }, []);
    return state;
  }
  const app = useAppState();
  useEffect(() => {
    if (app === "active") {
      fetchDailyQuestion();
      checkUserVote();
    }
  }, [app]);

  // initial load
  useEffect(() => {
    if (!auth().currentUser) {
      router.replace("/");
      return;
    }
    fetchDailyQuestion();
    checkUserVote();

    const uid = auth().currentUser?.uid;
    if (!uid) return;
    const unsub = firestore()
      .collection("users")
      .doc(uid)
      .onSnapshot((doc) => {
        const data = doc.data();
        if (data?.strikes !== undefined) {
          setStrikes(data.strikes);
        }
      });
    return () => unsub();
  }, []);

  // fetch today's question
  const fetchDailyQuestion = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const snap = await firestore()
        .collection("dailyQuestions")
        .where("date", ">=", today)
        .where("date", "<", new Date(today.setUTCHours(24)))
        .orderBy("date", "asc")
        .limit(1)
        .get();

      if (!snap.empty) {
        const data = snap.docs[0].data();
        setQuestion(data.question);
        setAgreeCount(data.agreeCount || 0);
        setDisagreeCount(data.disagreeCount || 0);
        setAnswer(data.answer);
      } else {
        setQuestion("No question available for today");
      }
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load today's question");
    } finally {
      setIsLoading(false);
    }
  };

  // check if user has voted today
  const checkUserVote = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;

    try {
      const userDoc = await firestore().collection("users").doc(uid).get();
      const data = userDoc.data();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (data?.updatedAt) {
        const lastDate = data.updatedAt.substring(0, 10);
        const todayStr = today.toISOString().substring(0, 10);
        if (!data.voted || lastDate !== todayStr) {
          await userDoc.ref.update({ voted: false, messages: 3 });
          setHasVoted(false);
        } else {
          setHasVoted(true);
        }
      } else {
        setHasVoted(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // handle vote press
  const handleVote = async (choice: "agree" | "disagree") => {
    const uid = auth().currentUser?.uid;
    if (!uid) {
      Alert.alert("Error", "You must be logged in to vote");
      router.replace("/");
      return;
    }

    // animate
    if (choice === "agree") {
      agreeScale.value = withSpring(
        1.05,
        { damping: 15 },
        () => (agreeScale.value = withSpring(1))
      );
    } else {
      disagreeScale.value = withSpring(
        1.05,
        { damping: 15 },
        () => (disagreeScale.value = withSpring(1))
      );
    }
    setSelectedOption(choice);
    setIsLoading(true);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const qSnap = await firestore()
        .collection("dailyQuestions")
        .where("date", ">=", today)
        .limit(1)
        .get();

      if (!qSnap.empty) {
        const qDoc = qSnap.docs[0];
        const batch = firestore().batch();
        const field = choice === "agree" ? "agreeCount" : "disagreeCount";

        batch.update(qDoc.ref, {
          [field]: firestore.FieldValue.increment(1),
        });
        const uRef = firestore().collection("users").doc(uid);
        batch.set(
          uRef,
          {
            voted: true,
            updatedAt: today.toISOString().split("T")[0],
            strikes: 3,
            messages: 3,
          },
          { merge: true }
        );
        await batch.commit();

        const updated = await qDoc.ref.get();
        const data = updated.data()!;
        setAgreeCount(data.agreeCount);
        setDisagreeCount(data.disagreeCount);
        setHasVoted(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  // logout
  const handleLogout = async () => {
    try {
      await auth().signOut();
      router.replace("/");
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to sign out");
    }
  };

  // discussion nav
  const handleDiscussionNavigation = async () => {
    try {
      const uid = auth().currentUser?.uid;
      if (!uid) return;
      const userDoc = await firestore().collection("users").doc(uid).get();
      const data = userDoc.data();
      if (!data || data.strikes === undefined) {
        Alert.alert("Error", "User data not found.");
        return;
      }
      if (data.strikes <= 0) {
        Alert.alert(
          "Access Denied",
          "You have been restricted from discussions due to too many reports."
        );
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const qSnap = await firestore()
        .collection("dailyQuestions")
        .where("date", ">=", today)
        .orderBy("date", "asc")
        .limit(1)
        .get();
      if (qSnap.empty) {
        Alert.alert("No question available for today");
        return;
      }
      const doc = qSnap.docs[0];
      router.push({
        pathname: "/discussion",
        params: { question: doc.data().question, questionId: doc.id },
      });
    } catch (e) {
      console.error(e);
    }
  };

  // compute percentages
  const totalVotes = agreeCount + disagreeCount;
  const agreePct = totalVotes > 0 ? (agreeCount / totalVotes) * 100 : 0;
  const disagreePct = totalVotes > 0 ? (disagreeCount / totalVotes) * 100 : 0;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Today's Topic</Text>
          <Pressable style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutText}>Logout</Text>
            <LogOut size={16} color="#E6E6FA" />
          </Pressable>
        </View>
      </View>

      {/* Content */}
      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <View style={styles.questionContainer}>
          <LinearGradient
            colors={["#9D00FF20", "#6A0DAD20"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.topicCard}
          >
            <Text style={styles.topicText}>{question}</Text>
          </LinearGradient>

          {hasVoted ? (
            <>
              {/* Results */}
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Results</Text>
                <View style={styles.barContainer}>
                  <View style={[styles.bar, { width: `${agreePct}%` }]} />
                </View>
                <View style={styles.resultsTextContainer}>
                  <Text style={styles.resultsText}>
                    {answer ? "Agree" : "Agree"}: {agreePct.toFixed(1)}% (
                    {agreeCount})
                  </Text>
                  <Text style={styles.resultsText}>
                    {answer ? "Disagree" : "Disagree"}: {disagreePct.toFixed(1)}
                    % ({disagreeCount})
                  </Text>
                </View>
              </View>

              {/* Join Discussion */}
              <Pressable
                style={styles.joinDiscussionButton}
                onPress={handleDiscussionNavigation}
              >
                <Text style={styles.discussionButtonText}>Join Discussion</Text>
                <Text style={styles.underDiscussionButtonText}>
                  Max 3 Messages Per Day
                </Text>
                <Text style={styles.strikesText}>
                  Strikes Remaining: {strikes}
                </Text>
              </Pressable>
            </>
          ) : (
            /* Voting Options */
            <View style={styles.optionsContainer}>
              <Animated.View style={[styles.optionWrapper, agreeAnimatedStyle]}>
                <Pressable
                  style={({ pressed }) => [
                    styles.optionButton,
                    selectedOption === "agree" && styles.selectedOption,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={() => handleVote("agree")}
                  disabled={!!selectedOption}
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
                    <Text style={styles.optionText}>
                      {answer ? "Agree" : "Agree"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>

              <Animated.View
                style={[styles.optionWrapper, disagreeAnimatedStyle]}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.optionButton,
                    selectedOption === "disagree" && styles.selectedOption,
                    { opacity: pressed ? 0.9 : 1 },
                  ]}
                  onPress={() => handleVote("disagree")}
                  disabled={!!selectedOption}
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
                    <Text style={styles.optionText}>
                      {answer ? "Disagree" : "Disagree"}
                    </Text>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Choose carefully – your response contributes to finding common
            ground
          </Text>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#121212",
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
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
    paddingVertical: 8,
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
    justifyContent: "space-between",
  },
  questionContainer: { flex: 1, justifyContent: "center" },
  topicCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
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
    flexDirection: "column",
    gap: 16,
    paddingHorizontal: 24,
  },
  optionWrapper: { width: "100%" },
  optionButton: {
    borderRadius: 28,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
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
  resultsContainer: {
    marginTop: 20,
    width: "100%",
    alignItems: "center",
  },
  resultsTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    marginBottom: 15,
  },
  barContainer: {
    width: "90%",
    height: 20,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    overflow: "hidden",
    marginVertical: 10,
  },
  bar: {
    height: "100%",
    backgroundColor: "#8A2BE2",
  },
  resultsTextContainer: {
    width: "90%",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  resultsText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  joinDiscussionButton: {
    backgroundColor: "#1A1A1A",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 30,
    borderWidth: 1,
    borderColor: "#BF5FFF",
  },
  discussionButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
    padding: 5,
  },
  underDiscussionButtonText: {
    color: "#BF5FFF",
    fontSize: 12,
    fontWeight: "600",
  },
  strikesText: {
    color: "#BF5FFF",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 4,
  },
  footer: { paddingBottom: 40, alignItems: "center" },
  footerText: {
    color: "#999999",
    textAlign: "center",
    fontSize: 14,
    fontFamily: "Inter-Regular",
  },
});

export default StartPage;
