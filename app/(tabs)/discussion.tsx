// DiscussionScreen.tsx
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  AppState,
  Pressable,
  Modal,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Flag, Send, X, Heart } from "lucide-react-native";
import type { Dispatch, SetStateAction } from "react";

export default function DiscussionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { question, questionId } = params as {
    question: string;
    questionId: string;
  };

  const [currentQuestion, setCurrentQuestion] = useState(question);
  const [currentQuestionId, setCurrentQuestionId] = useState(questionId);
  const [messages, setMessages] = useState<Array<any>>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const appState = useRef(AppState.currentState);
  const [threadModalVisible, setThreadModalVisible] = useState(false);
  const [threadParentMessage, setThreadParentMessage] = useState<{
    id: string;
    text: string;
    user: string;
  } | null>(null);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({}); // { [messageId]: number }
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedMessages, setLikedMessages] = useState<Record<string, boolean>>(
    {}
  );

  // Fetch daily question if not passed via params (e.g., from tab bar)
  useEffect(() => {
    const fetchCurrentQuestion = async () => {
      if (!question || !questionId) {
        try {
          const today = new Date();
          today.setHours(0, 0, 0, 0); // Start of today
          const questionDoc = await firestore()
            .collection("dailyQuestions")
            .where("date", ">=", today)
            .where("date", "<", new Date(today.getTime() + 24 * 60 * 60 * 1000)) // End of today
            .orderBy("date", "asc")
            .limit(1)
            .get();

          if (!questionDoc.empty) {
            const qData = questionDoc.docs[0].data();
            setCurrentQuestion(qData.question);
            setCurrentQuestionId(questionDoc.docs[0].id);
          } else {
            Alert.alert("No question available", "Please try again later.");
            router.replace("/start"); // Redirect if no question found
          }
        } catch (error: any) {
          console.error("Error fetching daily question in discussion: ", error);
          Alert.alert("Error", "Failed to load discussion topic.");
          router.replace("/start"); // Redirect on error
        }
      }
    };

    fetchCurrentQuestion();
  }, [question, questionId]);

  // AppState hook to refetch vote-status on resume
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
    if (app === "active") checkUserVote();
  }, [app]);

  // 1. Ensure user is still allowed here
  useEffect(() => {
    (async () => {
      const uid = auth().currentUser?.uid;
      if (!uid) {
        router.replace("/");
        return;
      }
      await checkUserVote();
    })();
  }, []);

  // 2. Subscribe to messages, filtering out toxic/blocked
  useEffect(() => {
    let unsubscribe: any;
    (async () => {
      // Only proceed if currentQuestionId is available
      if (!currentQuestionId) return;

      const uid = auth().currentUser?.uid;
      if (!uid) return router.replace("/");

      // fetch blockedUsers for this user
      const userDoc = await firestore().collection("users").doc(uid).get();
      const blockedUsers = userDoc.data()?.blockedUsers || [];

      unsubscribe = firestore()
        .collection("discussions")
        .doc(currentQuestionId) // Use currentQuestionId here
        .collection("messages")
        .orderBy("timestamp", "asc")
        .onSnapshot((snap) => {
          if (!snap) return;
          const fetched = snap.docs
            .map((d) => ({
              id: d.id,
              ...d.data(),
              isToxic: d.data().isToxic,
              user: d.data().user,
              text: d.data().text,
            }))
            .filter(
              (m) =>
                m.isToxic !== true && !blockedUsers.includes(m.user as string)
            );
          setMessages(fetched);
        });
    })();
    return () => unsubscribe && unsubscribe();
  }, [currentQuestionId]); // Depend on currentQuestionId

  // 3. Auto-scroll on new messages
  const scrollToBottom = () => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
  };
  useEffect(() => {
    scrollToBottom();
    const t = setTimeout(scrollToBottom, 200);
    return () => clearTimeout(t);
  }, [messages]);

  // -- Logic functions --

  // Check if user voted today & still allowed
  const checkUserVote = async () => {
    const uid = auth().currentUser?.uid;
    if (!uid) return;
    try {
      const userDoc = await firestore().collection("users").doc(uid).get();
      const data = userDoc.data()!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (data.updatedAt) {
        const last = data.updatedAt.substring(0, 10);
        const todayStr = today.toISOString().substring(0, 10);
        if (!data.voted || last !== todayStr) {
          await userDoc.ref.update({ voted: false, messages: 3 });
          router.replace("/start");
        }
      } else {
        router.replace("/start");
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  // Send a new message
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    setIsSending(true);

    try {
      const uid = auth().currentUser?.uid;
      if (!uid) {
        Alert.alert("User not logged in");
        return router.replace("/");
      }
      const userDoc = await firestore().collection("users").doc(uid).get();
      const userData = userDoc.data()!;
      if (userData.strikes <= 0) {
        Alert.alert(
          "Access Denied",
          "You have been restricted from participating in discussions."
        );
        return;
      }
      if (userData.messages <= 0) {
        Alert.alert("No Messages Left", "Max 3 Messages Per Day");
        return;
      }

      // Moderation: no emails/phones
      const hasEmail = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(
        newMessage
      );
      const hasPhone = /(\+?1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/.test(
        newMessage
      );
      if (hasEmail || hasPhone) {
        Alert.alert("Message Not Sent", "No emails or phone numbers allowed.");
        setNewMessage("");
        return;
      }

      // Toxicity API
      const res = await fetch(
        "https://us-central1-commonground-e78a9.cloudfunctions.net/analyze_toxicity",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: newMessage }),
        }
      );
      const result = await res.json();
      const scores = result.attributeScores;
      const tooToxic = Object.values(scores).some(
        (s: any) => s.summaryScore.value > 0.7
      );
      if (tooToxic) {
        Alert.alert(
          "Message Not Sent",
          "Your message violates our guidelines."
        );
        setNewMessage("");
        return;
      }

      // All good → write to Firestore
      await firestore()
        .collection("discussions")
        .doc(currentQuestionId) // Use currentQuestionId here
        .collection("messages")
        .add({
          text: newMessage,
          timestamp: firestore.FieldValue.serverTimestamp(),
          isToxic: false,
          user: uid,
        });

      // decrement user messages
      await firestore()
        .collection("users")
        .doc(uid)
        .update({ messages: firestore.FieldValue.increment(-1) });

      setNewMessage("");
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  // Navigate back to Start
  const handleBack = () => {
    router.navigate("/start");
  };

  // Flag a message
  const handleFlag = (message: { id: string; text: string; user: string }) => {
    router.push({
      pathname: "/report",
      params: {
        messageId: message.id,
        messageText: message.text,
        question: currentQuestion, // Use currentQuestion here
        user: message.user,
      },
    });
  };

  // Placeholder: update replyCounts when messages change
  useEffect(() => {
    // TODO: Replace with Firestore logic to count replies for each message
    const counts: Record<string, number> = {};
    messages.forEach((msg: { id: string }) => {
      // Placeholder: random count for demo
      counts[msg.id] = Math.floor(Math.random() * 4); // 0-3 replies
    });
    setReplyCounts(counts);
  }, [messages]);

  // Initialize likeCounts with placeholder logic
  useEffect(() => {
    // TODO: Replace with Firestore logic to get like counts for each message
    const counts: Record<string, number> = {};
    messages.forEach((msg: { id: string }) => {
      counts[msg.id] = Math.floor(Math.random() * 10); // 0-9 likes
    });
    setLikeCounts(counts);
  }, [messages]);

  // Like handler (placeholder)
  const handleLike = (msgId: string) => {
    setLikedMessages((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }));
    setLikeCounts((prev) => ({
      ...prev,
      [msgId]: prev[msgId] ? prev[msgId] - 1 : (prev[msgId] || 0) + 1,
    }));
    // TODO: Replace with Firestore logic to toggle like for the user and update like count
  };

  // --- Render UI ---

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Back Button */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={24} color="#9D00FF" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      {/* Question Card */}
      <LinearGradient
        colors={["#9D00FF20", "#6A0DAD20"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.topicCard}
      >
        <Text style={styles.topicText}>{currentQuestion}</Text>
        {/* Use currentQuestion here */}
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map(
          (
            msg: { id: string; text: string; user: string; [key: string]: any },
            i
          ) => {
            const parentMsg = {
              id: msg.id,
              text: msg.text || "",
              user: msg.user || "",
            };
            return (
              <Animated.View
                key={msg.id}
                entering={SlideInRight.delay(i * 100).duration(300)}
                style={styles.messageWrapper}
              >
                <LinearGradient
                  colors={["#222222", "#1A1A1A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.messageBubble}
                >
                  <Text style={styles.messageText}>{msg.text}</Text>
                  <View style={styles.messageFooter}>
                    <Text style={styles.timestampText}>
                      {msg.timestamp
                        ? new Date(msg.timestamp.toDate()).toLocaleTimeString()
                        : ""}
                    </Text>
                    <Pressable
                      style={styles.flagButton}
                      onPress={() => handleFlag(msg)}
                    >
                      <Flag size={16} color="#9D00FF" />
                    </Pressable>
                  </View>
                  {/* Add Like + Reply row */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 8,
                    }}
                  >
                    <Pressable
                      style={styles.likeButton}
                      onPress={() => handleLike(msg.id)}
                    >
                      {likedMessages[msg.id] ? (
                        <Heart color="#E57373" fill="#E57373" size={18} />
                      ) : (
                        <Heart color="#888" size={18} />
                      )}
                      <Text style={styles.likeCountText}>
                        {likeCounts[msg.id] || 0}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[styles.replyButton, { marginLeft: 10 }]}
                      onPress={() => {
                        setThreadParentMessage(parentMsg);
                        setThreadModalVisible(true);
                      }}
                    >
                      <Text style={styles.replyButtonText}>Reply</Text>
                      {replyCounts && replyCounts[msg.id] > 0 && (
                        <View style={styles.replyBadge}>
                          <Text style={styles.replyBadgeText}>
                            {replyCounts[msg.id]}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </View>
                </LinearGradient>
              </Animated.View>
            );
          }
        )}
      </ScrollView>

      {/* Input + Send */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type your message..."
          placeholderTextColor="#999"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          editable={!isSending}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            pressed && { opacity: 0.8 },
          ]}
          onPress={sendMessage}
          disabled={isSending}
        >
          <LinearGradient
            colors={["#9D00FF", "#6A0DAD"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.sendButtonGradient}
          >
            <Send size={20} color="#fff" />
          </LinearGradient>
        </Pressable>
      </View>

      {/* Thread Modal */}
      {threadParentMessage && (
        <ThreadModal
          visible={threadModalVisible}
          onClose={() => setThreadModalVisible(false)}
          parentMessage={threadParentMessage}
          canReply={true /* TODO: check if user has voted */}
        />
      )}
    </KeyboardAvoidingView>
  );
}

// --- Thread Modal Component (Placeholder Data) ---
type ThreadModalProps = {
  visible: boolean;
  onClose: () => void;
  parentMessage: { id: string; text: string; user: string };
  canReply: boolean;
};

function ThreadModal({
  visible,
  onClose,
  parentMessage,
  canReply,
}: ThreadModalProps) {
  const [replies, setReplies] = useState<
    {
      id: string;
      text: string;
      user: string;
    }[]
  >([
    { id: "1", text: "This is a placeholder reply.", user: "UserA" },
    { id: "2", text: "Another placeholder reply!", user: "UserB" },
  ]);
  const [replyText, setReplyText] = useState("");

  // Placeholder for sending notification
  const sendReplyNotification = (
    parentUserId: string,
    replyData: { text: string }
  ) => {
    // TODO: Integrate with notification system
    // e.g., send FCM or in-app notification
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    // Add reply to placeholder list
    setReplies((prev) => [
      ...prev,
      { id: Date.now().toString(), text: replyText, user: "You" },
    ]);
    setReplyText("");
    // Placeholder notification
    sendReplyNotification(parentMessage.user, { text: replyText });
    // TODO: Replace with Firestore logic
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={threadStyles.modalOverlay}>
        <View style={threadStyles.modalContainer}>
          {/* Header with X button */}
          <View style={threadStyles.modalHeader}>
            <Text style={threadStyles.modalTitle}>Thread</Text>
            <TouchableOpacity
              onPress={onClose}
              style={threadStyles.closeButton}
            >
              <X size={24} color="#9D00FF" />
            </TouchableOpacity>
          </View>
          {/* Parent message */}
          <View style={threadStyles.parentMessageCard}>
            <Text style={threadStyles.parentMessageText}>
              {parentMessage.text}
            </Text>
          </View>
          {/* Replies */}
          <ScrollView style={threadStyles.repliesList}>
            {replies.map((reply) => (
              <View key={reply.id} style={threadStyles.replyCard}>
                <Text style={threadStyles.replyUser}>{reply.user}:</Text>
                <Text style={threadStyles.replyText}>{reply.text}</Text>
              </View>
            ))}
          </ScrollView>
          {/* Reply input */}
          {canReply ? (
            <View style={threadStyles.replyInputContainer}>
              <TextInput
                style={threadStyles.replyInput}
                placeholder="Type your reply..."
                placeholderTextColor="#999"
                value={replyText}
                onChangeText={setReplyText}
              />
              <TouchableOpacity
                style={threadStyles.sendReplyButton}
                onPress={handleSendReply}
              >
                <Send size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={threadStyles.cannotReplyText}>
              You must vote to reply in this thread.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

// --- Styles for ThreadModal and reply badge ---
const threadStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(18,3,24,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    width: "92%",
    maxHeight: "85%",
    backgroundColor: "#1C0529",
    borderRadius: 18,
    padding: 16,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter-Bold",
  },
  closeButton: {
    padding: 4,
  },
  parentMessageCard: {
    backgroundColor: "#2A2A2A",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  parentMessageText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter-Medium",
  },
  repliesList: {
    flex: 1,
    marginBottom: 10,
    maxHeight: 220,
  },
  replyCard: {
    backgroundColor: "#222",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  replyUser: {
    color: "#9D00FF",
    fontSize: 13,
    fontFamily: "Inter-Bold",
  },
  replyText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter-Regular",
  },
  replyInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  replyInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter-Regular",
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  sendReplyButton: {
    backgroundColor: "#9D00FF",
    borderRadius: 16,
    padding: 8,
    marginLeft: 8,
  },
  cannotReplyText: {
    color: "#BF5FFF",
    textAlign: "center",
    marginTop: 10,
    fontSize: 14,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#121212" },
  header: {
    paddingTop: Platform.OS === "ios" ? 60 : 30,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  backButton: { flexDirection: "row", alignItems: "center" },
  backText: {
    color: "#9D00FF",
    fontSize: 18,
    marginLeft: 8,
    fontFamily: "Inter-Medium",
  },
  topicCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#9D00FF40",
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  topicText: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    lineHeight: 26,
    fontFamily: "Inter-Bold",
  },
  messagesContainer: { flex: 1, paddingHorizontal: 24 },
  messagesContent: { paddingVertical: 10 },
  messageWrapper: { marginBottom: 16 },
  messageBubble: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333333",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: "#fff",
    fontFamily: "Inter-Regular",
    lineHeight: 24,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  timestampText: {
    fontSize: 12,
    color: "#999999",
    fontFamily: "Inter-Regular",
  },
  flagButton: { padding: 4 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,26,26,0.95)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#333333",
  },
  input: {
    flex: 1,
    backgroundColor: "#222222",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    color: "#fff",
    maxHeight: 100,
    fontFamily: "Inter-Regular",
  },
  sendButton: {
    borderRadius: 20,
    overflow: "hidden",
    elevation: 5,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  replyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#222",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  replyButtonText: {
    color: "#9D00FF",
    fontSize: 15,
    fontFamily: "Inter-Bold",
    marginRight: 6,
  },
  replyBadge: {
    backgroundColor: "#9D00FF",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 2,
    paddingHorizontal: 5,
  },
  replyBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter-Bold",
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  likeCountText: {
    color: "#aaa",
    fontSize: 14,
    fontFamily: "Inter-Regular",
    marginLeft: 4,
  },
});
