import { streamSimple } from "@mariozechner/pi-ai";

const API_KEY = "AX6r2NQAqUVJ0WZaAqKLWJQssZLOywMAZyiuqJCd7IVIhc87ikbo4TVM9HaMSwhh3hiRF7EDmkCu";

async function testWithPiAi() {
  console.log("=== Testing with pi-ai streamSimple ===");
  console.log("Environment:");
  console.log("  https_proxy:", process.env.https_proxy || "(not set)");
  console.log("  NO_PROXY:", process.env.NO_PROXY || "(not set)");

  const model = {
    api: "openai-completions",
    provider: "shengsuanyun",
    id: "anthropic/claude-haiku-4.5",
    baseUrl: "https://router.shengsuanyun.com/api/v1",
  };

  const context = {
    systemPrompt: undefined,
    messages: [
      {
        role: "user",
        content: [{ type: "text", text: "hi" }],
      },
    ],
  };

  const options = {
    apiKey: API_KEY,
    headers: {
      "HTTP-Referer": "https://openclaw.ai",
      "X-Title": "OpenClaw",
    },
    signal: AbortSignal.timeout(30000),
  };

  try {
    console.log("\nStarting stream...");
    const stream = streamSimple(model, context, options);

    let receivedContent = false;
    for await (const event of stream) {
      if (event.type === "start") {
        console.log("✓ Stream started");
      } else if (event.type === "text_delta") {
        if (!receivedContent) {
          console.log("✓ Receiving content...");
          receivedContent = true;
        }
        process.stdout.write(event.delta);
      } else if (event.type === "done") {
        console.log("\n✓ Stream completed successfully");
        console.log("Stop reason:", event.reason);
        console.log("Usage:", event.message.usage);
      } else if (event.type === "error") {
        console.error("\n✗ Stream error:", event.error.errorMessage);
        console.error("Stop reason:", event.reason);
      }
    }
  } catch (error) {
    console.error("\n✗ Exception caught:", error.message);
    console.error("Stack:", error.stack);
  }
}

testWithPiAi().catch(console.error);
