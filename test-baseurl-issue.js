import { streamSimple } from "@mariozechner/pi-ai";

const API_KEY = "AX6r2NQAqUVJ0WZaAqKLWJQssZLOywMAZyiuqJCd7IVIhc87ikbo4TVM9HaMSwhh3hiRF7EDmkCu";

async function testWithBaseUrl() {
  console.log("=== Test 1: WITH baseUrl ===");
  const model1 = {
    api: "openai-completions",
    provider: "shengsuanyun",
    id: "anthropic/claude-haiku-4.5",
    baseUrl: "https://router.shengsuanyun.com/api/v1",
  };

  try {
    const stream = streamSimple(
      model1,
      {
        systemPrompt: undefined,
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      },
      {
        apiKey: API_KEY,
        signal: AbortSignal.timeout(10000),
      },
    );

    for await (const event of stream) {
      if (event.type === "text_delta") {
        process.stdout.write(event.delta);
      }
      if (event.type === "done") {
        console.log("\n✓ Success with baseUrl");
      }
      if (event.type === "error") {
        console.error("\n✗ Error:", event.error.errorMessage);
      }
    }
  } catch (err) {
    console.error("✗ Exception:", err.message);
  }
}

async function testWithoutBaseUrl() {
  console.log("\n=== Test 2: WITHOUT baseUrl (should fail) ===");
  const model2 = {
    api: "openai-completions",
    provider: "shengsuanyun",
    id: "anthropic/claude-haiku-4.5",
    // baseUrl is missing/undefined
  };

  try {
    const stream = streamSimple(
      model2,
      {
        systemPrompt: undefined,
        messages: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
      },
      {
        apiKey: API_KEY,
        signal: AbortSignal.timeout(10000),
      },
    );

    for await (const event of stream) {
      if (event.type === "error") {
        console.error("✗ Error (expected):", event.error.errorMessage);
      }
    }
  } catch (err) {
    console.error("✗ Exception (expected):", err.message);
  }
}

testWithBaseUrl()
  .then(() => testWithoutBaseUrl())
  .catch(console.error);
