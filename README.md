# LeetNotes Chrome Extension

LeetNotes automatically extracts your accepted LeetCode submission, generates AI‐powered notes, and appends them (one set per page) to a Google Doc named **LeetNotes**.

## Features

- **Detect** code, problem title & language from your active LeetCode tab  
- **Generate** notes via Gemini: summary, intuition, explanation, pseudocode, dry run, complexities & suggested tags  
- **Save** into Google Docs (“LeetNotes”), creating the doc if missing, appending each on a new page  
- **UI** built with React & Tailwind CSS  
- **Toasts** for success & error feedback  
- **Secure** storage of your Gemini key & OAuth via Chrome Identity

## Setup

1. **Clone** this repo  
2. `npm install`  
3. Populate your Google OAuth Client ID in `public/manifest.json` under `oauth2.client_id`  
4. `npm run build` (or `npm run dev` for watch mode)  
5. In Chrome, visit `chrome://extensions` → **Load unpacked** → select the generated **dist/** folder  
6. Submit a solution on LeetCode, click the LeetNotes icon → **Generate Notes**  

## Development

- **Build**: `npm run build`  
- **Watch**: `npm run dev`  
- **Clean**: `rm -rf dist/ && mkdir dist/`


