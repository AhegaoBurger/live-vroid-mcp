#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import WebSocket from "ws";

// WebSocket connection to Godot
let godotSocket = null;
let socketReady = false;

// Configuration
const GODOT_WS_URL = process.env.GODOT_WS_URL || "ws://localhost:8080";

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
];

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
];

// Look at targets
const LOOK_TARGETS = ["user", "away", "down", "up", "left", "right"];

// Connect to Godot WebSocket
function connectToGodot() {
  console.error(`Connecting to Godot at ${GODOT_WS_URL}...`);

  godotSocket = new WebSocket(GODOT_WS_URL);

  godotSocket.on("open", () => {
    console.error("Connected to Godot WebSocket");
    socketReady = true;
  });

  godotSocket.on("close", () => {
    console.error("Godot WebSocket disconnected, attempting reconnect...");
    socketReady = false;
    setTimeout(connectToGodot, 5000);
  });

  godotSocket.on("error", (err) => {
    console.error("Godot WebSocket error:", err.message);
    socketReady = false;
  });
}

// Send command to Godot
function sendToGodot(command) {
  if (!socketReady || !godotSocket) {
    throw new Error("WebSocket not connected to Godot");
  }

  godotSocket.send(JSON.stringify(command));
  return command;
}

// Parse natural language to animation commands
function parseIntent(text) {
  const lower = text.toLowerCase();

  // Animation detection
  let clip = "idle";
  for (const anim of ANIMATIONS) {
    if (lower.includes(anim)) {
      clip = anim;
      break;
    }
  }

  // Emotion detection
  let emotion = "neutral";
  const emotionMap = {
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
    if (keywords.some((keyword) => lower.includes(keyword))) {
      emotion = emo;
      break;
    }
  }

  // Look direction
  let lookAt = "user";
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
        .describe(`Animation clip to play`)
        .default("idle"),
      emotion: z
        .enum(EMOTIONS)
        .describe(`Facial expression`)
        .optional()
        .default("neutral"),
      lookAt: z
        .enum(LOOK_TARGETS)
        .describe(`Where to look`)
        .optional()
        .default("user"),
    },
  },
  async ({ clip, emotion = "neutral", lookAt = "user" }) => {
    try {
      const command = { clip, emotion, lookAt };
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
            text: `Error: ${error.message}`,
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
  async ({ text }) => {
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
            text: `Error: ${error.message}`,
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
  async ({ sequence }) => {
    try {
      const results = [];

      for (const step of sequence) {
        if (step.delay) {
          await new Promise((resolve) => setTimeout(resolve, step.delay));
        }

        const command = {
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
            text: `Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  },
);

// Start server
async function main() {
  // Connect to Godot first
  connectToGodot();

  // Start MCP server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Live-Vroid MCP Server started");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
