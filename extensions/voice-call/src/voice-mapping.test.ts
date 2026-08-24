// Voice Call tests cover voice mapping plugin behavior.
import { describe, expect, it } from "vitest";
<<<<<<< HEAD
import { DEFAULT_POLLY_VOICE, escapeXml, mapVoiceToPolly } from "./voice-mapping.js";
=======
import { escapeXml, mapVoiceToPolly } from "./voice-mapping.js";
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb

describe("voice mapping", () => {
  it("escapes xml-special characters", () => {
    expect(escapeXml(`5 < 6 & "quote" 'apostrophe' > 4`)).toBe(
      "5 &lt; 6 &amp; &quot;quote&quot; &apos;apostrophe&apos; &gt; 4",
    );
  });

  it("maps openai voices, passes through provider voices, and falls back to default", () => {
    expect(mapVoiceToPolly("alloy")).toBe("Polly.Joanna");
    expect(mapVoiceToPolly("ECHO")).toBe("Polly.Matthew");
    expect(mapVoiceToPolly("Polly.Brian")).toBe("Polly.Brian");
    expect(mapVoiceToPolly("Google.en-US-Standard-C")).toBe("Google.en-US-Standard-C");
    expect(mapVoiceToPolly("unknown")).toBe("Polly.Joanna");
    expect(mapVoiceToPolly(undefined)).toBe("Polly.Joanna");
  });
});
