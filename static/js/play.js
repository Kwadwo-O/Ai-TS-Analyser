document.addEventListener("DOMContentLoaded", function() {
    // 1. SELECT CORE ELEMENT INTERFACES
    const rootContainer = document.getElementById("play-root");
    const modeButtons = document.querySelectorAll("#mode-selection-matrix .diff-btn");
    const diffButtons = document.querySelectorAll("#difficulty-selection-matrix .diff-btn");
    const textSizeSlider = document.getElementById("text-size-slider");
    const textSizeBadge = document.getElementById("text-size-badge");
    const textDisplay = document.getElementById("text-display");

    // Keyboard Matrix Layout Assets
    const virtualKeyboard = document.getElementById("virtual-keyboard-board");
    const keyboardVisibilityToggle = document.getElementById("keyboard-visibility-toggle");
    const keyboardGlowToggle = document.getElementById("keyboard-glow-toggle");
    const rippleAnimationsToggle = document.getElementById("ripple-animations-toggle");

    // Accessibility Framework Switches
    const highContrastToggle = document.getElementById("high-contrast-toggle");
    const boldTextToggle = document.getElementById("bold-text-toggle");
    const reducedMotionToggle = document.getElementById("reduced-motion-toggle");

    // Local configuration tracking variables
    let activeMode = "normal";
    let activeDifficulty = "easy";

    // Setup Baseline Execution States
    rootContainer.classList.add("keyboard-glow-active");

    // 2. WORKSPACE MODE SELECTOR MECHANICS
    modeButtons.forEach(button => {
        button.addEventListener("click", function() {
            modeButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeMode = this.getAttribute("data-mode");
            console.log(`Typing workspace mode mutated to: ${activeMode}`);
        });
    });

    // 3. ENGINE DIFFICULTY SELECTOR MECHANICS
    diffButtons.forEach(button => {
        button.addEventListener("click", function() {
            diffButtons.forEach(btn => btn.classList.remove("active"));
            this.classList.add("active");
            activeDifficulty = this.getAttribute("data-value");
            console.log(`Typing stream structural density altered to: ${activeDifficulty}`);
        });
    });

    // 4. SNAPPY TEXT SIZE RANGE SLIDER LOGIC
    textSizeSlider.addEventListener("input", function() {
        const targetSize = this.value;
        textSizeBadge.textContent = `${targetSize}px`;
        textDisplay.style.fontSize = `${targetSize}px`;
    });

    // 5. KEYBOARD VISIBILITY SETTING MANAGEMENT
    keyboardVisibilityToggle.addEventListener("change", function() {
        if (this.checked) {
            virtualKeyboard.classList.remove("keyboard-hidden");
            console.log("Keyboard Dashboard: Grid canvas set to visible.");
        } else {
            virtualKeyboard.classList.add("keyboard-hidden");
            console.log("Keyboard Dashboard: Grid canvas hidden.");
        }
    });

    // 6. KEYBOARD GLOW COMPONENT FX MANAGEMENT
    keyboardGlowToggle.addEventListener("change", function() {
        if (this.checked) {
            rootContainer.classList.add("keyboard-glow-active");
        } else {
            rootContainer.classList.remove("keyboard-glow-active");
        }
    });

    // 7. HARDWARE KEYBOARD LISTENERS FOR ACTIVE INPUT TRACING
    window.addEventListener("keydown", function(event) {
        let targetId = event.code;

        // Normalize Space-bar structural fallback targets
        if (event.key === " " || targetId === "Space") {
            targetId = "Space";
        }

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            // Prevent duplicated ripple generation spans from standard keyboard OS auto-repeat locks
            if (!visualKey.classList.contains("hardware-pressed-active")) {
                visualKey.classList.add("hardware-pressed-active");

                // Fire dynamic layout ripples if active parameters are checked and motion isn't restricted
                if (rippleAnimationsToggle && rippleAnimationsToggle.checked && !rootContainer.classList.contains("reduced-motion-active")) {
                    triggerKeyCanvasWaveRipple(visualKey);
                }
            }
        }
    });

    window.addEventListener("keyup", function(event) {
        let targetId = event.code;
        if (event.key === " " || targetId === "Space") {
            targetId = "Space";
        }

        const visualKey = document.getElementById(targetId);
        if (visualKey) {
            visualKey.classList.remove("hardware-pressed-active");
        }
    });

    // 8. DYNAMIC ABSOLUTE OVERLAY WAVE RIPPLE GENERATION ENGINE
    function triggerKeyCanvasWaveRipple(keyElement) {
        const circleNode = document.createElement("span");
        const baseDiameter = Math.max(keyElement.clientWidth, keyElement.clientHeight);

        circleNode.style.width = circleNode.style.height = `${baseDiameter}px`;
        circleNode.style.left = `${keyElement.clientWidth / 2 - baseDiameter / 2}px`;
        circleNode.style.top = `${keyElement.clientHeight / 2 - baseDiameter / 2}px`;
        circleNode.classList.add("ripple-wave-element");

        // Flush pre-existing un-terminated elements inside this node cleanly
        const deadRipple = keyElement.querySelector(".ripple-wave-element");
        if (deadRipple) {
            deadRipple.remove();
        }

        keyElement.appendChild(circleNode);

        // Safe cleanup hook after animation termination sequence
        circleNode.addEventListener("animationend", function() {
            circleNode.remove();
        });
    }

    // 9. ACCESSIBILITY TOGGLE LISTENERS
    highContrastToggle.addEventListener("change", function() {
        if (this.checked) {
            rootContainer.classList.add("high-contrast-active");
        } else {
            rootContainer.classList.remove("high-contrast-active");
        }
    });

    boldTextToggle.addEventListener("change", function() {
        if (this.checked) {
            rootContainer.classList.add("bold-text-active");
        } else {
            rootContainer.classList.remove("bold-text-active");
        }
    });

    reducedMotionToggle.addEventListener("change", function() {
        if (this.checked) {
            rootContainer.classList.add("reduced-motion-active");
            console.log("Accessibility System: Interface animations and ripples suspended.");
        } else {
            rootContainer.classList.remove("reduced-motion-active");
            console.log("Accessibility System: Animations reinstated.");
        }
    });
});