document.addEventListener("DOMContentLoaded", function() {
    // --- Interface Theme State Management Engine ---
    const themeSelector = document.getElementById("appUiThemeSelectorDropdown");
    if (themeSelector) {
        const activeThemeState = localStorage.getItem("app-ui-theme") || "light";
        themeSelector.value = activeThemeState;

        themeSelector.addEventListener("change", function() {
            const selectedTheme = themeSelector.value;
            if (selectedTheme === "dark") {
                document.documentElement.setAttribute("data-game-theme", "dark");
                localStorage.setItem("app-ui-theme", "dark");
            } else if (selectedTheme === "sepia") {
                document.documentElement.setAttribute("data-game-theme", "sepia");
                localStorage.setItem("app-ui-theme", "sepia");
            } else if (selectedTheme === "cyber-shock") {
                document.documentElement.setAttribute("data-game-theme", "cyber-shock");
                localStorage.setItem("app-ui-theme", "cyber-shock");
            } else if (selectedTheme === "deep-nebula") {
                document.documentElement.setAttribute("data-game-theme", "deep-nebula");
                localStorage.setItem("app-ui-theme", "deep-nebula");
            } else if (selectedTheme === "monochrome-mint") {
                document.documentElement.setAttribute("data-game-theme", "monochrome-mint");
                localStorage.setItem("app-ui-theme", "monochrome-mint");
            } else if (selectedTheme === "warm-amber") {
                document.documentElement.setAttribute("data-game-theme", "warm-amber");
                localStorage.setItem("app-ui-theme", "warm-amber");
            } else if (selectedTheme === "frost-obsidian") {
                document.documentElement.setAttribute("data-game-theme", "frost-obsidian");
                localStorage.setItem("app-ui-theme", "frost-obsidian");
            } else {
                document.documentElement.removeAttribute("data-game-theme");
                localStorage.setItem("app-ui-theme", "light");
            }
        });
    }
});

function triggerAdminAuthSequence(event) {
    event.preventDefault();
    const tokenInput = prompt("Access Restricted: Elevated Permissions Required.\nPlease enter the master administrative clearance credential password code:");
    if (tokenInput !== null && tokenInput.trim() === "Admin112233") {
        window.location.href = "{{ url_for('dashboard', tab='admin') }}&admin_password=" + encodeURIComponent(tokenInput.trim());
    } else if (tokenInput !== null) {
        alert("Authentication failed: Supplied clearance string signature is invalid.");
    }
}

// --- Administrative Overlay Modal Mutation Control Channels ---
function triggerModificationModal(id, username, currentApiKey) {
    document.getElementById('modalTargetNodeField').value = id;
    document.getElementById('modalUsernameField').value = username;

    const apiField = document.getElementById('modalApiKeyField');
    apiField.value = currentApiKey;
    apiField.disabled = false;
    document.getElementById('modalRemoveKeyCheckbox').checked = false;

    document.getElementById('adminModificationTargetModal').style.display = 'flex';
}

function dismissModificationModal() {
    document.getElementById('adminModificationTargetModal').style.display = 'none';
}

function toggleApiKeyRemovalSequence(checkboxElement) {
    const apiField = document.getElementById('modalApiKeyField');
    if (checkboxElement.checked) {
        apiField.dataset.originalValue = apiField.value;
        apiField.value = "__REMOVE__";
        apiField.disabled = true;
    } else {
        apiField.value = apiField.dataset.originalValue || "";
        apiField.disabled = false;
    }
}