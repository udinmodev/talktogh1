import { getFirebaseCredentials, getGoogleAccessToken } from "./push-notifications";

const FIREBASE_MANAGEMENT_SCOPE = "https://www.googleapis.com/auth/firebase";
const FIREBASE_MANAGEMENT_BASE_URL = "https://firebase.googleapis.com/v1beta1";
const WEB_APP_DISPLAY_NAME = "Talk Together Web";
const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 30 * 1000;
const CREATE_POLL_ATTEMPTS = 20;
const CREATE_POLL_INTERVAL_MS = 500;

export type ManagedFirebaseWebConfig = Record<string, string>;

export interface ManagedFirebaseWebConfigResult {
  config: ManagedFirebaseWebConfig | null;
  error: string | null;
}

interface WebAppListResponse {
  apps?: Array<{
    appId?: string;
    state?: string;
  }>;
}

interface WebAppConfigResponse {
  apiKey?: string;
  appId?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  measurementId?: string;
}

interface OperationResponse {
  name?: string;
  done?: boolean;
  response?: {
    appId?: string;
    name?: string;
  };
  error?: {
    message?: string;
  };
}

let cachedResult: { expiresAt: number; result: ManagedFirebaseWebConfigResult } | null = null;
let pendingResult: Promise<ManagedFirebaseWebConfigResult> | null = null;

function toConfig(data: WebAppConfigResponse, fallbackAppId: string, projectId: string): ManagedFirebaseWebConfig {
  return Object.fromEntries(
    Object.entries({
      apiKey: data.apiKey || "",
      authDomain: data.authDomain || "",
      projectId: data.projectId || projectId,
      storageBucket: data.storageBucket || "",
      messagingSenderId: data.messagingSenderId || "",
      appId: data.appId || fallbackAppId,
      measurementId: data.measurementId || "",
    }).filter(([, value]) => Boolean(value))
  );
}

async function fetchWebAppConfig(
  headers: Record<string, string>,
  projectPath: string,
  appId: string,
  projectId: string
): Promise<ManagedFirebaseWebConfigResult> {
  const configResponse = await fetch(
    `${FIREBASE_MANAGEMENT_BASE_URL}/${projectPath}/webApps/${appId}/config`,
    {
      headers,
      cache: "no-store",
    }
  );

  if (!configResponse.ok) {
    return { config: null, error: `web_app_config_http_${configResponse.status}` };
  }

  const configData = (await configResponse.json()) as WebAppConfigResponse;
  return {
    config: toConfig(configData, appId, projectId),
    error: null,
  };
}

async function createWebApp(
  headers: Record<string, string>,
  projectPath: string
): Promise<{ appId?: string; error?: string }> {
  const createResponse = await fetch(`${FIREBASE_MANAGEMENT_BASE_URL}/${projectPath}/webApps`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ displayName: WEB_APP_DISPLAY_NAME }),
    cache: "no-store",
  });

  if (!createResponse.ok) {
    return { error: `web_app_create_http_${createResponse.status}` };
  }

  const operation = (await createResponse.json()) as OperationResponse;
  if (operation.error) {
    return { error: "web_app_create_failed" };
  }
  if (!operation.name) {
    return { error: "web_app_create_no_operation" };
  }

  for (let attempt = 0; attempt < CREATE_POLL_ATTEMPTS; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, CREATE_POLL_INTERVAL_MS));

    const operationResponse = await fetch(`${FIREBASE_MANAGEMENT_BASE_URL}/${operation.name}`, {
      headers,
      cache: "no-store",
    });
    if (!operationResponse.ok) continue;

    const currentOperation = (await operationResponse.json()) as OperationResponse;
    if (currentOperation.error) {
      return { error: "web_app_create_failed" };
    }
    if (!currentOperation.done) continue;

    const appId = currentOperation.response?.appId || currentOperation.response?.name?.split("/").pop();
    return appId ? { appId } : { error: "web_app_create_no_app_id" };
  }

  return { error: "web_app_create_timeout" };
}

async function fetchManagedFirebaseWebConfig(): Promise<ManagedFirebaseWebConfigResult> {
  const credentials = getFirebaseCredentials();
  if (!credentials?.projectId) {
    return { config: null, error: "service_account_missing" };
  }

  const accessToken = await getGoogleAccessToken(FIREBASE_MANAGEMENT_SCOPE);
  const headers = { Authorization: `Bearer ${accessToken}` };
  const projectPath = `projects/${credentials.projectId}`;

  const appsResponse = await fetch(`${FIREBASE_MANAGEMENT_BASE_URL}/${projectPath}/webApps`, {
    headers,
    cache: "no-store",
  });

  if (!appsResponse.ok) {
    return { config: null, error: `web_apps_list_http_${appsResponse.status}` };
  }

  const appsData = (await appsResponse.json()) as WebAppListResponse;
  let appId = appsData.apps?.find((app) => app.state !== "DELETED")?.appId || appsData.apps?.[0]?.appId;

  if (!appId) {
    const created = await createWebApp(headers, projectPath);
    if (created.error || !created.appId) {
      return { config: null, error: created.error || "web_app_create_failed" };
    }
    appId = created.appId;
  }

  return fetchWebAppConfig(headers, projectPath, appId, credentials.projectId);
}

export async function getManagedFirebaseWebConfigResult(): Promise<ManagedFirebaseWebConfigResult> {
  if (cachedResult && cachedResult.expiresAt > Date.now()) {
    return cachedResult.result;
  }
  if (pendingResult) return pendingResult;

  pendingResult = fetchManagedFirebaseWebConfig()
    .catch((error) => ({
      config: null,
      error: error instanceof Error ? error.message : "managed_config_failed",
    }))
    .then((result) => {
      cachedResult = {
        expiresAt: Date.now() + (result.error ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS),
        result,
      };
      if (result.error) {
        console.warn("[Firebase] Managed web config lookup failed:", result.error);
      }
      return result;
    })
    .finally(() => {
      pendingResult = null;
    });

  return pendingResult;
}
