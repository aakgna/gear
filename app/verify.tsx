import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useState, useRef, useEffect } from "react";
import Animated, {
  FadeIn,
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { logLogin, logSignUp } from "@/analytics/analyticsEvents";

export default function VerifyScreen() {
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [isVerifying, setIsVerifying] = useState(false);
  const shake = useSharedValue(0);
  const scale = useSharedValue(1);
  const { verificationId, phoneNumber } = useLocalSearchParams();

  const inputRef = useRef(null);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shake.value }, { scale: scale.value }],
    };
  });

  const handleVerify = async () => {
    if (code.length !== 6) {
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
      return;
    }

    setIsVerifying(true);
    try {
      // Create a credential with the verification ID and code
      const credential = auth.PhoneAuthProvider.credential(
        verificationId as string,
        code
      );

      // Sign in with the credential
      const userCredential = await auth().signInWithCredential(credential);

      const userDoc = await firestore()
        .collection("users")
        .doc(userCredential.user.uid)
        .get();

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayDate = today.toISOString().substring(0, 10);
      if (!userDoc.exists) {
        await firestore().collection("users").doc(userCredential.user.uid).set({
          phoneNumber: phoneNumber,
          strikes: 6,
          strikeCount: 0,
          messageCount: 100,
          voted: false,
          updatedAt: todayDate,
        });
        try {
          await logSignUp("phone");
        } catch (error) {
          console.error("Analytics error:", error);
        }
      } else {
        try {
          await logLogin("phone");
        } catch (error) {
          console.error("Analytics error:", error);
        }
      }

      // If successful, navigate to the start screen
      scale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      router.replace("/(tabs)/start");
    } catch (error: any) {
      console.error("Verification error:", error);
      Alert.alert(
        "Verification Failed",
        error.message || "Failed to verify code. Please try again."
      );
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (countdown === 0) {
      try {
        setIsVerifying(true);
        const confirmation = await auth().signInWithPhoneNumber(
          phoneNumber as string
        );
        // Update the verificationId in the URL or state
        setCountdown(60);
        scale.value = withSequence(
          withTiming(0.95, { duration: 100 }),
          withTiming(1, { duration: 100 })
        );
      } catch (error: any) {
        console.error("Resend error:", error);
        Alert.alert(
          "Failed to Resend",
          error.message || "Failed to resend code. Please try again."
        );
      } finally {
        setIsVerifying(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      <Pressable style={styles.backButton} onPress={() => router.back()}>
        <ArrowLeft size={24} color="#9D00FF" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <Animated.View entering={SlideInUp.duration(800)} style={styles.content}>
        <Text style={styles.title}>Verify Your Number</Text>

        <Text style={styles.subtitle}>
          Enter the verification code sent to your number.
        </Text>

        <Animated.View style={[styles.inputContainer, animatedStyle]}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="000000"
            placeholderTextColor="#666"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={setCode}
            autoFocus
            editable={!isVerifying}
          />

          <LinearGradient
            colors={["#9D00FF20", "#6A0DAD20"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.codeUnderline}
          />
        </Animated.View>

        <Pressable
          style={({ pressed }) => [
            styles.verifyButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={handleVerify}
          disabled={isVerifying}
        >
          <LinearGradient
            colors={["#9D00FF", "#6A0DAD"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientButton}
          >
            <Text style={styles.buttonText}>
              {isVerifying ? "Verifying..." : "Verify Code"}
            </Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.resendButton,
            { opacity: pressed && countdown === 0 ? 0.8 : 1 },
          ]}
          onPress={handleResend}
          disabled={countdown > 0 || isVerifying}
        >
          <Text
            style={[styles.resendText, countdown > 0 && styles.resendDisabled]}
          >
            Resend Code {countdown > 0 ? `(${countdown}s)` : ""}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 60,
    marginLeft: 24,
  },
  backText: {
    color: "#9D00FF",
    fontSize: 18,
    marginLeft: 8,
    fontFamily: "Inter-Medium",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  title: {
    fontSize: 36,
    color: "#ffffff",
    marginBottom: 16,
    fontFamily: "Inter-Bold",
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 18,
    color: "#A0A0A0",
    marginBottom: 40,
    fontFamily: "Inter-Regular",
  },
  inputContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 24,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  input: {
    fontSize: 36,
    color: "#ffffff",
    letterSpacing: 8,
    textAlign: "center",
    paddingVertical: 16,
    fontFamily: "Inter-Bold",
  },
  codeUnderline: {
    height: 2,
    borderRadius: 1,
    marginTop: 8,
  },
  verifyButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
    elevation: 5,
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
  resendButton: {
    alignItems: "center",
    padding: 16,
  },
  resendText: {
    fontSize: 16,
    color: "#9D00FF",
    fontFamily: "Inter-Medium",
  },
  resendDisabled: {
    color: "#666666",
  },
});
