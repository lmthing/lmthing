import type { Tier } from "./tiers.js";

const LITELLM_URL = process.env.LITELLM_URL || "http://litellm:4000";
const MASTER_KEY = process.env.LITELLM_MASTER_KEY || "";

async function request(path: string, method: string, body?: unknown) {
  const res = await fetch(`${LITELLM_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${MASTER_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LiteLLM ${method} ${path}: ${res.status} — ${text}`);
  }

  return res.json();
}

export async function createUser(
  userId: string,
  tier: Tier,
  metadata?: Record<string, string>,
) {
  return request("/user/new", "POST", {
    user_id: userId,
    max_budget: tier.budget,
    budget_duration: tier.budgetDuration,
    models: tier.models.length > 0 ? tier.models : undefined,
    tpm_limit: tier.tpmLimit,
    rpm_limit: tier.rpmLimit,
    metadata: { tier: tier.name.toLowerCase(), ...metadata },
  });
}

export async function generateKey(
  userId: string,
  tier: Tier,
  keyAlias?: string,
) {
  return request("/key/generate", "POST", {
    user_id: userId,
    models: tier.models.length > 0 ? tier.models : undefined,
    max_budget: tier.budget,
    budget_duration: tier.budgetDuration,
    tpm_limit: tier.tpmLimit,
    rpm_limit: tier.rpmLimit,
    key_alias: keyAlias || "default",
    metadata: { tier: tier.name.toLowerCase() },
  });
}

export async function updateUserTier(userId: string, tier: Tier) {
  await request("/user/update", "POST", {
    user_id: userId,
    max_budget: tier.budget,
    budget_duration: tier.budgetDuration,
    models: tier.models.length > 0 ? tier.models : undefined,
    tpm_limit: tier.tpmLimit,
    rpm_limit: tier.rpmLimit,
    metadata: { tier: tier.name.toLowerCase() },
  });

  const keys = await listKeys(userId);
  for (const key of keys) {
    await request("/key/update", "POST", {
      key: key.token,
      models: tier.models.length > 0 ? tier.models : undefined,
      max_budget: tier.budget,
      budget_duration: tier.budgetDuration,
      tpm_limit: tier.tpmLimit,
      rpm_limit: tier.rpmLimit,
      metadata: { tier: tier.name.toLowerCase() },
    });
  }
}

export async function listKeys(userId: string) {
  const result = await request(
    `/key/list?user_id=${encodeURIComponent(userId)}`,
    "GET",
  );
  return result.keys || [];
}

export async function deleteKey(keyId: string) {
  return request("/key/delete", "POST", { keys: [keyId] });
}

export async function getUserInfo(userId: string) {
  return request(`/user/info?user_id=${encodeURIComponent(userId)}`, "GET");
}

export async function getKeyInfo(token: string) {
  return request("/key/info", "POST", { key: token });
}
