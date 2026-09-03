<div align="center">

# 🛡️ CHAMA-SHIELD MD

<p align="center">
  <img src="https://img.shields.io/badge/CHAMA--SHIELD-PREMIUM%20EDITION-8ea9db?style=for-the-badge&logo=whatsapp&logoColor=white" alt="Chama Shield Badge" />
  <img src="https://img.shields.io/badge/DASHBOARD-VITE%20%2B%20REACT-61dafb?style=for-the-badge&logo=react&logoColor=white" alt="Vite React Badge" />
  <img src="https://img.shields.io/badge/SECURITY-ANTI--BAN%20PRO-2ea44f?style=for-the-badge&logo=shield&logoColor=white" alt="Anti Ban Badge" />
  <img src="https://img.shields.io/badge/DATABASE-MONGODB-47a248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB Badge" />
</p>

<p align="center">
  <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=20&duration=3500&pause=1000&color=8EA9DB&center=true&vCenter=true&width=600&lines=🛡️+Advanced+Anti-Ban+Security+Protection;✨+31+Premium+Contact+Name+Formats;👤+Dynamic+Bot+Owner+Profile+Settings;💚+Status+Auto-View+and+Reaction+Cap;⚡+Lightweight+Neumorphic+React+Dashboard" alt="Typing SVG Animation" />
</p>

---

### ⚙️ CHAMA-SHIELD PIPELINE ARCHITECTURE

```mermaid
graph TD
    A[📩 Incoming Message/Status] --> B{🛡️ Anti-Spam Filter}
    B -- Spam Detected --> C[🚫 1-Hour Inbox Mute + Alert]
    B -- Safe Traffic --> D{🔍 Route Type}
    
    D -- Status Broadcast --> E[⚙️ Auto-View Queue]
    E --> F{💤 Sleepy Mode DND Check}
    F -- Night Hours 12AM-6AM --> G[⏳ Nocturnal Delay: 8x-25x]
    F -- Day Hours --> H[⏳ Normal Delay: 15s-90s]
    G --> I[👀 View Status Slide]
    H --> I
    I --> J{📈 Daily Reaction Cap}
    J -- Cap Exceeded --> K[🛑 Skip Auto-Like]
    J -- Under Cap --> L[💚 Send Delayed Reaction: 5s-20s]
    
    D -- Private DM Chat --> M{📝 Questionnaire State}
    M -- New User --> N[👋 Styled Greeting Questionnaire]
    M -- Active State --> O[✍️ Collect Details: Name/City/Age/Gender]
    O --> P{🛡️ Copy-Paste Template Bypass Guard}
    P -- Valid Input --> Q[💾 Save to MongoDB]
    P -- Invalid Input --> R[⚠️ Input Error Alert]
    Q --> S[👥 Google Contacts Sync]
    S --> T[🎉 Styled Success Message]
```

---

### 📊 WEB CONTROL DASHBOARD LAYOUT

```text
┌────────────────────────────────────────────────────────┐
│  🛡️ CHAMA-SHIELD CONTROL CENTER         [🟢 Online]   │
├────────────────────────────────────────────────────────┤
│  [21 Saved Contacts]   [0 Intercepts]   [5 Active Bots]│
├────────────────────────────────────────────────────────┤
│  ⚙️ Status Auto-View Delays: 15s - 90s                 │
│  ⚙️ Status Reaction Delays: 5s - 20s                    │
│  🛡️ Anti-Spam Inbox Mute: [Enabled]                    │
│  📈 Daily Auto-Like Reaction Cap: [250 Limit]          │
│  👤 Owner Profile: Chamindu (Galle, 18, Boy)           │
└────────────────────────────────────────────────────────┘
```

---

</div>

## 🚀 Key Features

* **🛡️ Advanced Anti-Ban Proxy Wrapper:** Dynamic browser user-agent spoofing (Chrome/Safari/Firefox), dynamic WhatsApp Web version checking, seen status duplicate filters, and human-like typing presence simulation.
* **💤 Nocturnal DND Sleepy Mode:** Human sleep simulation during late-night hours (12 AM - 6 AM) which scales status view delays by 8x-25x and lowers status reaction probability for ultimate ban prevention.
* **⚙️ Daily Status Auto-Like Reaction Cap:** Set a daily limit for status reactions directly in the web panel (resetting automatically at midnight) to prevent robotic spamming.
* **👤 Per-Device Bot Owner Profile:** Save bot owner details (name, city, age, gender) dynamically per-device to replace placeholders like `{ownerName}` and `{botNumber}` in custom success messages.
* **✨ 31 Styled Contact Naming Presets:** Interactive, scrollable layout templates grid in settings to apply pre-designed multi-line contact name formats in one click.
* **🚫 Inbox Anti-Spam Protection:** Automatically rates-limits users who spam the bot (muting their chats for 1 hour) to keep your account safe.
* **🔔 Anti-Delete Real-time DM Alerts:** Instantly captures deleted messages in groups or private chats and forwards them to your DM.

---

## ⚙️ Quick Local Setup

### 1. Installation
```bash
npm install
```

### 2. Launch Bot & Dashboard
```bash
npm start
```
* Access the web dashboard at: **`http://localhost:8080`**
* Enter your phone number with your country code (e.g. `94783314361`) to request a pair code or scan a QR code.

---

## ☁️ Cloud Deployment (Railway / Render)

CHAMA-SHIELD is built to run flawlessly on stateless cloud containers. Link your repository, configure the environment, and the container handles the rest.

### 📋 Environment Variables
* `PORT` - Port to run the server on (default `8080`).
* `MONGO_URI` - MongoDB cluster connection string.

---

<div align="center">
  <p>🕊️ <b>CHAMA-SHIELD</b> — Made with Love & Care for Status Vibes Community 💖</p>
</div>
