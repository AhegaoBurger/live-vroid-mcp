#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";

// Types
interface AvatarCommand {
  clip: string;
  emotion: string;
  lookAt: string;
}

interface AnimationStep {
  clip: string;
  emotion?: string;
  lookAt?: string;
  delay?: number;
}

interface EmotionKeywords {
  [key: string]: string[];
}

// WebSocket connection to Godot
let godotSocket: WebSocket | null = null;
let socketReady: boolean = false;

// Configuration
const GODOT_WS_URL: string = process.env.GODOT_WS_URL || "ws://localhost:8080";

// Available animations from Mixamo
const ANIMATIONS = [
  "idle",
  "wave",
  "jump",
  "walk",
  "run",
  "dance",
  "sit",
  "stand",
  "nod",
  "shake_head",
  "laugh",
  "think",
  "point",
  "clap",
  "bow",
] as const;

// Available emotions
const EMOTIONS = [
  "neutral",
  "happy",
  "sad",
  "angry",
  "surprised",
  "confused",
  "excited",
  "bored",
  "shy",
  "confident",
] as const;

// Look at targets
const LOOK_TARGETS = ["user", "away", "down", "up", "left", "right"] as const;

// Type definitions for the constants
type Animation = (typeof ANIMATIONS)[number];
type Emotion = (typeof EMOTIONS)[number];
type LookTarget = (typeof LOOK_TARGETS)[number];

// Connect to Godot WebSocket (non-blocking)
function connectToGodot(): void {
  console.error(`Attempting to connect to Godot at ${GODOT_WS_URL}...`);

  try {
    godotSocket = new WebSocket(GODOT_WS_URL);

    godotSocket.on("open", () => {
      console.error("Connected to Godot WebSocket");
      socketReady = true;
    });

    godotSocket.on("close", () => {
      console.error("Godot WebSocket disconnected");
      socketReady = false;
      // Don't auto-reconnect to avoid blocking the server
    });

    godotSocket.on("error", (err: Error) => {
      console.error("Godot WebSocket error:", err.message);
      socketReady = false;
    });
  } catch (error) {
    console.error(
      "Failed to create WebSocket connection:",
      (error as Error).message,
    );
    socketReady = false;
  }
}

// Send command to Godot
function sendToGodot(command: AvatarCommand): AvatarCommand {
  if (!socketReady || !godotSocket) {
    throw new Error(
      "WebSocket not connected to Godot. Make sure Godot is running and WebSocket server is active.",
    );
  }

  godotSocket.send(JSON.stringify(command));
  return command;
}

// Parse natural language to animation commands
function parseIntent(text: string): AvatarCommand {
  const lower = text.toLowerCase();

  // Animation detection
  let clip: Animation = "idle";
  for (const anim of ANIMATIONS) {
    if (lower.includes(anim)) {
      clip = anim;
      break;
    }
  }

  // Emotion detection
  let emotion: Emotion = "neutral";
  const emotionMap: EmotionKeywords = {
    happy: ["happy", "joy", "glad", "pleased", "delighted", "cheerful"],
    sad: ["sad", "unhappy", "down", "depressed", "blue"],
    angry: ["angry", "mad", "furious", "annoyed", "irritated"],
    surprised: ["surprised", "shocked", "amazed", "astonished"],
    confused: ["confused", "puzzled", "perplexed", "bewildered"],
    excited: ["excited", "thrilled", "enthusiastic"],
    shy: ["shy", "bashful", "timid", "nervous"],
    confident: ["confident", "sure", "certain", "bold"],
  };

  for (const [emo, keywords] of Object.entries(emotionMap)) {
    if (keywords.some((keyword: string) => lower.includes(keyword))) {
      emotion = emo as Emotion;
      break;
    }
  }

  // Look direction
  let lookAt: LookTarget = "user";
  if (lower.includes("look away") || lower.includes("don't look")) {
    lookAt = "away";
  } else if (lower.includes("look down")) {
    lookAt = "down";
  } else if (lower.includes("look up")) {
    lookAt = "up";
  }

  return { clip, emotion, lookAt };
}

// Create MCP server
const server = new McpServer({
  name: "live-vroid-mcp",
  version: "1.0.0",
});

// Register control_avatar tool
server.registerTool(
  "control_avatar",
  {
    title: "Control Avatar",
    description: "Control the VRoid avatar's animation, emotion, and gaze",
    inputSchema: {
      clip: z
        .enum(ANIMATIONS)
        .describe("Animation clip to play")
        .default("idle"),
      emotion: z
        .enum(EMOTIONS)
        .describe("Facial expression")
        .default("neutral"),
      lookAt: z.enum(LOOK_TARGETS).describe("Where to look").default("user"),
    },
  },
  async ({
    clip,
    emotion = "neutral",
    lookAt = "user",
  }: {
    clip: Animation;
    emotion?: Emotion;
    lookAt?: LookTarget;
  }) => {
    try {
      const command: AvatarCommand = { clip, emotion, lookAt };
      sendToGodot(command);

      return {
        content: [
          {
            type: "text",
            text: `Avatar updated: ${command.clip} animation, ${command.emotion} emotion, looking at ${command.lookAt}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Register animate_from_text tool
server.registerTool(
  "animate_from_text",
  {
    title: "Animate from Text",
    description:
      "Automatically parse text to control avatar based on context and emotion",
    inputSchema: {
      text: z
        .string()
        .describe("Natural language describing action, emotion, or both"),
    },
  },
  async ({ text }: { text: string }) => {
    try {
      const command = parseIntent(text);
      sendToGodot(command);

      return {
        content: [
          {
            type: "text",
            text: `Interpreted "${text}" as: ${command.clip} animation, ${command.emotion} emotion, looking at ${command.lookAt}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Register sequence_animations tool
server.registerTool(
  "sequence_animations",
  {
    title: "Sequence Animations",
    description: "Play a sequence of animations with timing",
    inputSchema: {
      sequence: z
        .array(
          z.object({
            clip: z.enum(ANIMATIONS),
            emotion: z.enum(EMOTIONS).optional(),
            lookAt: z.enum(LOOK_TARGETS).optional(),
            delay: z
              .number()
              .optional()
              .describe("Delay in ms before this animation"),
          }),
        )
        .describe("Array of animation commands with optional delays"),
    },
  },
  async ({ sequence }: { sequence: AnimationStep[] }) => {
    try {
      const results: string[] = [];

      for (const step of sequence) {
        if (step.delay) {
          await new Promise((resolve) => setTimeout(resolve, step.delay));
        }

        const command: AvatarCommand = {
          clip: step.clip,
          emotion: step.emotion || "neutral",
          lookAt: step.lookAt || "user",
        };

        sendToGodot(command);
        results.push(`${command.clip} (${command.emotion})`);
      }

      return {
        content: [
          {
            type: "text",
            text: `Executed animation sequence: ${results.join(" → ")}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error: ${(error as Error).message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Start server
async function main(): Promise<void> {
  try {
    console.error("Live-Vroid MCP Server starting...");

    // Start MCP server first
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server connected successfully");

    // Try to connect to Godot (non-blocking)
    connectToGodot();

    console.error("Live-Vroid MCP Server ready");
  } catch (error) {
    console.error("Fatal error during server startup:", error);
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.error("Shutting down gracefully...");
  if (godotSocket) {
    godotSocket.close();
  }
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.error("Shutting down gracefully...");
  if (godotSocket) {
    godotSocket.close();
  }
  process.exit(0);
});

main().catch((error: Error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
