import { Platform } from "react-native";
import Purchases, {
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";

const IOS_KEY = process.env["EXPO_PUBLIC_REVENUECAT_IOS_KEY"];
const ANDROID_KEY = process.env["EXPO_PUBLIC_REVENUECAT_ANDROID_KEY"];

export const PRO_ENTITLEMENT_ID = "pro";

let initialized = false;

export function hasPurchasesConfig(): boolean {
  if (Platform.OS === "ios") return Boolean(IOS_KEY);
  if (Platform.OS === "android") return Boolean(ANDROID_KEY);
  return false;
}

export async function initPurchases(userId?: string): Promise<void> {
  if (initialized) {
    if (userId) await safeLogin(userId);
    return;
  }
  if (!hasPurchasesConfig()) {
    console.warn("[purchases] Missing RevenueCat key — running without IAP.");
    return;
  }
  const apiKey = Platform.OS === "ios" ? IOS_KEY! : ANDROID_KEY!;
  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }
  Purchases.configure({ apiKey, appUserID: userId ?? null });
  initialized = true;
}

async function safeLogin(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (e) {
    console.warn("[purchases] logIn failed", e);
  }
}

export async function logoutPurchases(): Promise<void> {
  if (!initialized) return;
  try {
    await Purchases.logOut();
  } catch {
    // ignore
  }
}

export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  if (!initialized) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.warn("[purchases] getOfferings failed", e);
    return null;
  }
}

export interface PurchaseOutcome {
  ok: boolean;
  isPro: boolean;
  cancelled: boolean;
  errorMessage?: string;
}

export async function purchasePackage(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return {
      ok: true,
      isPro: isProActive(customerInfo),
      cancelled: false,
    };
  } catch (err) {
    const e = err as { userCancelled?: boolean; message?: string };
    if (e.userCancelled) {
      return { ok: false, isPro: false, cancelled: true };
    }
    return {
      ok: false,
      isPro: false,
      cancelled: false,
      errorMessage: e.message ?? "Purchase failed",
    };
  }
}

export async function restorePurchases(): Promise<PurchaseOutcome> {
  if (!initialized) {
    return { ok: false, isPro: false, cancelled: false, errorMessage: "Not initialized" };
  }
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { ok: true, isPro: isProActive(customerInfo), cancelled: false };
  } catch (err) {
    const e = err as { message?: string };
    return {
      ok: false,
      isPro: false,
      cancelled: false,
      errorMessage: e.message ?? "Restore failed",
    };
  }
}

export function isProActive(info: CustomerInfo): boolean {
  return Boolean(info.entitlements.active[PRO_ENTITLEMENT_ID]);
}
