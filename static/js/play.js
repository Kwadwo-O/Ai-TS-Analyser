document.addEventListener("DOMContentLoaded", function() {
    // 1. SELECT CORE ELEMENT INTERFACES
    const rootContainer = document.getElementById("play-root");
    const modeButtons = document.querySelectorAll("#mode-selection-matrix .diff-btn");
    const diffButtons = document.querySelectorAll("#difficulty-selection-matrix .diff-btn");
    const textSizeSlider = document.getElementById("text-size-slider");
    const textSizeBadge = document.getElementById("text-size-badge");
    const textDisplay = document.getElementById("text-display");

    // Minimalist text display tracks
    const referenceTextLine = document.getElementById("reference-text-line");

    // Dynamic Language Selector Elements
    const codeLanguageContainer = document.getElementById("code-language-container");
    const codeLanguageSelect = document.getElementById("code-language-select");

    // Engine Interfaces
    const startBtn = document.getElementById("start-btn");
    const setupPanel = document.getElementById("setup-panel");
    const gamePanel = document.getElementById("game-panel");
    const hiddenCatcher = document.getElementById("hidden-keyboard-catcher");

    // Telemetry Interfaces
    const timerLabel = document.getElementById("timer-label");
    const liveWpmLabel = document.getElementById("live-wpm");

    // Keyboard Matrix Layout Assets
    const virtualKeyboard = document.getElementById("virtual-keyboard-board");
    const keyboardVisibilityToggle = document.getElementById("keyboard-visibility-toggle");
    const keyboardGlowToggle = document.getElementById("keyboard-glow-toggle");
    const rippleAnimationsToggle = document.getElementById("ripple-animations-toggle");

    // Accessibility Framework Switches
    const highContrastToggle = document.getElementById("high-contrast-toggle");
    const boldTextToggle = document.getElementById("bold-text-toggle");
    const fontStyleSelect = document.getElementById("font-style-select");

    // Local runtime variables
    let activeMode = "normal";
    let activeDifficulty = "easy";
    let activeLanguage = "python";
    let targetSentence = "";
    let startTime = null;
    let timerInterval = null;

    // Setup Baseline Execution States
    if (rootContainer) {
        rootContainer.classList.add("keyboard-glow-active");
    }

    // 2. WORKSPACE MODE SELECTOR MECHANICS
    modeButtons.forEach(button => {
        button.addEventListener("click", function() {
            modeButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeMode = this.getAttribute("data-mode");

            if (activeMode === "code") {
                if (codeLanguageContainer) codeLanguageContainer.style.display = "block";
            } else {
                if (codeLanguageContainer) codeLanguageContainer.style.display = "none";
            }
        });
    });

    if (codeLanguageSelect) {
        codeLanguageSelect.addEventListener("change", function() {
            activeLanguage = this.value;
        });
    }

    function applyDifficultyButtonColors(colorHex, hoverHex) {
        diffButtons.forEach(btn => {
            btn.style.setProperty('--local-diff-color', colorHex);
            btn.style.setProperty('--local-diff-hover', hoverHex);
        });
    }

    // 3. ENGINE DIFFICULTY SELECTOR MECHANICS
    diffButtons.forEach(button => {
        button.addEventListener("click", function() {
            diffButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeDifficulty = this.getAttribute("data-value");

            if (activeDifficulty === "easy") {
                applyDifficultyButtonColors('#2ecc71', '#27ae60');
            } else if (activeDifficulty === "medium") {
                applyDifficultyButtonColors('#f1c40f', '#d68910');
            } else if (activeDifficulty === "hard") {
                applyDifficultyButtonColors('#e74c3c', '#c0392b');
            }
        });
    });

    // Font size adjustment engine
    if (textSizeSlider) {
        textSizeSlider.addEventListener("input", function() {
            textSizeBadge.textContent = `${this.value}px`;
            if (textDisplay) textDisplay.style.fontSize = `${this.value}px`;
        });
    }

    // Accessibility Font Style Engine Switcher
    if (fontStyleSelect) {
        fontStyleSelect.addEventListener("change", function() {
            // Clear current font face flags
            textDisplay.classList.remove("font-mono", "font-sans", "font-dyslexic");

            if (this.value === "mono") textDisplay.classList.add("font-mono");
            else if (this.value === "sans") textDisplay.classList.add("font-sans");
            else if (this.value === "dyslexic") textDisplay.classList.add("font-dyslexic");
        });
    }

    // 4. API FETCH LOGIC: GENERATE PASSAGE
    if (startBtn) {
        startBtn.addEventListener("click", async function() {
            startBtn.disabled = true;

            try {
                let url = `/api/generate?difficulty=${encodeURIComponent(activeDifficulty)}&mode=${encodeURIComponent(activeMode)}`;
                if (activeMode === "code") {
                    url += `&lang=${encodeURIComponent(activeLanguage)}`;
                }

                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" }
                });

                if (!response.ok) throw new Error("Server generation failed.");
                const data = await response.json();

                targetSentence = data.sentence;
                if (!targetSentence) throw new Error("Missing string data");

            } catch (err) {
                // Hardcoded offline developer fallbacks tailored cleanly for Python / JS layout matrix
                if (activeMode === "code") {
                    if (activeLanguage === "python") {
                        targetSentence = "def process_stream(data):\n    if not data:\n        return None\n    return data.items()";
                    } else {
                        targetSentence = "function initWorkspace(data) {\n    if (!data) return null;\n    return Object.keys(data);\n}";
                    }
                } else {
                    targetSentence = "The quick brown fox jumps over the lazy dog near the programming workspace.";
                }
            } finally {
                buildTextDisplayMinimalist(targetSentence);
                setupPanel.style.display = "none";
                gamePanel.style.display = "block";

                timerLabel.textContent = "0s";
                liveWpmLabel.textContent = "0 WPM";
                startTime = null;
                clearInterval(timerInterval);
                hiddenCatcher.value = "";
                startBtn.disabled = false;

                setTimeout(() => hiddenCatcher.focus(), 100);
            }
        });
    }

    // 5. MINIMALIST TYPING DISPLAY COMPILER (IMAGE STYLE)
    function buildTextDisplayMinimalist(text) {
        if (!referenceTextLine) return;
        referenceTextLine.innerHTML = "";

        // Transform original string into normalized character tokens
        let characterArray = [];

        for (let i = 0; i < text.length; i++) {
            if (text[i] === "\n") {
                characterArray.push({ type: "enter", raw: "\n" });
            } else {
                characterArray.push({ type: "char", raw: text[i] });
            }
        }

        characterArray.forEach((token, index) => {
            const span = document.createElement("span");
            span.setAttribute("data-index", index);

            if (token.type === "enter") {
                span.className = "char-node type-enter-node";
                span.innerHTML = `<span class="enter-badge">&#x23CE; Enter</span><br>`;
            } else {
                span.className = "char-node type-char-node";
                span.textContent = token.raw;
                if (token.raw === " ") {
                    span.classList.add("is-space");
                }
            }
            referenceTextLine.appendChild(span);
        });

        // Set the active cursor node on index zero initialization frame
        updateMinimalistCursor(0);
    }

    function updateMinimalistCursor(activeIndex) {
        const nodes = referenceTextLine.querySelectorAll(".char-node");
        nodes.forEach((node) => {
            node.classList.remove("is-cursor", "is-cursor-enter");
        });

        if (activeIndex < nodes.length) {
            const activeNode = nodes[activeIndex];
            if (activeNode.classList.contains("type-enter-node")) {
                activeNode.classList.add("is-cursor-enter");
            } else {
                activeNode.classList.add("is-cursor");
            }
        }
    }

    // 6. LIVE TYPING METRICS AND INPUT HANDLING
    if (hiddenCatcher) {
        document.addEventListener("click", function(e) {
            if (gamePanel && gamePanel.style.display === "block") {
                if (e.target !== startBtn && !setupPanel.contains(e.target)) {
                    hiddenCatcher.focus();
                }
            }
        });

        hiddenCatcher.addEventListener("input", function() {
            if (!startTime) {
                startTime = new Date();
                timerInterval = setInterval(updateLiveTelemetry, 250);
            }
            evaluateMinimalistInputState();
        });
    }

    function updateLiveTelemetry() {
        if (!startTime) return;
        const elapsed = (new Date() - startTime) / 1000;
        timerLabel.textContent = Math.floor(elapsed) + "s";

        const typedVal = hiddenCatcher.value;
        if (typedVal.length > 0 && elapsed > 0.5) {
            const words = typedVal.length / 5;
            const wpm = Math.round(words / (elapsed / 60));
            liveWpmLabel.textContent = wpm + " WPM";
        }
    }

    function evaluateMinimalistInputState() {
        const typedVal = hiddenCatcher.value;
        const nodes = referenceTextLine.querySelectorAll(".char-node");

        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Check matching properties base mapping variables
            let expectedChar = targetSentence[i];

            if (i < typedVal.length) {
                const userChar = typedVal[i];
                node.classList.remove("correct", "incorrect", "incorrect-space", "incorrect-enter");

                if (userChar === expectedChar) {
                    node.classList.add("correct");
                } else {
                    if (node.classList.contains("type-enter-node")) {
                        node.classList.add("incorrect-enter");
                    } else if (expectedChar === " ") {
                        node.classList.add("incorrect-space");
                    } else {
                        node.classList.add("incorrect");
                    }
                }
            } else {
                // Unvisited nodes tracking parameters
                node.classList.remove("correct", "incorrect", "incorrect-space", "incorrect-enter");
            }
        }

        updateMinimalistCursor(typedVal.length);

        if (typedVal.length >= targetSentence.length) {
            clearInterval(timerInterval);
            console.log("Typing workspace completion targeted.");
        }
    }

    // 7. IMMEDIATE BORDER RIPPLE ENGINE
    function triggerRadiatingBorderRipple(pressedKeyElement) {
        const allKeys = document.querySelectorAll('.key');

        allKeys.forEach(key => {
            if (key === pressedKeyElement) return;

            key.classList.remove('border-ripple-fx');
            void key.offsetWidth; // Force instant global layout reflow

            key.style.animationDelay = `0ms`;
            key.classList.add('border-ripple-fx');

            key.addEventListener('animationend', function cleanup() {
                key.classList.remove('border-ripple-fx');
                key.removeEventListener('animationend', cleanup);
            });
        });
    }

    // 8. KEYBOARD EVENT BINDINGS
    window.addEventListener("keydown", function(event) {
        let targetId = event.code;
        if (event.key === " " || targetId === "Space") targetId = "Space";

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            if (targetId === "CapsLock") {
                visualKey.classList.toggle("caps-lock-active");
            }

            if (!visualKey.classList.contains("hardware-pressed-active")) {
                visualKey.classList.add("hardware-pressed-active");

                if (rippleAnimationsToggle && rippleAnimationsToggle.checked) {
                    triggerRadiatingBorderRipple(visualKey);
                }
            }
        }
    });

    window.addEventListener("keyup", function(event) {
        let targetId = event.code;
        if (event.key === " " || targetId === "Space") targetId = "Space";

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            visualKey.classList.remove("hardware-pressed-active");
        }
    });

    // 9. ACCESSIBILITY TOGGLE LISTENERS
    if (keyboardVisibilityToggle) {
        keyboardVisibilityToggle.addEventListener("change", function() {
            if (this.checked) virtualKeyboard.classList.remove("keyboard-hidden");
            else virtualKeyboard.classList.add("keyboard-hidden");
        });
    }

    if (keyboardGlowToggle) {
        keyboardGlowToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("keyboard-glow-active");
            else rootContainer.classList.remove("keyboard-glow-active");
        });
    }

    if (highContrastToggle) {
        highContrastToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("high-contrast-active");
            else rootContainer.classList.remove("high-contrast-active");
        });
    }

    if (boldTextToggle) {
        boldTextToggle.addEventListener("change", function() {
            if (this.checked) rootContainer.classList.add("bold-text-active");
            else rootContainer.classList.remove("bold-text-active");
        });
    }
});