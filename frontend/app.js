// Development API endpoint
// const API = "/api";

// Production API endpoint - use relative path since served from same domain
const API = "/api";

let storedUsername = "";

let userChannel = localStorage.getItem("channel") || "cs1";
let channelNames = ["cs1", "adv", "art"];

// control whether or not you can see delete functionality
let adminMode = false;

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

function turnOnAdminMode() {
    adminMode = true;
    document.getElementById("deleteButtons").style.visibility = "visible"; 
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
            let msgId = m.id;
            deleteBtn.onclick = () => deleteMessage(msgId);
            wrapper.appendChild(deleteBtn);
        }

        messageAndDeleteContainer.appendChild(messageText);

        if (storedUsername == m.username || adminMode) {
            messageAndDeleteContainer.appendChild(deleteBtn);
        }
        
        wrapper.appendChild(messageAndDeleteContainer);
        container.appendChild(wrapper);
    }

    return container;
}

async function sendMessage() {
    if (!window.user) {
        alert("You must be logged in to send messages.");
        return;
    }

    const channel = localStorage.getItem("channel");
    let username = storedUsername;
    if (username === "Kelly Lougheed") {
        username = "Ms. Lougheed";
    }
    const message = document.getElementById("input").value;
    const isCode = document.getElementById("isCode").checked;

    await fetch(`${API}/messages`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        channel,
        username,
        message,
        isCode
        })
    });

    document.getElementById("input").value = "";
    document.getElementById("isCode").checked = false;

    loadMessages();
    scrollToBottom();
}

async function clearMessages() {
    await fetch(`${API}/messages/clear`, { method: "DELETE", credentials: "include" });
    loadMessages(); // reload
}

async function clearChannelMessages(channel) {
    await fetch(`${API}/messages/channel/${channel}`, { method: "DELETE", credentials: "include" });
    loadMessages(); // reload
}

async function deleteMessage(messageId) {
    await fetch(`${API}/messages/${messageId}`, { method: "DELETE", credentials: "include" });
    loadMessages(); // reload
}

async function logout() {
  await fetch(`${API}/logout`, {
    method: "POST",
    credentials: "include"
  });
  window.user = null;
  checkLogin(); // refresh status
}

async function checkLogin() {

  const loginStatus = document.getElementById("loginStatus");
  const signInBtn = document.getElementById("signInBtn");
  const signOutBtn = document.getElementById("signOutBtn");

  // Default
  loginStatus.textContent = "Not logged in. You cannot post.";
  signInBtn.style.display = "inline";
  signOutBtn.style.display = "none";
  window.user = null;

  try {
    const res = await fetch(`${API}/me`, {
      credentials: "include"
    });
    const user = await res.json();

    // Store username
    storedUsername = user ? user.name : "";
    window.user = user;

    if (storedUsername == "Kelly Lougheed") {
        turnOnAdminMode();
    }

    if (user) {
      loginStatus.textContent = "Logged in as " + user.name;
      signInBtn.style.display = "none";
      signOutBtn.style.display = "inline";
    }
  } catch (e) {
    console.error("checkLogin failed:", e);
  }
}

function scrollToBottom() {
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth"
    });
}

checkLogin();

changeChannel(userChannel);
loadMessages(userChannel);

// only scroll to bottom the first time
scrollToBottom();

setInterval(loadMessages, 3000);