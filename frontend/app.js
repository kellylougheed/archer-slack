// Put in real backend URL once deployed on Render
const API = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev/api";

let channel = "cs1"; // other channels: adv, art

function loadName() {
    if (localStorage.getItem("username")) {
        document.getElementById("name").value = localStorage.getItem("username");
    }
}

async function loadMessages() {
    const res = await fetch(`${API}/messages?channel=${channel}`);
    const messages = await res.json();
    console.log("Fetched messages:", messages);

    const messagesDiv = document.getElementById("messages");

    // clear existing messages
    while (messagesDiv.firstChild) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }

    messagesDiv.appendChild(generateHTML(messages));
}

function generateHTML(messages) {
    const container = document.createElement("div");

    for (m of messages) {
        console.log("CHAR CODES:", m.message.split("").map(c => c.charCodeAt(0)));

        const wrapper = document.createElement("div");
        wrapper.classList.add("message");

        const username = document.createElement("div");
        username.classList.add("username");
        username.textContent = m.username;

        wrapper.appendChild(username);

        if (!m.is_code) {
            // normal message lives in a div
            const messageText = document.createElement("div");
            messageText.textContent = m.message;
            wrapper.appendChild(messageText);
        } else {
            // wrap code in pre, code
            const pre = document.createElement("pre");
            const code = document.createElement("code");

            code.textContent = m.message;
            pre.appendChild(code);
            wrapper.appendChild(pre);
        }

        container.appendChild(wrapper);
    }

    const testPre = document.createElement("pre");
    const testCode = document.createElement("code");
    testCode.textContent = "line1\nline2\n    line3";
    testPre.appendChild(testCode);
    document.getElementById("messages").appendChild(testPre);

    return container;
}

function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    
}

async function sendMessage() {
    const username = localStorage.getItem("username") || document.getElementById("name").value;
    const message = document.getElementById("input").value;
    localStorage.setItem("username", username);

    const isCode = document.getElementById("isCode").checked;

    await fetch(`${API}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        channel,
        username,
        message,
        isCode
        })
    });

    loadMessages();
}

async function clearMessages() {
    await fetch(`${API}/messages/clear`, { method: "DELETE" });
}

loadName();
loadMessages();
setInterval(loadMessages, 3000);