// Put in real backend URL once deployed on Render
const API = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev/api";

let userChannel = localStorage.getItem("channel") || "cs1";
let channelNames = ["cs1", "adv", "art"];

function loadName() {
    if (localStorage.getItem("username")) {
        document.getElementById("name").value = localStorage.getItem("username");
    }
}

function changeChannel(channel) {
    // save selected channel
    userChannel = channel;
    localStorage.setItem("channel", channel);

    // change selected channel styles, remove styles from previous selected channel
    for (let i = 0; i < channelNames.length; i++) {
        const chName = channelNames[i];
        const chDiv = document.getElementById(chName);
        if (chName === channel) {
            chDiv.classList.add("selected");
        } else {
            chDiv.classList.remove("selected");
        }
    }

    // refresh
    loadMessages(channel);
}

async function loadMessages(channel=userChannel) {
    const res = await fetch(`${API}/messages?channel=${channel}`);
    const messages = await res.json();
    console.log("Fetched messages:", messages);

    const messagesDiv = document.getElementById("messages");

    // clear existing messages
    while (messagesDiv.firstChild) {
        messagesDiv.removeChild(messagesDiv.firstChild);
    }

    messagesDiv.appendChild(generateHTML(messages));

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });
}

function generateHTML(messages) {
    const container = document.createElement("div");

    for (m of messages) {

        const wrapper = document.createElement("div");
        wrapper.classList.add("message");

        const username = document.createElement("div");
        username.classList.add("username");
        username.textContent = m.username;

        wrapper.appendChild(username);

        const messageText = document.createElement("div");
        messageText.classList.add("messageBody");

        if (!m.is_code) {
            // normal message lives in the div
            messageText.textContent = m.message;
            wrapper.appendChild(messageText);
        } else {
            messageText.classList.add("codeBody");
            // wrap code in pre, code
            const pre = document.createElement("pre");
            const code = document.createElement("code");

            code.textContent = m.message;
            pre.appendChild(code);
            pre.classList.add("messageBody");
            messageText.appendChild(pre);
            wrapper.appendChild(messageText);
        }

        container.appendChild(wrapper);
    }

    return container;
}

async function sendMessage() {
    const username = localStorage.getItem("username") || document.getElementById("name").value;
    localStorage.setItem("username", username);

    const message = document.getElementById("input").value;
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
changeChannel(userChannel);
loadMessages(userChannel);

setInterval(loadMessages, 3000);