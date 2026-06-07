# CLAUDE.md Rules for B2-to-C1 Fluency App

## Build and Run Commands
- **Install dependencies**: `npm install`
- **Start development server**: `npm run dev`
- **Build production assets**: `npm run build`
- **Preview production build**: `npm run preview`

## Invariants / Rules
- **API Token Security**: Always store the Hugging Face API token in `localStorage`. Never hardcode it in source files.
- **Model Invariant**: Use `Qwen/Qwen2.5-72B-Instruct` as the default model for text processing and analysis.
- **Web Speech APIs**: Use native browser `window.speechSynthesis` and `webkitSpeechRecognition` APIs. Always handle fallback states when speech APIs are unsupported (e.g. show warning messages).
- **Aesthetic standard**: Strictly adhere to the dark-mode glassmorphism styling defined in `src/style.css`.
