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
    document.getElementById("messages").innerHTML = generateHTML(messages);

}

function generateHTML(messages) {
    let html = ""
    for (m of messages) {
        if (!m.isCode) {
            html += `<p><strong>${m.username}:</strong> ${m.message}</p>`;
        } else {
            html += `<p><strong>${m.username}:</strong></p>  <pre><code>${m.message}</code></pre>`
        }
    }
    return html;
}

async function sendMessage() {
    const username = localStorage.getItem("username") || document.getElementById("name").value;
    const message = document.getElementById("input").value;
    localStorage.setItem("username", username);

    const isCode = document.getElementById("isCode").checked

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

loadName();
loadMessages();
setInterval(loadMessages, 3000);