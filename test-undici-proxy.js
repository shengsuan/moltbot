import { EnvHttpProxyAgent, fetch as undiciFetch } from "undici";

const API_KEY = "AX6r2NQAqUVJ0WZaAqKLWJQssZLOywMAZyiuqJCd7IVIhc87ikbo4TVM9HaMSwhh3hiRF7EDmkCu";

async function testWithUndici() {
  console.log("=== Testing with undici and EnvHttpProxyAgent ===");
  console.log("https_proxy:", process.env.https_proxy);
  console.log("http_proxy:", process.env.http_proxy);

  try {
    const agent = new EnvHttpProxyAgent();

    const response = await undiciFetch("https://router.shengsuanyun.com/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          {
            role: "user",
            content: "hi",
          },
        ],
        stream: false,
      }),
      dispatcher: agent,
    });

    console.log("Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Response:", text.substring(0, 500));
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Cause:", error.cause);
  }
}

async function testWithUndiciNoProxy() {
  console.log("\n=== Testing with undici WITHOUT proxy ===");

  try {
    const response = await undiciFetch("https://router.shengsuanyun.com/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        messages: [
          {
            role: "user",
            content: "hi",
          },
        ],
        stream: false,
      }),
    });

    console.log("Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Response:", text.substring(0, 500));
  } catch (error) {
    console.error("Error:", error.message);
  }
}

testWithUndici()
  .then(() => testWithUndiciNoProxy())
  .catch(console.error);
