import { View, Text, StyleSheet, Pressable } from "react-native";
import { Flag } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface MessageBubbleProps {
  text: string;
  timestamp: string;
  side: "agree" | "disagree" | "neutral";
  onFlag?: () => void;
}

export default function MessageBubble({
  text,
  timestamp,
  side = "neutral",
  onFlag,
}: MessageBubbleProps) {
  const getBubbleColors = (): [string, string] => {
    switch (side) {
      case "agree":
        return ["#9D00FF10", "#6A0DAD10"];
      case "disagree":
        return ["#33333350", "#22222250"];
      case "neutral":
      default:
        return ["#22222280", "#1A1A1A80"];
    }
  };

  const getBorderColor = () => {
    switch (side) {
      case "agree":
        return "#9D00FF40";
      case "disagree":
        return "#55555540";
      case "neutral":
      default:
        return "#33333340";
    }
  };

  return (
    <View style={styles.messageWrapper}>
      <LinearGradient
        colors={getBubbleColors()}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.messageBubble, { borderColor: getBorderColor() }]}
      >
        <Text style={styles.messageText}>{text}</Text>
        <View style={styles.messageFooter}>
          <Text style={styles.timestampText}>{timestamp}</Text>
          {onFlag && (
            <Pressable style={styles.flagButton} onPress={onFlag}>
              <Flag size={16} color="#9D00FF" />
            </Pressable>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  messageWrapper: {
    marginBottom: 16,
    alignSelf: "stretch",
  },
  messageBubble: {
    borderRadius: 16,
    padding: 16,
    maxWidth: "100%",
    borderWidth: 1,
  },
  messageText: {
    fontSize: 16,
    color: "#ffffff",
    fontFamily: "Inter-Regular",
    lineHeight: 24,
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  timestampText: {
    fontSize: 12,
    color: "#999999",
    fontFamily: "Inter-Regular",
  },
  flagButton: {
    padding: 4,
  },
});
