import WebSocket from "ws";

/**
 * Response from Godot server
 */
export interface GodotResponse {
  status: "success" | "error";
  result?: any;
  message?: string;
  commandId?: string;
}

/**
 * Command to send to Godot
 */
export interface GodotCommand {
  type: string;
  params: Record<string, any>;
  commandId: string;
}

/**
 * Manages WebSocket connection to the Godot engine
 * This handles avatar control commands for the Live-Vroid system
 */
export class GodotConnection {
  private ws: WebSocket | null = null;
  private connected = false;
  private commandQueue: Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();
  private commandId = 0;

  /**
   * Creates a new Godot connection
   * @param url WebSocket URL for the Godot server
   * @param timeout Command timeout in ms
   * @param maxRetries Maximum number of connection retries
   * @param retryDelay Delay between retries in ms
   */
  constructor(
    private url: string = "ws://localhost:8080",
    private timeout: number = 10000,
    private maxRetries: number = 3,
    private retryDelay: number = 2000,
  ) {
    console.error("GodotConnection created with URL:", this.url);
  }

  /**
   * Connects to the Godot WebSocket server
   */
  async connect(): Promise<void> {
    if (this.connected) return;

    let retries = 0;

    const tryConnect = (): Promise<void> => {
      return new Promise<void>((resolve, reject) => {
        console.error(
          `Connecting to Godot WebSocket server at ${this.url}... (Attempt ${retries + 1}/${this.maxRetries + 1})`,
        );

        this.ws = new WebSocket(this.url);

        // Set connection timeout
        const connectionTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            if (this.ws) {
              this.ws.terminate();
              this.ws = null;
            }
            reject(new Error("Connection timeout"));
          }
        }, 5000);

        this.ws.on("open", () => {
          clearTimeout(connectionTimeout);
          this.connected = true;
          console.error("Connected to Godot WebSocket server");

          // Send initial handshake or ping if needed
          this.sendPing();
          resolve();
        });

        this.ws.on("message", (data: Buffer) => {
          try {
            const message = data.toString();
            console.error("Received message:", message);

            // Try to parse as JSON
            try {
              const response: GodotResponse = JSON.parse(message);

              // Handle command responses
              if ("commandId" in response) {
                const commandId = response.commandId as string;
                const pendingCommand = this.commandQueue.get(commandId);

                if (pendingCommand) {
                  clearTimeout(pendingCommand.timeout);
                  this.commandQueue.delete(commandId);

                  if (response.status === "success") {
                    pendingCommand.resolve(response.result);
                  } else {
                    pendingCommand.reject(
                      new Error(response.message || "Unknown error"),
                    );
                  }
                }
              }
            } catch (jsonError) {
              // Not JSON, might be a plain text message
              console.error("Received non-JSON message:", message);
            }
          } catch (error) {
            console.error("Error processing message:", error);
          }
        });

        this.ws.on("error", (error) => {
          const err = error as Error;
          console.error("WebSocket error:", err.message);
          // Don't immediately close - let the close event handle cleanup
        });

        this.ws.on("close", (code, reason) => {
          clearTimeout(connectionTimeout);
          if (this.connected) {
            console.error(
              `Disconnected from Godot WebSocket server (code: ${code}, reason: ${reason})`,
            );
            this.connected = false;
          }

          // Clear all pending commands
          this.commandQueue.forEach((command) => {
            clearTimeout(command.timeout);
            command.reject(new Error("Connection closed"));
          });
          this.commandQueue.clear();
        });
      });
    };

    // Try connecting with retries
    while (retries <= this.maxRetries) {
      try {
        await tryConnect();
        return;
      } catch (error) {
        retries++;

        if (retries <= this.maxRetries) {
          console.error(
            `Connection attempt failed. Retrying in ${this.retryDelay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
        } else {
          throw new Error(
            `Failed to connect after ${this.maxRetries} retries: ${(error as Error).message}`,
          );
        }
      }
    }
  }

  /**
   * Sends a ping message to keep the connection alive
   */
  private sendPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "ping", timestamp: Date.now() }));
    }
  }

  /**
   * Sends a command to Godot and waits for a response
   * For Live-Vroid, the command type will typically be "avatar_control"
   * @param type Command type (e.g., "avatar_control")
   * @param params Command parameters (e.g., { clip: "wave", emotion: "happy", lookAt: "user" })
   * @returns Promise that resolves with the command result
   */
  async sendCommand<T = any>(
    type: string,
    params: Record<string, any> = {},
  ): Promise<T> {
    // Ensure connection
    if (!this.ws || !this.connected) {
      console.error("Not connected, attempting to connect...");
      try {
        await this.connect();
      } catch (error) {
        throw new Error(`Failed to connect: ${(error as Error).message}`);
      }
    }

    return new Promise<T>((resolve, reject) => {
      const commandId = `cmd_${this.commandId++}`;

      // For Live-Vroid, we send the avatar command directly
      const command: GodotCommand = {
        type,
        params,
        commandId,
      };

      console.error(`Sending command: ${JSON.stringify(command)}`);

      // Set timeout for command
      const timeoutId = setTimeout(() => {
        if (this.commandQueue.has(commandId)) {
          this.commandQueue.delete(commandId);
          reject(new Error(`Command timed out: ${type}`));
        }
      }, this.timeout);

      // Store the promise resolvers
      this.commandQueue.set(commandId, {
        resolve,
        reject,
        timeout: timeoutId,
      });

      // Send the command
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(command));
      } else {
        clearTimeout(timeoutId);
        this.commandQueue.delete(commandId);
        reject(new Error("WebSocket not connected"));
      }
    });
  }

  /**
   * Sends a raw avatar control message without expecting a response
   * Useful for simple fire-and-forget avatar commands
   */
  async sendAvatarCommand(
    clip: string,
    emotion: string = "neutral",
    lookAt: string = "user",
  ): Promise<void> {
    if (!this.ws || !this.connected) {
      await this.connect();
    }

    const command = {
      clip,
      emotion,
      lookAt,
      timestamp: Date.now(),
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
      console.error(`Sent avatar command: ${JSON.stringify(command)}`);
    } else {
      throw new Error("WebSocket not connected");
    }
  }

  /**
   * Disconnects from the Godot WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      // Clear all pending commands
      this.commandQueue.forEach((command) => {
        clearTimeout(command.timeout);
        command.reject(new Error("Connection closed"));
      });
      this.commandQueue.clear();

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client disconnect");
      } else {
        this.ws.terminate();
      }

      this.ws = null;
      this.connected = false;
      console.error("Disconnected from Godot WebSocket server");
    }
  }

  /**
   * Checks if connected to Godot
   */
  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Gets connection status details
   */
  getStatus(): { connected: boolean; url: string; pendingCommands: number } {
    return {
      connected: this.isConnected(),
      url: this.url,
      pendingCommands: this.commandQueue.size,
    };
  }
}
