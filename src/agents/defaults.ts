// Defaults for agent metadata when upstream does not supply them.
// Keep this aligned with the product-level latest-model baseline.
<<<<<<< HEAD
export const DEFAULT_PROVIDER = "shengsuanyun";
export const DEFAULT_MODEL = "anthropic/claude-opus-4.7";
=======
export const DEFAULT_PROVIDER = "openai";
export const DEFAULT_MODEL = "gpt-5.6-sol";
>>>>>>> 17abdfc78c89ec69e972abf7979462757f2402fb
// Conservative fallback used when model metadata is unavailable.
export const DEFAULT_CONTEXT_TOKENS = 200_000;
