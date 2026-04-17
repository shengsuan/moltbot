import OpenAI from "openai";

const API_KEY = "AX6r2NQAqUVJ0WZaAqKLWJQssZLOywMAZyiuqJCd7IVIhc87ikbo4TVM9HaMSwhh3hiRF7EDmkCu";

async function testDirectRequest() {
  console.log("=== Test 1: Direct fetch ===");
  try {
    const response = await fetch("https://router.shengsuanyun.com/api/v1/chat/completions", {
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

    if (!response.ok) {
      console.error(`HTTP Error: ${response.status} ${response.statusText}`);
      const text = await response.text();
      console.error("Response body:", text);
    } else {
      const data = await response.json();
      console.log("Success:", JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error("Fetch error:", error);
  }
}

async function testOpenAISDK() {
  console.log("\n=== Test 2: OpenAI SDK ===");
  try {
    const client = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://router.shengsuanyun.com/api/v1",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      },
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

    console.log("Success:", JSON.stringify(completion, null, 2));
  } catch (error) {
    console.error("OpenAI SDK error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Body:", error.response.data);
    }
  }
}

async function testOpenAISDKStreaming() {
  console.log("\n=== Test 3: OpenAI SDK Streaming ===");
  try {
    const client = new OpenAI({
      apiKey: API_KEY,
      baseURL: "https://router.shengsuanyun.com/api/v1",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "HTTP-Referer": "https://openclaw.ai",
        "X-Title": "OpenClaw",
      },
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
    console.error("OpenAI SDK streaming error:", error.message);
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Body:", error.response.data);
    }
  }
}

async function run() {
  await testDirectRequest();
  await testOpenAISDK();
  await testOpenAISDKStreaming();
}

run().catch(console.error);
