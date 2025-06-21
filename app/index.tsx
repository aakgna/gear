// SignInScreen.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { router, Link } from "expo-router";
import auth from "@react-native-firebase/auth";
import Animated, { FadeIn, SlideInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

export default function SignInScreen() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If user is already signed in (and has a phoneNumber), jump to /start immediately
  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((user) => {
      if (user && user.phoneNumber) {
        router.replace("/(tabs)/start");
      }
    });
    return subscriber; // unsubscribe on unmount
  }, []);

  // As the user types, keep only digits and mark valid once ≥10 digits
  const validatePhone = (text: string) => {
    const digitsOnly = text.replace(/\D/g, "");
    setPhoneNumber(text);
    setIsValid(digitsOnly.length >= 10);
  };

  // When they tap “Continue”, do exactly what you had before:
  //  • format into E.164 (“+1XXXXXXXXXX”)
  //  • auth().signInWithPhoneNumber(...)
  //  • navigate to /verify with { verificationId, phoneNumber }
  const handleContinue = async () => {
    if (!isValid) {
      return;
    }

    setIsLoading(true);
    try {
      // Build the E.164–compliant string:
      //   If they typed exactly 10 digits, prefix +1.
      //   If they typed 11 digits starting with “1”, prefix “+”.
      //   If they typed “+” + 10 digits, use as is.
      const digits = phoneNumber.replace(/\D/g, "");
      let formattedNumber = "";

      if (digits.length === 10) {
        formattedNumber = "+1" + digits;
      } else if (digits.length === 11 && digits.startsWith("1")) {
        formattedNumber = "+" + digits;
      } else if (phoneNumber.startsWith("+") && digits.length >= 10) {
        formattedNumber = phoneNumber;
      } else {
        // Fallback: if they already included a “+” or entered anything weird,
        // just make sure there's a leading "+" so Firebase doesn't blow up.
        formattedNumber = phoneNumber.startsWith("+")
          ? phoneNumber
          : "+" + phoneNumber.replace(/\D/g, "");
      }

      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);

      // Now navigate to /verify and pass both the phoneNumber and verificationId
      router.push({
        pathname: "/verify",
        params: {
          phoneNumber: formattedNumber,
          verificationId: confirmation.verificationId,
        },
      });
    } catch (error) {
      console.error("Failed to send verification code:", error);
      Alert.alert(
        "Failed to send verification code",
        "Please try again with phone number in format: +11234567890"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // When they tap "Delete Account", we do the same signInWithPhoneNumber flow
  // but route them to the delete‐account screen (instead of /verify).
  const handleDeleteAccount = async () => {
    if (phoneNumber.trim().length === 0) {
      Alert.alert("Error", "Phone number is required for verification.");
      return;
    }

    setIsLoading(true);
    try {
      const digits = phoneNumber.replace(/\D/g, "");
      let formattedNumber = "";

      if (digits.length === 10) {
        formattedNumber = "+1" + digits;
      } else if (digits.length === 11 && digits.startsWith("1")) {
        formattedNumber = "+" + digits;
      } else if (phoneNumber.startsWith("+") && digits.length >= 10) {
        formattedNumber = phoneNumber;
      } else {
        formattedNumber = phoneNumber.startsWith("+")
          ? phoneNumber
          : "+" + digits;
      }

      const confirmation = await auth().signInWithPhoneNumber(formattedNumber);
      router.push({
        pathname: "/deletion",
        params: {
          phoneNumber: formattedNumber,
          verificationId: confirmation.verificationId,
        },
      });
    } catch (error) {
      console.error("Error initiating account deletion:", error);
      Alert.alert(
        "Error",
        "Failed to initiate account deletion. Please format number like this +11234567890."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Full‐screen gradient background */}
      <LinearGradient
        colors={["#120318", "#1C0529"]}
        style={StyleSheet.absoluteFill}
      />

      <Animated.View entering={FadeIn.duration(800)} style={styles.content}>
        <Animated.View
          entering={SlideInUp.delay(200).duration(800)}
          style={styles.logoContainer}
        >
          <Image
            source={require("/Users/thelegend27/Desktop/repositories/commonground/assets/images/CG2.png")}
            style={styles.logoImage}
          />

          <Text style={styles.appTitle}>The Common Ground</Text>
          <Text style={styles.subtitle}>
            Find understanding in disagreement
          </Text>
        </Animated.View>

        <Animated.View
          entering={SlideInUp.delay(400).duration(800)}
          style={styles.formContainer}
        >
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Enter your phone number"
              placeholderTextColor="#A0A0A0"
              keyboardType="phone-pad"
              value={phoneNumber}
              onChangeText={validatePhone}
              editable={!isLoading}
            />
            {phoneNumber.length > 0 && (
              <Animated.View
                entering={FadeIn}
                style={[
                  styles.validationIcon,
                  { backgroundColor: isValid ? "#9D00FF20" : "#33333320" },
                ]}
              >
                <Text
                  style={[
                    styles.validationText,
                    { color: isValid ? "#9D00FF" : "#666666" },
                  ]}
                >
                  {isValid ? "✓" : "!"}
                </Text>
              </Animated.View>
            )}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.continueButton,
              { opacity: pressed ? 0.9 : 1 },
              (!isValid || isLoading) && styles.disabledButton,
            ]}
            onPress={handleContinue}
            disabled={!isValid || isLoading}
          >
            <LinearGradient
              colors={isValid ? ["#9D00FF", "#6A0DAD"] : ["#333333", "#222222"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientButton}
            >
              <Text style={styles.buttonText}>
                {isLoading ? "Sending..." : "Continue"}
              </Text>
            </LinearGradient>
          </Pressable>

          <View style={styles.termsContainer}>
            <Text style={styles.termsText}>
              By continuing, you agree to our{" "}
              <Link
                href="https://v0-common-ground-three.vercel.app/privacy-policy"
                style={styles.link}
              >
                Privacy Policy
              </Link>{" "}
              and{" "}
              <Link
                href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/"
                style={styles.link}
              >
                Apple's EULA
              </Link>
              .{"\n\n"}
              Messages containing content related to profanity, derogatory
              language, sexual topics, death or harm, violence, or public safety
              concerns are not permitted. These actions may lead to account
              suspension or ban. Contact{" "}
              <Link
                href="https://v0-common-ground-three.vercel.app/"
                style={styles.link}
              >
                support
              </Link>{" "}
              for help.{"\n\n"}
              Click{" "}
              <Text onPress={handleDeleteAccount} style={styles.link}>
                here
              </Text>{" "}
              to delete your account.
            </Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoBackground: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    elevation: 10,
    shadowColor: "#9D00FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  logoImage: {
    width: 140,
    height: 140,
    borderRadius: 35,
  },
  appTitle: {
    fontSize: 34,
    fontFamily: "Inter-Bold",
    fontWeight: "900",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#A0A0A0",
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },
  formContainer: {
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inputContainer: {
    position: "relative",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingRight: 50,
    fontFamily: "Inter-Regular",
    letterSpacing: 0.5,
  },
  validationIcon: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  validationText: {
    fontSize: 16,
    fontFamily: "Inter-Bold",
  },
  continueButton: {
    marginTop: 10,
    borderRadius: 16,
    overflow: "hidden",
  },
  gradientButton: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: "Inter-SemiBold",
  },
  disabledButton: {
    opacity: 0.6,
  },
  termsContainer: {
    marginTop: 20,
  },
  termsText: {
    color: "#A0A0A0",
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Inter-Regular",
  },
  link: {
    color: "#BF5FFF",
    textDecorationLine: "underline",
  },
});
