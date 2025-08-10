# Live-Vroid

> **LLM-controlled, Mixamo-animated VRoid avatars delivered in a Godot-powered web page.**

A browser-based, AI-driven virtual host system that combines VRoid Studio characters, Mixamo animations, and LLM intelligence to create interactive 3D avatars that respond to natural language in real-time.

## 🎯 What You'll See

1. **Open the web page** → A 3D VRoid character appears, playing idle animations
2. **Type or speak to the LLM** → The character instantly responds with appropriate animations: smiles, waves, jumps, and more

## 🏗️ Architecture Overview

### Asset Pipeline
```
VRoid Studio → Mixamo auto-rig → Blender merge & cleanup → glTF → Godot 4.2
```

### Runtime Layer
- **Godot HTML5 Export**: Renders the 3D character in the browser
- **WebSocket Client**: Listens for JSON animation commands like:
  ```json
  {"clip": "wave", "emotion": "happy", "lookAt": "user"}
  ```

### AI Layer
- **MCP Server**: Lightweight Node.js/TypeScript server that receives LLM prompts
- **Intent Mapping**: Converts natural language to animation/emotion commands
- **WebSocket Bridge**: Forwards commands to the Godot frontend

### Deployment
- **Frontend**: Static hosting on Vercel/Netlify
- **Backend**: MCP server on Fly.io or Railway

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Godot 4.2+
- A compatible LLM client that supports MCP

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/live-vroid.git
   cd live-vroid
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the MCP server**
   ```bash
   # Development
   npm run dev

   # Production
   npm start
   ```

4. **Configure WebSocket URL** (optional)
   ```bash
   export GODOT_WS_URL="ws://localhost:8080"
   ```

5. **Launch Godot frontend**
   - Open the Godot project
   - Export to HTML5 or run in debug mode
   - Ensure WebSocket server is enabled on port 8080

## 🎮 Available Commands

The MCP server provides three main tools for controlling the avatar:

### `control_avatar`
Direct control over animation, emotion, and gaze direction.

**Parameters:**
- `clip`: Animation to play (idle, wave, jump, walk, run, dance, sit, stand, nod, shake_head, laugh, think, point, clap, bow)
- `emotion`: Facial expression (neutral, happy, sad, angry, surprised, confused, excited, bored, shy, confident)
- `lookAt`: Gaze target (user, away, down, up, left, right)

### `animate_from_text`
Natural language parsing for intuitive control.

**Example:**
```
"Wave happily at the user" → {clip: "wave", emotion: "happy", lookAt: "user"}
```

### `sequence_animations`
Chain multiple animations with timing control.

**Example:**
```json
{
  "sequence": [
    {"clip": "wave", "emotion": "happy", "delay": 0},
    {"clip": "jump", "emotion": "excited", "delay": 2000},
    {"clip": "bow", "emotion": "shy", "delay": 1000}
  ]
}
```

## 🎨 Supported Animations

**Basic Actions:**
- `idle` - Default standing pose
- `wave` - Friendly greeting
- `jump` - Energetic hop
- `walk` / `run` - Movement animations

**Expressions:**
- `nod` / `shake_head` - Yes/no responses
- `laugh` - Joyful reaction
- `think` - Contemplative pose
- `point` - Directional gesture

**Social:**
- `clap` - Appreciation
- `bow` - Respectful greeting
- `dance` - Celebration
- `sit` / `stand` - Posture changes

## 🔧 Configuration

### Environment Variables
```bash
# WebSocket connection to Godot
GODOT_WS_URL=ws://localhost:8080

# Server configuration
NODE_ENV=production
PORT=3000
```

### MCP Server Setup
The server automatically handles:
- WebSocket connection management
- Graceful reconnection on disconnects
- Error handling and logging
- Natural language intent parsing

## 🌐 Deployment

### Frontend (Godot HTML5)
```bash
# Export Godot project to HTML5
# Deploy to Vercel, Netlify, or any static host
```

### Backend (MCP Server)
```bash
# Deploy to Fly.io
fly deploy

# Or Railway
railway up

# Or any Node.js hosting service
```

## 🔍 Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Ensure Godot WebSocket server is running on the correct port
- Check firewall settings
- Verify GODOT_WS_URL environment variable

**Animation Not Playing**
- Confirm animation names match the supported list
- Check Godot console for error messages
- Verify glTF export includes all required animations

**MCP Server Not Responding**
- Check server logs for connection errors
- Ensure LLM client supports MCP protocol
- Verify all dependencies are installed

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [VRoid Studio](https://vroid.com/) for character creation
- [Mixamo](https://www.mixamo.com/) for animation rigging
- [Godot Engine](https://godotengine.org/) for 3D rendering
- [Model Context Protocol](https://github.com/modelcontextprotocol) for LLM integration

---

**Made with ❤️ for the future of interactive AI companions**
