# YTM-AI-Artist-Song-Blocker
A chrome extension that automatically blocks AI artists in YouTube Music and allows you to manually block artists, songs and keywords.

# YTM Artist & Song Blocker

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Privacy First](https://img.shields.io/badge/Privacy-Local%20Storage%20Only-green)](https://github.com/romiem/soul-over-ai)
[![Soul Over AI](https://img.shields.io/badge/Powered%20by-Soul%20Over%20AI-ff4e45)](https://github.com/romiem/soul-over-ai)

**The missing "Block" button for YouTube Music.**

**YTM Artist & Song Blocker** restores your sovereignty over your audio environment. It acts as a ruthless digital gatekeeper, monitoring your playback and instantly incinerating any content that matches your personal blacklist. 

Whether you need to silence a specific artist, remove low-effort AI tracks, or filter out annoying "Sped Up" versions, this extension handles it automatically.

---

## 🚫 Key Features

### 1. Integrated Control
Adds discreet **🚫 Artist** and **🚫 Song** buttons directly into the YouTube Music player bar. One click adds the current track to your blacklist without opening any menus.

### 2. The "Soul Over AI" Integration
The algorithm is increasingly polluted with "AI slop"—mass-produced, soulless noise designed to game the system. 
* **Automated Shield:** This extension integrates directly with the [Soul Over AI](https://github.com/romiem/soul-over-ai) project, an independently curated community database of confirmed AI-generated artists.
* **Auto-Sync:** A background service worker silently fetches the latest `artists.json` definition list every 5 minutes from the repository.
* **Result:** You are automatically protected from hundreds of known AI "fake artists" without lifting a finger.

### 3. Precision Blocking
* **Smart Artist Matching:** Uses intelligent tokenization. Blocking "Prince" will **not** accidentally block "Princess Nokia."
* **Specific Songs:** Blocks specific tracks by checking both the **Title** and the **Artist**. Covers of the same song by other artists will still play.

### 4. Keyword Filtering
Create custom rules to skip tracks based on title keywords.
* *Examples:* Automatically skip anything containing "Sped Up", "Nightcore", "Commentary", or "Live at".

### 5. Privacy First Architecture
* **Local Storage Only:** Your data belongs to you. All blocklists are stored locally on your device using `chrome.storage.local`.
* **No Tracking:** No external servers, no analytics, no accounts required.

---

## 📦 Installation

### Option A: Chrome Web Store
*(Link pending publication)*

### Option B: Developer Mode (Load Unpacked)
1. Download or clone this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Toggle **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the folder containing the extension files.

---

## 🛠️ Usage

### Blocking Content
* **From the Player:** Click the `🚫 Artist` or `🚫 Song` buttons injected into the player bar.
* **From the Popup:** Click the extension icon to manually add Keywords, Artists, or specific Songs.

### Managing the AI Blocklist
1. Open the extension popup.
2. Click the **DB** tab.
3. Click **🔄 Update AI Blocklist** to manually force a sync
4. The status indicator will show how many AI artists are currently being blocked.

### Backup & Restore
You can export your curated blocklist to a JSON file via the **DB** tab. This allows you to back up your hard work or transfer your list to another computer.

---

## 🔒 Privacy Policy

**1. Data Collection**
This extension does NOT collect, transmit, store, or sell any user data to external servers.

**2. Data Storage**
All data (blocked artists, songs, and keywords) is stored locally on your device.

**3. Permissions**
* `storage`: Used to save your blocklist.
* `music.youtube.com`: Used to read the current song title/artist.
* `raw.githubusercontent.com`: Used strictly to fetch the public `artists.json` file.

---

## 🤝 Credits
* **AI Database:** [Soul Over AI](https://github.com/romiem/soul-over-ai) by [Romiem](https://github.com/romiem)
