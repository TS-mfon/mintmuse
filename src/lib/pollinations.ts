// Free, key-less AI via Pollinations. Used for (a) the fallback concept
// generator and (b) turning the art prompt into an image URL.

export async function pollinationsText(prompt: string, model = "openai-large"): Promise<string> {
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${model}&json=false`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("pollinations text failed");
  return (await res.text()).trim();
}

export async function pollinationsTextJson<T = any>(prompt: string, model = "openai-large"): Promise<T | null> {
  const url = `https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=${model}&json=true`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    const text = await res.text();
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Builds a directly-viewable image URL from a prompt (no API key, no fetch needed).
export function pollinationsImageUrl(prompt: string, model = "flux"): string {
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(
    prompt
  )}?model=${model}&width=1024&height=1024&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
}
