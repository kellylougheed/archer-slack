// Put in real backend URL once deployed on Render
const API = "https://studious-space-dollop-jjp6rp7w9q5hqp66-3000.app.github.dev/api";

let storedUsername = localStorage.getItem("username") || "";
let userChannel = localStorage.getItem("channel") || "cs1";
let channelNames = ["cs1", "adv", "art"];

let keystrokes = [];

// control whether or not you can see delete functionality
let adminMode = false;

function loadName() {
    if (localStorage.getItem("username")) {
        document.getElementById("name").value = localStorage.getItem("username");
        storedUsername = localStorage.getItem("username");
    }
}

document.getElementById("name").addEventListener("change", e => {
    localStorage.setItem("username", e.target.value);
    storedUsername = e.target.value;
});

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

    if (messages.length === 0) {
        const noMsg = document.createElement("div");
        noMsg.classList.add("noMessages");
        noMsg.textContent = "No messages yet.";
        container.appendChild(noMsg);
        return container;
    }

    for (m of messages) {

        const wrapper = document.createElement("div");
        wrapper.classList.add("message");

        const usernameTimestampContainer = document.createElement("div");
        usernameTimestampContainer.classList.add("usernameTimestampContainer");

        const username = document.createElement("span");
        username.classList.add("username");
        username.textContent = m.username;
        
        // timestamp (format: "Mon, Dec 8 @ 12:25 PM")
        const ts = document.createElement("span");
        if (m.timestamp) {
            ts.classList.add("timestamp");
            try {
                const d = new Date(m.timestamp);
                const dayShort = d.toLocaleDateString(undefined, { weekday: 'short' });
                const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const mon = monthNames[d.getMonth()];
                const day = d.getDate();
                let hours = d.getHours();
                const minutes = d.getMinutes().toString().padStart(2, '0');
                const ampm = hours >= 12 ? 'PM' : 'AM';
                hours = hours % 12 || 12;
                if (d.toDateString() !== new Date().toDateString()) {
                    // day is NOT today
                    ts.textContent = `${dayShort}, ${mon} ${day} @ ${hours}:${minutes} ${ampm}`;
                } else {
                    // day IS today
                    ts.textContent = `Today @ ${hours}:${minutes} ${ampm}`;
                }
            } catch (e) {
                ts.textContent = m.timestamp;
            }
        }

        usernameTimestampContainer.appendChild(username);
        usernameTimestampContainer.appendChild(ts);

        wrapper.appendChild(usernameTimestampContainer);

        const messageAndDeleteContainer = document.createElement("div");
        messageAndDeleteContainer.classList.add("messageAndDeleteContainer");

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

        // delete button
        let deleteBtn;
        if (storedUsername == m.username || adminMode) {
            deleteBtn = document.createElement("button");
            deleteBtn.classList.add("deleteButton");
            deleteBtn.textContent = "X";
            deleteBtn.onclick = () => deleteMessage(m.id);
            wrapper.appendChild(deleteBtn);
        }

        messageAndDeleteContainer.appendChild(messageText);

        console.log(storedUsername, m.username, adminMode);

        if (storedUsername == m.username || adminMode) {
            messageAndDeleteContainer.appendChild(deleteBtn);
        }
        
        wrapper.appendChild(messageAndDeleteContainer);
        container.appendChild(wrapper);
    }

    return container;
}

async function sendMessage() {
    const channel = localStorage.getItem("channel");
    const username = localStorage.getItem("username") || document.getElementById("name").value;
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

    document.getElementById("input").value = "";

    loadMessages();
}

function toggleAdminMode() {
    if (adminMode) {
        adminMode = false;
        document.getElementById("deleteButtons").style.visibility = "hidden";
    } else {
        adminMode = true;
        document.getElementById("deleteButtons").style.visibility = "visible"; 
    }
    loadMessages();
}

async function clearMessages() {
    await fetch(`${API}/messages/clear`, { method: "DELETE" });
    loadMessages(); // reload
}

async function clearChannelMessages(channel) {
    await fetch(`${API}/messages/channel/${channel}`, { method: "DELETE" });
    loadMessages(); // reload
}

async function deleteMessage(messageId) {
    await fetch(`${API}/messages/${messageId}`, { method: "DELETE" });
    loadMessages(); // reload
}

document.addEventListener("keydown", e => {
    keystrokes.push(e.key);
    let text = keystrokes.join("");
    if (text.endsWith("adminmode")) {
        toggleAdminMode();
        keystrokes = [];
    }
});

loadName();
changeChannel(userChannel);
loadMessages(userChannel);

setInterval(loadMessages, 3000);