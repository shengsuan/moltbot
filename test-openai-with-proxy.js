import OpenAI from "openai";
import { EnvHttpProxyAgent } from "undici";

const API_KEY = "AX6r2NQAqUVJ0WZaAqKLWJQssZLOywMAZyiuqJCd7IVIhc87ikbo4TVM9HaMSwhh3hiRF7EDmkCu";

async function testOpenAIWithProxy() {
  console.log("=== Testing OpenAI SDK with EnvHttpProxyAgent ===");
  console.log("https_proxy:", process.env.https_proxy);
  console.log("http_proxy:", process.env.http_proxy);

  try {
    const agent = new EnvHttpProxyAgent();

    const client = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://router.shengsuanyun.com/api/v1",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      },
      httpAgent: agent, // Try setting HTTP agent
    });

    const completion = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: [
        {
          role: "user",
          content: "hi",
        },
      ],
      stream: false,
    });

    console.log("Success!");
    console.log("Response:", completion.choices[0].message.content);
  } catch (error) {
    console.error("Error:", error.message);
    console.error("Status:", error.status);
    if (error.response) {
      console.error("Response status:", error.response.status);
      const text = await error.response.text().catch(() => "Could not read response body");
      console.error("Response body:", text);
    }
  }
}

async function testOpenAISDKStreaming() {
  console.log("\n=== Testing OpenAI SDK Streaming with proxy ===");

  try {
    const agent = new EnvHttpProxyAgent();

    const client = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://router.shengsuanyun.com/api/v1",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      },
      httpAgent: agent,
    });

    const stream = await client.chat.completions.create({
      model: "anthropic/claude-haiku-4.5",
      messages: [
        {
          role: "user",
          content: "hi",
        },
      ],
      stream: true,
    });

    console.log("Stream created, receiving chunks...");
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        process.stdout.write(content);
      }
    }
    console.log("\nStream completed successfully");
  } catch (error) {
    console.error("\nStreaming Error:", error.message);
    console.error("Status:", error.status);
    if (error.response) {
      console.error("Response headers:", error.response.headers);
    }
  }
}

testOpenAIWithProxy()
  .then(() => testOpenAISDKStreaming())
  .catch(console.error);
