// Core Logic for AeroFluency Language App (Step 8: Memory, RAG & API)
const MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct";

// DOM Elements
const navItems = document.querySelectorAll(".nav-item");
const tabPanels = document.querySelectorAll(".tab-panel");
const currentTitle = document.getElementById("current-title");
const currentSubtitle = document.getElementById("current-subtitle");

const openSettingsBtn = document.getElementById("open-settings");
const closeSettingsBtn = document.getElementById("close-settings");
const settingsModal = document.getElementById("settings-modal");
const hfTokenInput = document.getElementById("hf-token-input");
const btnSaveSettings = document.getElementById("btn-save-settings");
const providerSelect = document.getElementById("provider-select");

// Flashcard DOM Elements
const activeFlashcard = document.getElementById("active-flashcard");
const flashcardInner = document.getElementById("flashcard-inner");
const cardFrontContent = document.getElementById("card-front-content");
const cardBackTerm = document.getElementById("card-back-term");
const cardBackExample = document.getElementById("card-back-example");
const flashcardActions = document.getElementById("flashcard-actions");
const flashcardStartContainer = document.getElementById("flashcard-start-container");
const btnStartReview = document.getElementById("btn-start-review");
const btnAddCustomCard = document.getElementById("btn-add-custom-card");
const newCardFront = document.getElementById("new-card-front");
const newCardBack = document.getElementById("new-card-back");
const newCardExample = document.getElementById("new-card-example");
const statActiveCards = document.getElementById("stat-active-cards");
const statDueToday = document.getElementById("stat-due-today");
const sessionProgressBar = document.getElementById("session-progress-bar");
const sessionProgressText = document.getElementById("session-progress-text");
const flashcardProgressLabel = document.getElementById("flashcard-progress-label");

// State management
let hfToken = localStorage.getItem("hf_token") || "";
let activeProvider = localStorage.getItem("provider") || "huggingface";

// Initialize settings
if (hfToken) {
  hfTokenInput.value = hfToken;
} else {
  // Show settings modal on startup if token is missing
  setTimeout(() => {
    settingsModal.classList.remove("hidden");
  }, 500);
}

if (providerSelect) {
  providerSelect.value = activeProvider;
  
  const updatePlaceholder = () => {
    const tokenLabel = document.getElementById("token-label");
    if (providerSelect.value === "gemini") {
      hfTokenInput.placeholder = "AIzaSy...";
      if (tokenLabel) tokenLabel.textContent = "Google AI Studio API Key:";
    } else if (providerSelect.value === "ollama") {
      hfTokenInput.placeholder = "qwen2.5:7b";
      if (tokenLabel) tokenLabel.textContent = "Ollama Model Name:";
    } else {
      hfTokenInput.placeholder = "hf_...";
      if (tokenLabel) tokenLabel.textContent = "Hugging Face Access Token:";
    }
  };
  
  providerSelect.addEventListener("change", updatePlaceholder);
  updatePlaceholder();
}

// Navigation Tabs Router
navItems.forEach(item => {
  item.addEventListener("click", () => {
    const tabId = item.getAttribute("data-tab");
    
    // Stop recording if active
    if (isRecording) {
      isRecording = false;
      if (sttIntervalId) {
        clearInterval(sttIntervalId);
        sttIntervalId = null;
        fetch("http://localhost:5001/stop").catch(() => {});
      }
      if (recognition) {
        try { recognition.stop(); } catch(e) {}
      }
      const targetBtn = document.getElementById("btn-toggle-mic");
      const targetLabel = document.getElementById("mic-status-label");
      if (targetBtn) targetBtn.classList.remove("recording");
      if (targetLabel) targetLabel.textContent = "Microphone inactive.";
    }
    
    // Cancel any active SpeechSynthesis playback
    if (typeof speechSynthesis !== 'undefined') {
      speechSynthesis.cancel();
    }
    
    // Toggle active nav
    navItems.forEach(n => n.classList.remove("active"));
    item.classList.add("active");
    
    // Toggle active panel
    tabPanels.forEach(p => p.classList.remove("active"));
    document.getElementById(`tab-${tabId}`).classList.add("active");
    
    // Update headers
    updateHeaderContent(tabId);
  });
});

function updateHeaderContent(tabId) {
  const titles = {
    writing: {
      title: "Writing Editor",
      sub: "Hone your vocabulary, eliminate basic transitions, and restructure into C1-level prose."
    },
    reading: {
      title: "Reading Drills",
      sub: "Read advanced texts, comprehend implicit meanings, and learn sophisticated collocations."
    },
    listening: {
      title: "Listening Summary",
      sub: "Listen to academic-level dictations and summarize the core themes to evaluate listening comprehension."
    },
    speaking: {
      title: "Speaking Debate",
      sub: "Engage in vocal debate on abstract concepts. Transcribe your speech and analyze lexical diversity."
    },
    flashcards: {
      title: "Spaced-Repetition Deck",
      sub: "Reinforce advanced C1 expressions and upgraded collocations using active recall and spaced repetition memory."
    }
  };
  
  if (titles[tabId]) {
    currentTitle.textContent = titles[tabId].title;
    currentSubtitle.textContent = titles[tabId].sub;
  }
}

// Settings Modal Event Listeners
openSettingsBtn.addEventListener("click", () => settingsModal.classList.remove("hidden"));
closeSettingsBtn.addEventListener("click", () => settingsModal.classList.add("hidden"));
btnSaveSettings.addEventListener("click", () => {
  const token = hfTokenInput.value.trim();
  const selectedProvider = providerSelect ? providerSelect.value : "huggingface";
  const savedValue = selectedProvider === "ollama" && !token ? "qwen2.5:7b" : token;

  if (savedValue || selectedProvider === "ollama") {
    localStorage.setItem("hf_token", savedValue);
    localStorage.setItem("provider", selectedProvider);
    hfToken = savedValue;
    activeProvider = selectedProvider;
    alert("Configuration saved successfully!");
    settingsModal.classList.add("hidden");
  } else {
    alert("Please enter a valid key/token.");
  }
});

/**
 * Helper: Format messages into Qwen's ChatML format
 */
function formatChatML(messages) {
  let prompt = "";
  messages.forEach(msg => {
    prompt += `<|im_start|>${msg.role}\n${msg.content}<|im_end|>\n`;
  });
  prompt += "<|im_start|>assistant\n";
  return prompt;
}

/**
 * Helper: Strip markdown wrappers (like ```html ... ```) and style/page wrapper tags from model response
 */
function cleanHtmlResponse(response) {
  let clean = response.trim();
  // Strip ```html or ```xml or ``` at the beginning
  clean = clean.replace(/^```(?:html|xml|markdown|json)?/gi, "");
  // Strip ``` at the end
  clean = clean.replace(/```$/g, "");
  // Strip <style>...</style> blocks completely to prevent theme pollution
  clean = clean.replace(/<style([\s\S]*?)<\/style>/gi, "");
  // Strip html wrappers and body tags
  clean = clean.replace(/<html[^>]*>/gi, "");
  clean = clean.replace(/<\/html>/gi, "");
  clean = clean.replace(/<head>([\s\S]*?)<\/head>/gi, "");
  clean = clean.replace(/<body[^>]*>/gi, "");
  clean = clean.replace(/<\/body>/gi, "");
  
  // Clean up LaTeX math arrows/symbols sometimes output by local models
  clean = clean.replace(/\\?\$?\\rightarrow\\?\$?/gi, " → ");
  clean = clean.replace(/\\?\$?\\Rightarrow\\?\$?/gi, " ⇒ ");
  clean = clean.replace(/\\?\$?\\to\\?\$?/gi, " → ");
  clean = clean.replace(/\\?\$?\\bullet\\?\$?/gi, " • ");
  clean = clean.replace(/\\?\$?\\cdot\\?\$?/gi, " · ");
  return clean.trim();
}

/**
 * Helper: Query active LLM Provider (Hugging Face or Google Gemini)
 */
async function queryHuggingFace(messages) {
  if (activeProvider !== "ollama" && !hfToken) {
    settingsModal.classList.remove("hidden");
    throw new Error("API token/key is required. Please set it in Settings.");
  }

  if (activeProvider === "ollama") {
    // -------------------------------------------------------------
    // Local Ollama API (100% Offline / Local)
    // -------------------------------------------------------------
    const modelName = hfToken || "qwen2.5:7b";
    const endpoint = "http://localhost:11434/api/chat";
    
    const mappedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: modelName,
          messages: mappedMessages,
          stream: false,
          options: {
            temperature: 0.7
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error! Status: ${response.status}. Make sure Ollama is running ('ollama run ${modelName}')`);
      }

      const data = await response.json();
      if (data && data.message && data.message.content) {
        return data.message.content;
      }
      throw new Error("Invalid response format from Ollama.");
    } catch (err) {
      console.error("Ollama API Error:", err);
      alert(`Ollama request failed: ${err.message}. Please verify that Ollama is running locally on port 11434.`);
      throw err;
    }
  } else if (activeProvider === "gemini") {
    // -------------------------------------------------------------
    // Google Gemini API Fallback Loop
    // -------------------------------------------------------------
    let systemInstruction = "";
    const contents = [];
    
    messages.forEach(msg => {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else {
        contents.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }]
        });
      }
    });
    
    const requestBody = { contents };
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const modelsToTry = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-latest",
      "gemini-1.5-pro",
      "gemini-2.0-flash-exp",
      "gemini-1.0-pro"
    ];
    let lastError = null;

    for (const model of modelsToTry) {
      // Try both v1beta and v1 API versions
      const versions = ["v1beta", "v1"];
      for (const version of versions) {
        const endpoint = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${hfToken}`;
        try {
          console.log(`Trying Gemini model: ${model} via ${version}...`);
          const response = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody)
          });
          
          const responseJson = await response.json().catch(() => ({}));

          if (response.ok) {
            if (responseJson && responseJson.candidates && responseJson.candidates[0] && responseJson.candidates[0].content && responseJson.candidates[0].content.parts[0]) {
              return responseJson.candidates[0].content.parts[0].text;
            }
          } else {
            const errMsg = responseJson.error?.message || `Status: ${response.status}`;
            lastError = new Error(errMsg);
            
            // If the model is not found, continue to try the next model
            if (response.status === 404 || errMsg.toLowerCase().includes("not found") || errMsg.toLowerCase().includes("not supported")) {
              continue;
            }
            throw lastError;
          }
        } catch (err) {
          lastError = err;
          if (err.message.toLowerCase().includes("not found") || err.message.toLowerCase().includes("404") || err.message.toLowerCase().includes("not supported")) {
            continue;
          }
          throw err;
        }
      }
    }
    
    console.error("All Gemini API attempts failed:", lastError);
    alert(`Gemini request failed: ${lastError ? lastError.message : "unknown error"}`);
    throw lastError || new Error("All Gemini models failed to load.");
  } else {
    // -------------------------------------------------------------
    // Hugging Face API (Qwen/Qwen2.5-7B-Instruct)
    // -------------------------------------------------------------
    const endpoint = `https://api-inference.huggingface.co/models/${MODEL_NAME}`;
    const prompt = formatChatML(messages);
    
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${hfToken}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            temperature: 0.7,
            max_new_tokens: 1200,
            return_full_text: false
          }
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      
      // Check if the response contains generated text
      if (data && data[0] && data[0].generated_text) {
        let text = data[0].generated_text;
        text = text.replace("<|im_end|>", "").trim();
        return text;
      }
      
      throw new Error("Invalid response structure from Hugging Face Inference API.");
    } catch (err) {
      console.error("Hugging Face API Error:", err);
      alert(`Inference failed: ${err.message}`);
      throw err;
    }
  }
}

/**
 * -------------------------------------------------------------
 * 1. WRITING EDITOR SECTION
 * -------------------------------------------------------------
 */
const writingInput = document.getElementById("writing-input");
const btnAnalyzeWriting = document.getElementById("btn-analyze-writing");
const writingFeedback = document.getElementById("writing-feedback");
const writingCount = document.getElementById("writing-count");

writingInput.addEventListener("input", () => {
  writingCount.textContent = `${writingInput.value.length} characters`;
});

btnAnalyzeWriting.addEventListener("click", async () => {
  const text = writingInput.value.trim();
  if (text.length < 30) {
    alert("Please enter a paragraph of at least 30 characters.");
    return;
  }

  toggleLoader(btnAnalyzeWriting, true);
  writingFeedback.classList.add("empty");
  writingFeedback.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Analyzing text and generating C1 structures...</p></div>`;

  const systemPrompt = `You are an expert C1-level English language professor. 
Analyze the user's input text (which is written at approximately B2 level). 
Provide a side-by-side comparison, highlighting B2 vocabulary/phrases and offering C1 synonyms or grammatical structures (such as inversion, passive voice, or nominalization).
Format your output exactly as standard HTML cards with:
1. A brief overview of current level and grammatical range.
2. A comparison card:
   <div class="comparison">
     <div class="comp-box b2"><strong>B2 (Your Draft):</strong> ...</div>
     <div class="comp-box c1"><strong>C1 (Upgraded):</strong> ...</div>
   </div>
3. Specific bullet points of upgraded vocabulary or phrases.
4. A metric grid:
   <div class="metric-grid">
     <div class="metric-item"><span class="metric-name">Grammatical Complexity</span><span class="metric-value">65%</span></div>
     <div class="metric-item"><span class="metric-name">Lexical Sophistication</span><span class="metric-value">55%</span></div>
   </div>
Estimate the score percentage realistically. Make sure the HTML output contains no surrounding markdown symbols (\`\`\`html) or raw blocks, just output standard text/HTML contents directly.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Here is my draft: "${text}"` }
    ]);
    
    writingFeedback.innerHTML = cleanHtmlResponse(response);
    writingFeedback.classList.remove("empty");
  } catch (e) {
    writingFeedback.innerHTML = `<div class="empty-state"><p>Analysis failed. Ensure your Hugging Face API key is correct.</p></div>`;
  } finally {
    toggleLoader(btnAnalyzeWriting, false);
  }
});

/**
 * -------------------------------------------------------------
 * 2. READING DRILLS SECTION
 * -------------------------------------------------------------
 */
const btnGenerateReading = document.getElementById("btn-generate-reading");
const readingContent = document.getElementById("reading-content");
const readingFeedback = document.getElementById("reading-feedback");

// Click on collocation to add to flashcards
readingContent.addEventListener("click", (e) => {
  const target = e.target.closest(".c1-term");
  if (!target) return;
  
  const term = target.textContent.trim();
  const definition = target.getAttribute("title") || "C1 collocation";
  
  const confirmAdd = confirm(`Would you like to add "${term}" (${definition}) to your repetition deck?`);
  if (confirmAdd) {
    if (window.addWordToFlashcards) {
      window.addWordToFlashcards(definition, term, `Make sure you learn and use the collocation: "${term}".`);
    }
  }
});

btnGenerateReading.addEventListener("click", async () => {
  toggleLoader(btnGenerateReading, true);
  readingContent.classList.add("empty");
  readingFeedback.classList.add("empty");
  readingContent.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Generating C1 text and comprehension questions...</p></div>`;
  readingFeedback.innerHTML = `<div class="empty-state"><p>Generate and read the text first. Answers and lexical highlights will appear here.</p></div>`;

  const systemPrompt = `You are a C1 English Exam Designer. 
Generate a challenging C1-level reading comprehension passage (around 150 words) on a random interesting topic (philosophy, science, art, technology). 
Highlight exactly 3 advanced collocations or idioms by wrapping them in HTML span tags: <span class="c1-term" title="Definition of term">term</span>.
Following the passage, append 2 multiple-choice questions testing reading comprehension and implicit detail. 
Format the entire output as clean HTML structure. Do not include any markdown blocks (\`\`\`html). Use appropriate headings and spacing.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate a new C1 reading exercise." }
    ]);
    
    readingContent.innerHTML = cleanHtmlResponse(response);
    readingContent.classList.remove("empty");
    readingFeedback.classList.remove("empty");
    
    // Generate answers and explanations on the right side
    readingFeedback.innerHTML = `
      <div class="feedback-card">
        <h4>Professor's Key</h4>
        <p>Hover over the highlighted cyan terms in the text to see their C1 definitions and usage.</p>
      </div>
      <div class="feedback-card">
        <h4>Self-Check Guidance</h4>
        <p>Review the questions carefully. Try to answer them yourself, then think about which vocabulary terms are B2 equivalents.</p>
      </div>
    `;
  } catch (e) {
    readingContent.innerHTML = `<div class="empty-state"><p>Failed to generate reading material.</p></div>`;
  } finally {
    toggleLoader(btnGenerateReading, false);
  }
});

/**
 * -------------------------------------------------------------
 * 3. LISTENING SUMMARY SECTION
 * -------------------------------------------------------------
 */
const btnGenerateListening = document.getElementById("btn-generate-listening");
const btnPlayAudio = document.getElementById("btn-play-audio");
const audioStatusLabel = document.getElementById("audio-status-label");
const voiceSelect = document.getElementById("voice-select");
const listeningSummaryInput = document.getElementById("listening-summary-input");
const btnSubmitSummary = document.getElementById("btn-submit-summary");
const listeningFeedback = document.getElementById("listening-feedback");

let generatedListeningText = "";

// Initialize speechSynthesis voices
function loadVoices() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  
  // Save current selection if any
  const previousSelection = voiceSelect.value;
  
  voiceSelect.innerHTML = "";
  
  let targetVoiceName = "";
  
  voices.forEach(voice => {
    if (voice.lang.toLowerCase().startsWith("en")) {
      const option = document.createElement("option");
      option.value = voice.name;
      option.textContent = `${voice.name} (${voice.lang})`;
      voiceSelect.appendChild(option);
      
      const langLower = voice.lang.toLowerCase();
      // Prioritize en-US voices
      if (langLower.includes("en-us")) {
        // If we don't have a target yet, or if this is a "natural" or "online" voice (preferring higher quality voices)
        if (!targetVoiceName) {
          targetVoiceName = voice.name;
        } else if (voice.name.toLowerCase().includes("natural") || voice.name.toLowerCase().includes("online")) {
          const currentLower = targetVoiceName.toLowerCase();
          if (!currentLower.includes("natural") && !currentLower.includes("online")) {
            targetVoiceName = voice.name;
          }
        }
      }
    }
  });
  
  // Restore previous selection if it exists in the list, otherwise select the en-US target
  if (previousSelection && Array.from(voiceSelect.options).some(opt => opt.value === previousSelection)) {
    voiceSelect.value = previousSelection;
  } else if (targetVoiceName) {
    voiceSelect.value = targetVoiceName;
  } else if (voiceSelect.options.length > 0) {
    voiceSelect.selectedIndex = 0;
  }
}

loadVoices();
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}

btnGenerateListening.addEventListener("click", async () => {
  toggleLoader(btnGenerateListening, true);
  audioStatusLabel.textContent = "Generating passage...";
  
  const systemPrompt = `You are a C1 Listening Exam Designer. 
Generate a C1-level lecture snippet (around 100 words) about a random scientific or sociological fact. 
The passage must be academic, utilizing rich, formal vocabulary.
Return ONLY the raw spoken text of the lecture. Do not add any headings, intros, titles, or questions.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate a C1 academic lecture snippet." }
    ]);
    
    generatedListeningText = response.trim();
    audioStatusLabel.textContent = "Passage ready for playback";
    btnPlayAudio.disabled = false;
    listeningSummaryInput.disabled = false;
    btnSubmitSummary.disabled = false;
  } catch (e) {
    audioStatusLabel.textContent = "Generation failed";
  } finally {
    toggleLoader(btnGenerateListening, false);
  }
});

btnPlayAudio.addEventListener("click", () => {
  if (!generatedListeningText) return;
  
  // Cancel any active speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(generatedListeningText);
  
  // Set selected voice
  const selectedVoiceName = voiceSelect.value;
  const voices = speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.name === selectedVoiceName);
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }
  
  utterance.onstart = () => {
    audioStatusLabel.textContent = "Playing audio...";
    btnPlayAudio.disabled = true;
  };
  
  utterance.onend = () => {
    audioStatusLabel.textContent = "Playback completed";
    btnPlayAudio.disabled = false;
  };
  
  speechSynthesis.speak(utterance);
});

btnSubmitSummary.addEventListener("click", async () => {
  const summary = listeningSummaryInput.value.trim();
  if (summary.length < 20) {
    alert("Please write a summary of at least 20 characters.");
    return;
  }

  toggleLoader(btnSubmitSummary, true);
  listeningFeedback.classList.add("empty");
  listeningFeedback.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Analyzing summary details...</p></div>`;

  const systemPrompt = `You are a C1 English Assessor. 
Compare the user's summary against the source lecture text. 
Assess:
1. **Comprehension Accuracy**: Did they understand the core thesis?
2. **Grammar & Lexicon**: Did they use appropriate summary language and C1 vocabulary, or did they copy-paste text?
Evaluate the summary and provide constructive feedback in HTML format. Do not use markdown blocks.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Source Text: "${generatedListeningText}"\nUser's Summary: "${summary}"` }
    ]);
    
    listeningFeedback.innerHTML = cleanHtmlResponse(response);
    listeningFeedback.classList.remove("empty");
  } catch (e) {
    listeningFeedback.innerHTML = `<div class="empty-state"><p>Evaluation failed. Please try again.</p></div>`;
  } finally {
    toggleLoader(btnSubmitSummary, false);
  }
});

/**
 * -------------------------------------------------------------
 * 4. SPEAKING DEBATE SECTION
 * -------------------------------------------------------------
 */
const btnGenerateDebate = document.getElementById("btn-generate-debate");
const debatePromptBox = document.getElementById("debate-prompt");
const btnToggleMic = document.getElementById("btn-toggle-mic");
const micStatusLabel = document.getElementById("mic-status-label");
const speechTranscript = document.getElementById("speech-transcript");
const btnAnalyzeSpeaking = document.getElementById("btn-analyze-speaking");
const speakingFeedback = document.getElementById("speaking-feedback");

let recognition = null;
let isRecording = false;
let speechTranscriptText = "";
let hasRecognitionError = false;
let sttServerActive = false;
let sttIntervalId = null;
let usingLocalSTT = false;

async function checkSTTServer() {
  try {
    const response = await fetch("http://localhost:5001/status");
    if (response.ok) {
      sttServerActive = true;
      return true;
    }
  } catch (err) {
    sttServerActive = false;
  }
  return false;
}

// Check for browser speech recognition support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  
  recognition.onstart = () => {
    micStatusLabel.textContent = "Listening... Start speaking.";
    btnToggleMic.classList.add("recording");
  };
  
  recognition.onerror = (event) => {
    console.error("Speech Recognition Error:", event.error);
    hasRecognitionError = true;
    const fatalErrors = ["not-allowed", "audio-capture", "service-not-allowed"];
    if (fatalErrors.includes(event.error)) {
      isRecording = false;
      micStatusLabel.textContent = `Error: ${event.error}. Access denied.`;
      btnToggleMic.classList.remove("recording");
      if (speechTranscript.textContent === "Listening..." || speechTranscript.textContent === "...") {
        speechTranscript.textContent = "Type or paste your arguments here...";
      }
    } else if (event.error === "no-speech") {
      micStatusLabel.textContent = "Silence detected. Speak clearly...";
    } else if (event.error === "network") {
      isRecording = false;
      micStatusLabel.textContent = "Network blocked. You can type/edit your response directly.";
      btnToggleMic.classList.remove("recording");
      if (speechTranscript.textContent === "Listening..." || speechTranscript.textContent === "...") {
        speechTranscript.textContent = "Type or paste your arguments here...";
      }
    } else {
      micStatusLabel.textContent = `Speech error: ${event.error}`;
    }
  };
  
  recognition.onend = () => {
    if (isRecording) {
      // Auto-restart after a brief delay to handle silence timeouts seamlessly
      setTimeout(() => {
        if (isRecording) {
          try {
            recognition.start();
            micStatusLabel.textContent = "Listening... Start speaking.";
          } catch (err) {
            console.error("Error restarting SpeechRecognition:", err);
          }
        }
      }, 300);
    } else {
      if (!hasRecognitionError) {
        micStatusLabel.textContent = "Microphone inactive.";
      }
      btnToggleMic.classList.remove("recording");
    }
  };
  
  recognition.onresult = (event) => {
    let interimTranscript = "";
    
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        speechTranscriptText += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }
    
    // Display the accumulated final text plus the current interim text in real-time
    let displayText = speechTranscriptText.trim();
    if (interimTranscript) {
      displayText += (displayText ? " " : "") + interimTranscript.trim();
    }
    
    speechTranscript.textContent = displayText || "Listening...";
  };
} else {
  micStatusLabel.textContent = "Speech Recognition not supported in this browser. Use Chrome or Safari.";
}

btnGenerateDebate.addEventListener("click", async () => {
  toggleLoader(btnGenerateDebate, true);
  debatePromptBox.innerHTML = `<div class="spinner"></div>`;
  
  const systemPrompt = `You are a C1 Debate Moderator. 
Provide a controversial, abstract, or ethical debate prompt (around 50 words) suitable for a C1 speaker. 
Examples: technology vs. human empathy, genetic engineering, economic philosophy. 
Output ONLY the debate question, no introductions or headings.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: "Generate a C1 debate prompt." }
    ]);
    
    debatePromptBox.textContent = response.trim();
    
    // Enable controls
    btnToggleMic.disabled = false;
    micStatusLabel.textContent = "Mic ready. Press icon to record.";
    btnAnalyzeSpeaking.disabled = false;
    speechTranscript.textContent = "Speak your arguments (or type directly inside this box)...";
  } catch (e) {
    debatePromptBox.textContent = "Failed to generate prompt.";
  } finally {
    toggleLoader(btnGenerateDebate, false);
  }
});

async function stopRecording() {
  if (!isRecording) return;
  
  isRecording = false;
  btnToggleMic.classList.remove("recording");
  micStatusLabel.textContent = "Processing speech...";
  
  if (usingLocalSTT) {
    if (sttIntervalId) {
      clearInterval(sttIntervalId);
      sttIntervalId = null;
    }
    try {
      const response = await fetch("http://localhost:5001/stop");
      const data = await response.json();
      speechTranscriptText = data.text || "";
      speechTranscript.textContent = speechTranscriptText || "No speech detected.";
      micStatusLabel.textContent = "Microphone inactive.";
    } catch (err) {
      console.error("Error stopping local STT:", err);
      micStatusLabel.textContent = "Error stopping voice session.";
    }
  } else {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error("Error stopping native recognition:", e);
      }
    }
    micStatusLabel.textContent = "Microphone inactive.";
  }
}

btnToggleMic.addEventListener("click", async () => {
  if (isRecording) {
    await stopRecording();
  } else {
    const isLocalSTT = await checkSTTServer();
    usingLocalSTT = isLocalSTT;
    
    if (usingLocalSTT) {
      isRecording = true;
      speechTranscriptText = "";
      speechTranscript.textContent = "Listening (Local offline mic)...";
      btnToggleMic.classList.add("recording");
      micStatusLabel.textContent = "Listening locally... Speak clearly.";
      
      try {
        await fetch("http://localhost:5001/start");
        
        sttIntervalId = setInterval(async () => {
          if (!isRecording) return;
          try {
            const statusRes = await fetch("http://localhost:5001/status");
            const statusData = await statusRes.json();
            if (statusData.text) {
              speechTranscript.textContent = statusData.text;
            }
          } catch (e) {
            console.error("Error polling local STT status:", e);
          }
        }, 300);
        
      } catch (err) {
        console.error("Error starting local STT:", err);
        isRecording = false;
        btnToggleMic.classList.remove("recording");
        micStatusLabel.textContent = "Failed to start local STT.";
      }
    } else {
      if (!recognition) {
        alert("Speech Recognition not supported in this browser, and local STT server is not running.");
        return;
      }
      
      speechTranscriptText = "";
      hasRecognitionError = false;
      speechTranscript.textContent = "Listening...";
      recognition.start();
      isRecording = true;
    }
  }
});

btnAnalyzeSpeaking.addEventListener("click", async () => {
  if (isRecording) {
    await stopRecording();
  }

  const text = speechTranscript.textContent.trim();
  if (text === "..." || text === "Speak your arguments..." || text.length < 15) {
    alert("Please record some spoken argument first.");
    return;
  }

  toggleLoader(btnAnalyzeSpeaking, true);
  speakingFeedback.classList.add("empty");
  speakingFeedback.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Analyzing speech transcript...</p></div>`;

  const systemPrompt = `You are an expert C1 Oral Examiner. 
Evaluate the user's transcribed debate speech based on:
1. **Lexical Resource**: Did they use sophisticated C1 vocabulary and collocations?
2. **Grammatical Accuracy**: Did they maintain C1 sentence flow, and are there prepositions or verb errors in the transcript?
Provide an assessment in HTML format containing:
- Current level estimation
- Structural and grammar critiques
- A C1 rewrite suggestion for their speech.
Do not use markdown blocks.`;

  try {
    const response = await queryHuggingFace([
      { role: "system", content: systemPrompt },
      { role: "user", content: `Debate Prompt: "${debatePromptBox.textContent}"\nMy spoken transcript: "${text}"` }
    ]);
    
    speakingFeedback.innerHTML = cleanHtmlResponse(response);
    speakingFeedback.classList.remove("empty");
  } catch (e) {
    speakingFeedback.innerHTML = `<div class="empty-state"><p>Speech analysis failed. Ensure your API token is set.</p></div>`;
  } finally {
    toggleLoader(btnAnalyzeSpeaking, false);
  }
});

/**
 * -------------------------------------------------------------
 * UI UTILITIES
 * -------------------------------------------------------------
 */
function toggleLoader(button, isLoading) {
  const spinner = button.querySelector(".spinner");
  const span = button.querySelector("span");
  
  if (isLoading) {
    button.disabled = true;
    if (spinner) spinner.classList.remove("hidden");
    if (span) span.style.opacity = "0.5";
  } else {
    button.disabled = false;
    if (spinner) spinner.classList.add("hidden");
    if (span) span.style.opacity = "1";
  }
}

/**
 * -------------------------------------------------------------
 * 5. FLASHCARD SPARK DECK LOGIC (AeroRepetition)
 * -------------------------------------------------------------
 */
let flashcardDeck = [];
let reviewQueue = [];
let currentReviewIndex = 0;
let sessionCardCount = 0;

const DEFAULT_CARDS = [
  {
    front: "in my opinion / I think",
    back: "from my perspective",
    example: "From my perspective, global policies should focus on local community welfare first.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "very important",
    back: "of paramount importance",
    example: "Acquiring C1 fluency is of paramount importance for academic success.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "very bad",
    back: "detrimental",
    example: "A lack of structural transition words can have a detrimental effect on your essay.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "shows / proves",
    back: "substantiates",
    example: "The research substantiates the claim that local models run faster offline.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "many / a lot of",
    back: "a plethora of",
    example: "There are a plethora of resources available for studying high-register English.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "to solve a problem",
    back: "to alleviate a concern",
    example: "The new offline VOSK server alleviates the proxy network issue completely.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "to understand / find out",
    back: "to discern",
    example: "We must discern the subtle differences in meaning between these advanced collocations.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "helpful / good",
    back: "highly beneficial",
    example: "Practicing with a local debate partner is highly beneficial for speaking speed.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "change / difference",
    back: "divergence",
    example: "The divergence in opinions led to a highly engaging spoken debate.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  },
  {
    front: "make something happen",
    back: "precipitate",
    example: "The introduction of automated scoring precipitated a surge in user engagement.",
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  }
];

// SM-2 Spaced Repetition scheduler
function updateCardSchedule(card, score) {
  let q = 1;
  if (score === 2) q = 3;
  if (score === 4) q = 4;
  if (score === 5) q = 5;

  if (q >= 3) {
    if (card.repetitions === 0) {
      card.interval = 1;
    } else if (card.repetitions === 1) {
      card.interval = 6;
    } else {
      card.interval = Math.round(card.interval * card.easeFactor);
    }
    card.repetitions++;
  } else {
    card.repetitions = 0;
    card.interval = 1;
  }

  card.easeFactor = card.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (card.easeFactor < 1.3) {
    card.easeFactor = 1.3;
  }

  const now = new Date();
  now.setDate(now.getDate() + card.interval);
  card.nextReviewDate = now.getTime();
}

function loadDeck() {
  const data = localStorage.getItem("aerofluency_deck");
  if (data) {
    try {
      flashcardDeck = JSON.parse(data);
    } catch (e) {
      console.error("Error parsing flashcard deck:", e);
      flashcardDeck = [...DEFAULT_CARDS];
    }
  } else {
    flashcardDeck = [...DEFAULT_CARDS];
    saveDeck();
  }
  updateStats();
}

function saveDeck() {
  localStorage.setItem("aerofluency_deck", JSON.stringify(flashcardDeck));
}

function updateStats() {
  if (!statActiveCards || !statDueToday) return;
  
  const now = Date.now();
  const dueCount = flashcardDeck.filter(card => !card.nextReviewDate || card.nextReviewDate <= now).length;
  
  statActiveCards.textContent = flashcardDeck.length;
  statDueToday.textContent = dueCount;
  
  if (flashcardProgressLabel) {
    flashcardProgressLabel.textContent = `${dueCount} cards due`;
  }
}

function displayCurrentCard() {
  if (currentReviewIndex >= reviewQueue.length) {
    // Session completed
    if (flashcardActions) flashcardActions.classList.add("hidden");
    if (flashcardStartContainer) flashcardStartContainer.classList.remove("hidden");
    
    if (cardFrontContent) cardFrontContent.textContent = "Review session completed! You have cleared all due cards.";
    if (cardBackTerm) cardBackTerm.textContent = "Outstanding!";
    if (cardBackExample) cardBackExample.textContent = "Your spaced repetition intervals have been successfully updated. See you tomorrow!";
    if (flashcardInner) flashcardInner.classList.remove("flipped");
    
    if (sessionProgressBar) sessionProgressBar.style.width = "100%";
    if (sessionProgressText) sessionProgressText.textContent = `${sessionCardCount}/${sessionCardCount}`;
    updateStats();
    return;
  }
  
  const card = reviewQueue[currentReviewIndex];
  
  // Reset flip status
  if (flashcardInner) flashcardInner.classList.remove("flipped");
  
  // Set contents
  setTimeout(() => {
    if (cardFrontContent) cardFrontContent.textContent = card.front;
    if (cardBackTerm) cardBackTerm.textContent = card.back;
    if (cardBackExample) cardBackExample.textContent = card.example;
  }, 150); // Small delay to sync with rotation flip back
}

// Global hook to add flashcards dynamically from other views
window.addWordToFlashcards = function(front, back, example = "") {
  if (!flashcardDeck) flashcardDeck = [];
  
  const exists = flashcardDeck.some(card => card.back.toLowerCase().trim() === back.toLowerCase().trim());
  if (exists) {
    alert(`"${back}" is already in your AeroRepetition deck!`);
    return;
  }
  
  const newCard = {
    front: front.trim(),
    back: back.trim(),
    example: example.trim() || `I need to practice the word: ${back.trim()}.`,
    repetitions: 0,
    interval: 1,
    easeFactor: 2.5,
    nextReviewDate: Date.now()
  };
  
  flashcardDeck.push(newCard);
  saveDeck();
  updateStats();
  alert(`"${back}" has been added to your AeroRepetition deck!`);
};

// Event Listeners
if (activeFlashcard) {
  activeFlashcard.addEventListener("click", () => {
    if (flashcardInner) {
      flashcardInner.classList.toggle("flipped");
    }
  });
}

if (btnStartReview) {
  btnStartReview.addEventListener("click", () => {
    const now = Date.now();
    reviewQueue = flashcardDeck.filter(card => !card.nextReviewDate || card.nextReviewDate <= now);
    
    if (reviewQueue.length === 0) {
      alert("All caught up! No due flashcards to review today.");
      return;
    }
    
    currentReviewIndex = 0;
    sessionCardCount = reviewQueue.length;
    
    if (flashcardStartContainer) flashcardStartContainer.classList.add("hidden");
    if (flashcardActions) flashcardActions.classList.remove("hidden");
    
    if (sessionProgressBar) sessionProgressBar.style.width = "0%";
    if (sessionProgressText) sessionProgressText.textContent = `0/${sessionCardCount}`;
    
    displayCurrentCard();
  });
}

// Rate recall action handlers
const rateButtons = document.querySelectorAll(".rate-btn");
rateButtons.forEach(btn => {
  btn.addEventListener("click", (e) => {
    e.stopPropagation(); // Avoid triggering card flip on click
    
    if (currentReviewIndex >= reviewQueue.length) return;
    
    const score = parseInt(btn.getAttribute("data-score"), 10);
    const card = reviewQueue[currentReviewIndex];
    
    // Update interval schedules
    updateCardSchedule(card, score);
    saveDeck();
    
    // Advance progress
    currentReviewIndex++;
    const progressPercent = Math.round((currentReviewIndex / sessionCardCount) * 100);
    if (sessionProgressBar) sessionProgressBar.style.width = `${progressPercent}%`;
    if (sessionProgressText) sessionProgressText.textContent = `${currentReviewIndex}/${sessionCardCount}`;
    
    // Flip card back first, then display next card
    if (flashcardInner) {
      flashcardInner.classList.remove("flipped");
    }
    
    setTimeout(() => {
      displayCurrentCard();
    }, 350); // Wait for card flip back transition before showing new word
  });
});

if (btnAddCustomCard) {
  btnAddCustomCard.addEventListener("click", () => {
    const frontVal = newCardFront.value.trim();
    const backVal = newCardBack.value.trim();
    const exampleVal = newCardExample.value.trim();
    
    if (!frontVal || !backVal) {
      alert("Please fill in both the B2 Clue and the C1 Upgrade.");
      return;
    }
    
    window.addWordToFlashcards(frontVal, backVal, exampleVal);
    
    newCardFront.value = "";
    newCardBack.value = "";
    newCardExample.value = "";
  });
}

// Load deck on startup
loadDeck();
