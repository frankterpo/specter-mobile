# 🔮 Specter Mobile

**AI-Powered Deal Flow Management for VCs** — with on-device LLM inference using [Cactus](https://github.com/cactus-compute/cactus-react)

[![React Native](https://img.shields.io/badge/React_Native-0.79-blue?logo=react)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-53-black?logo=expo)](https://expo.dev/)
[![Cactus AI](https://img.shields.io/badge/Cactus-On_Device_AI-green)](https://github.com/cactus-compute/cactus-react)

---

## 🎯 What is Specter?

Specter is a mobile app that helps **venture capitalists** and **angel investors** manage their deal flow pipeline with AI assistance — **entirely on-device**.

### Key Features

| Feature | Description |
|---------|-------------|
| 🃏 **Swipe Deck** | Tinder-style interface to quickly evaluate startup leads |
| 🧠 **AI Insights** | On-device LLM generates investment summaries & recommendations |
| 🎤 **Voice Commands** | Natural language queries: *"Show me Series A SaaS companies"* |
| 📊 **Smart Dashboard** | Real-time analytics on your deal pipeline |
| 🔒 **Private by Design** | All AI runs locally — your data never leaves the device |

---

## 🚀 Cactus Integration

This app uses **[Cactus React](https://github.com/cactus-compute/cactus-react)** for on-device AI inference:

```typescript
import { useCactus } from 'cactus-react';

const { generateResponse } = useCactus();

// AI runs 100% on-device — no API calls, no data leaks
const summary = await generateResponse(
  "Analyze this startup: AI-powered legal tech, $2M ARR, Series A"
);
```

### Why On-Device AI?

- ⚡ **Instant responses** — no network latency
- 🔐 **Complete privacy** — sensitive deal data stays local
- 📴 **Works offline** — evaluate deals anywhere
- 💰 **Zero API costs** — no per-token charges

---

## 📱 Download & Try

**Android APK**: [Download from Releases](https://github.com/frankterpo/specter-mobile/raw/feature/cactus-ai-agent/releases/specter-mobile.apk)

---

## 🛠 Tech Stack

- **Framework**: React Native + Expo 53
- **AI Engine**: Cactus (on-device LLM)
- **Styling**: NativeWind (Tailwind CSS)
- **Auth**: Clerk
- **State**: React Context + Hooks

---

## 🏃 Quick Start

```bash
# Clone
git clone https://github.com/frankterpo/specter-mobile.git
cd specter-mobile
git checkout feature/cactus-ai-agent

# Install
npm install

# Run
npx expo start
```

---

## 📂 Project Structure

```
src/
├── ai/              # Cactus client, agent logic, prompts
├── components/      # AI Command Bar, Voice Input, Filters
├── screens/         # Dashboard, SwipeDeck, PersonDetail
├── context/         # AgentContext for AI state
└── api/             # Backend services
```

---

## 🎬 Demo

📺 **[Watch Video Demo](https://drive.google.com/file/d/1LDkMafuVStOeGk6OpgZ2I6xuDmgYYMsy/view?usp=drive_link)**

---

## 👨‍💻 Author

Built for the **Cactus AI Hackathon** by [@frankterpo](https://github.com/frankterpo)

---

## 📄 License

MIT

