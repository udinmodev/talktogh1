import { NextResponse } from "next/server";
import { getManagedFirebaseWebConfigResult } from "@/lib/firebase-web-config";

const REQUIRED_KEYS = ["apiKey", "projectId", "messagingSenderId", "appId"] as const;

export async function GET() {
  const rawConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
  };

  const envConfig = Object.fromEntries(
    Object.entries(rawConfig).filter(([, value]) => Boolean(value))
  );

  let configSource: Record<string, string> = envConfig;
  let managedError: string | null = null;
  if (REQUIRED_KEYS.some((key) => !envConfig[key])) {
    const managedResult = await getManagedFirebaseWebConfigResult();
    managedError = managedResult.error;
    if (managedResult.config) {
      configSource = { ...managedResult.config, ...envConfig };
    }
  }

  const config = Object.fromEntries(
    Object.entries(configSource).filter(([, value]) => Boolean(value))
  );

  const missing = REQUIRED_KEYS.filter((key) => !config[key]);
  const configured = missing.length === 0;
  const vapidConfigured = Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY);

  return NextResponse.json({
    configured,
    vapidConfigured,
    ready: configured,
    missing,
    managedError,
    config: configured ? config : null,
  });
}
