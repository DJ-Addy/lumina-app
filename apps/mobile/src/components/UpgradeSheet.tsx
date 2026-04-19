import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import {
  getCurrentOffering,
  hasPurchasesConfig,
  purchasePackage,
  restorePurchases,
} from "../lib/purchases";
import { colors, spacing, radius, typography } from "../theme/tokens";

interface UpgradeSheetProps {
  visible: boolean;
  onClose: () => void;
  onUpgraded?: () => void;
}

export function UpgradeSheet({ visible, onClose, onUpgraded }: UpgradeSheetProps) {
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loadingOffering, setLoadingOffering] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!visible || !hasPurchasesConfig()) {
      return;
    }
    setLoadingOffering(true);
    getCurrentOffering()
      .then((offering) => {
        const monthly =
          offering?.monthly ??
          offering?.availablePackages?.[0] ??
          null;
        setPkg(monthly);
      })
      .finally(() => setLoadingOffering(false));
  }, [visible]);

  const handleUpgrade = async () => {
    if (!hasPurchasesConfig()) {
      Alert.alert(
        "Pro coming soon",
        "In-app purchases aren't configured in this build. Add your RevenueCat keys to enable upgrades.",
      );
      return;
    }
    if (!pkg) {
      Alert.alert(
        "No subscription available",
        "We couldn't load the upgrade option. Please try again later.",
      );
      return;
    }

    setPurchasing(true);
    const outcome = await purchasePackage(pkg);
    setPurchasing(false);

    if (outcome.cancelled) return;

    if (!outcome.ok) {
      Alert.alert("Purchase failed", outcome.errorMessage ?? "Please try again.");
      return;
    }

    if (outcome.isPro) {
      onUpgraded?.();
      onClose();
      Alert.alert("Welcome to Pro", "You now have unlimited reflections with Lumina.");
    } else {
      Alert.alert(
        "Almost there",
        "We received your purchase but Pro hasn't activated yet. Try Restore Purchases in a moment.",
      );
    }
  };

  const handleRestore = async () => {
    if (!hasPurchasesConfig()) return;
    setRestoring(true);
    const outcome = await restorePurchases();
    setRestoring(false);

    if (outcome.isPro) {
      onUpgraded?.();
      onClose();
      Alert.alert("Restored", "Your Pro subscription is active.");
    } else if (outcome.errorMessage) {
      Alert.alert("Restore failed", outcome.errorMessage);
    } else {
      Alert.alert("No active subscription", "We didn't find a Pro purchase on this account.");
    }
  };

  const priceLabel = pkg?.product.priceString ?? "$4.99 / month";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>You've reached your limit</Text>
          <Text style={styles.body}>
            You've used all your free Lumina reflections this month. Upgrade to Pro for unlimited
            reflections, deeper Claude-powered insights, and more.
          </Text>

          <View style={styles.benefits}>
            <Text style={styles.benefit}>✦  Unlimited chat reflections</Text>
            <Text style={styles.benefit}>✦  Powered by Claude (warmer, deeper)</Text>
            <Text style={styles.benefit}>✦  Voice journaling</Text>
            <Text style={styles.benefit}>✦  Weekly emotional summaries</Text>
          </View>

          <TouchableOpacity
            style={[styles.upgradeButton, (purchasing || loadingOffering) && styles.disabled]}
            onPress={handleUpgrade}
            disabled={purchasing || loadingOffering}
          >
            {purchasing || loadingOffering ? (
              <ActivityIndicator color={colors.text.inverse} />
            ) : (
              <Text style={styles.upgradeText}>Upgrade — {priceLabel}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleRestore}
            disabled={restoring}
          >
            {restoring ? (
              <ActivityIndicator color={colors.text.muted} size="small" />
            ) : (
              <Text style={styles.linkText}>Restore purchases</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.background.primary,
    padding: spacing.xl,
    paddingTop: spacing.md,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    gap: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: typography.size.xl,
    fontWeight: typography.weight.semibold,
    color: colors.text.primary,
  },
  body: {
    fontSize: typography.size.md,
    color: colors.text.secondary,
    lineHeight: typography.size.md * typography.lineHeight.relaxed,
    marginBottom: spacing.sm,
  },
  benefits: {
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  benefit: {
    fontSize: typography.size.md,
    color: colors.text.primary,
  },
  upgradeButton: {
    backgroundColor: colors.accent.purple,
    padding: spacing.md,
    borderRadius: radius.full,
    alignItems: "center",
    marginTop: spacing.md,
    minHeight: 52,
    justifyContent: "center",
  },
  upgradeText: {
    color: colors.text.inverse,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.md,
  },
  disabled: {
    opacity: 0.6,
  },
  linkButton: {
    padding: spacing.sm,
    alignItems: "center",
  },
  linkText: {
    color: colors.accent.purple,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  closeButton: {
    padding: spacing.md,
    alignItems: "center",
  },
  closeText: {
    color: colors.text.muted,
    fontSize: typography.size.md,
  },
});
