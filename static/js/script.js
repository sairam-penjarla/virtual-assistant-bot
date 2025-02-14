let shouldStopStream = false; // Flag to control streaming
let currentSessionId = "session_id";

/////////////////////////////////////////////////////////
//                  Page Load Actions                  //
/////////////////////////////////////////////////////////

window.onload = function () {
    document.getElementById("chat-container").innerHTML = "";
    loadSessionData(currentSessionId);
    loadingAnimation();
};

/////////////////////////////////////////////////////////
//                  Theme Toggle Logic                 //
/////////////////////////////////////////////////////////

const toggleThemeButton = document.getElementById("theme-toggle");
const currentTheme = localStorage.getItem("theme") || "light-mode";

document.documentElement.classList.add(currentTheme);
toggleThemeButton.textContent = currentTheme === "dark-mode" ? "Switch to Light Mode" : "Switch to Dark Mode";

toggleThemeButton.addEventListener("click", () => {
    const html = document.documentElement;
    const isDarkMode = html.classList.contains("dark-mode");

    html.classList.replace(isDarkMode ? "dark-mode" : "light-mode", isDarkMode ? "light-mode" : "dark-mode");
    toggleThemeButton.textContent = isDarkMode ? "Switch to Dark Mode" : "Switch to Light Mode";
    localStorage.setItem("theme", isDarkMode ? "light-mode" : "dark-mode");
    html.style.backgroundColor = isDarkMode ? "#ffffff" : "#252525";
});

/////////////////////////////////////////////////////////
//                  Utility Functions                  //
/////////////////////////////////////////////////////////

const generateSessionId = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => ((Math.random() * 16) | (0 & (c === "x" ? 15 : 3 | 8))).toString(16));

const scrollToBottom = () => {
    const chatContainer = document.getElementById("chat-container");
    chatContainer.scrollTop = chatContainer.scrollHeight;
};

const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
};

const loadingAnimation = () => {
    const chatContainer = document.getElementById("chat-container");
    const loadingMessageContainer = document.createElement("div");
    loadingMessageContainer.classList.add("bot-loading-message-container");
    loadingMessageContainer.id = "slide-loading-animation";
    chatContainer.appendChild(loadingMessageContainer);
};
const hideLoadingAnimation = () => {
    const loadingMessageContainer = document.getElementById("slide-loading-animation");
    if (loadingMessageContainer) {
        loadingMessageContainer.remove(); // Remove the loading message container from the DOM
    }
};

const resetSendButton = () => {
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const sendIcon = document.getElementById("sendIcon");

    userInput.setAttribute("contenteditable", "true");
    sendButton.disabled = false;
    sendIcon.src = "static/images/arrow-left.svg";
    sendIcon.onclick = null;

    hideLoadingAnimation();
};

const cleanInput = () => {
    document.getElementById("userInput").innerHTML = document.getElementById("userInput").innerHTML.replace(/<span[^>]*>(.*?)<\/span>/g, "$1");
};

/////////////////////////////////////////////////////////
//                  Sidebar Functions                  //
/////////////////////////////////////////////////////////
const loadSessionData = async (sessionId) => {
    try {
        const response = await fetch("/get_session_data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId }),
        });

        const { session_data } = await response.json();
        if (session_data) renderSession(session_data, sessionId);
        else console.log("No conversations found for this session.");
    } catch (error) {
        console.error("Error loading previous conversations:", error);
    }
};
function toggleContainer() {
    var container = document.getElementById('toggleContainer');
    if (container.style.display === 'none' || container.style.display === '') {
          container.style.display = 'flex';
    } else {
          container.style.display = 'none';
    }
}
const eraseConversations = async () => {
    try {
        const response = await fetch("/clear_session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: currentSessionId }),
        });

        if (response.ok) {
            console.log("Session cleared successfully.");
            document.getElementById("chat-container").innerHTML = "";
        } else {
            console.error("Error clearing session:", response.statusText);
        }
    } catch (error) {
        console.error("Error clearing session:", error);
    }
};

const renderSession = (sessionData, sessionId) => {
    currentSessionId = sessionId;
    const chatContainer = document.getElementById("chat-container");
    chatContainer.innerHTML = "";

    sessionData.forEach(({ prompt, llm_output, meta_data }) => {
        appendUserMessage(prompt);
        appendChatbotMessage(llm_output);
        processAndRenderReferences(meta_data, true);
    });
};

/////////////////////////////////////////////////////////
//                  Chat Message Functions             //
/////////////////////////////////////////////////////////

const appendUserMessage = (content) => {
    const chatContainer = document.getElementById("chat-container");

    const messageContainer = document.createElement("div");
    messageContainer.classList.add("user-message-container");

    messageContainer.innerHTML = `
        <div class="user-message message">
            <div class="text-content-container">${content}</div>
        </div>
    `;

    const allUserMessages = document.createElement("div");
    allUserMessages.classList.add("all-user-messages");
    allUserMessages.appendChild(messageContainer);

    chatContainer.appendChild(allUserMessages);
    scrollToBottom();
};

const appendChatbotMessage = (content) => {
    const chatContainer = document.getElementById("chat-container");

    const messageContainer = document.createElement("div");
    messageContainer.classList.add("chatbot-message-container");

    messageContainer.innerHTML = `
        <div class="chatbot-message message">
            <div class="text-content-container">${content ? marked.parse(content) : ""}</div>
        </div>
    `;

    chatContainer.appendChild(messageContainer);
    scrollToBottom();
};

async function generateChatbotAnswer() {
    const userInput = document.getElementById("userInput");
    const sendButton = document.getElementById("sendButton");
    const sendIcon = document.getElementById("sendIcon");
    const message = userInput.innerText.trim();

    if (message === "") return;

    userInput.setAttribute("contenteditable", "false");
    sendButton.disabled = true;

    // Append the user message block
    appendUserMessage(message);
    userInput.innerText = "";

    loadingAnimation();
    scrollToBottom();

    let sessionIcon; // Define sessionIcon outside the block

    try {
        if (!currentSessionId) {
            currentSessionId = generateSessionId(); // Generate a new session ID

            // Fetch the session icon using the /get_random_session_icon route
            const iconResponse = await fetch("/get_random_session_icon", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ session_id: currentSessionId }),
            });

            if (!iconResponse.ok) {
                console.error("Error fetching session icon:", iconResponse.statusText);
                throw new Error("Failed to fetch session icon");
            }
            const iconData = await iconResponse.json();
            sessionIcon = iconData.session_icon; // Assuming the icon is returned as 'relavant_schema'

            // Update the sidebar with the new session and icon
            updateSidebarWithSession(currentSessionId, message, sessionIcon);
        }

        // Step 1: Retrieve relevant content
        // Step 1: Retrieve relevant content
        const relevantContentResponse = await fetch("/get_relevant_content", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user_input: message,
            }),
        });

        if (!relevantContentResponse.ok) {
            console.error("Error retrieving relevant content:", relevantContentResponse.statusText);
            appendChatbotMessage("Error: Could not retrieve relevant content.");
            return;
        }

        let relevantContentData;
        try {
            relevantContentData = await relevantContentResponse.json(); // Parse the JSON response
        } catch (error) {
            console.error("Error parsing relevant content data:", error);
            appendChatbotMessage("Error: Could not parse relevant content.");
            return;
        }
        if (typeof relevantContentData.relevant_content === "string") {
            try {
                relevantContentData = JSON.parse(relevantContentData.relevant_content); // In case the data is a string, parse it to JSON
            } catch (error) {
                console.error("Error parsing relevant content string:", error);
                appendChatbotMessage("Error: Could not parse relevant content string.");
                return;
            }
        }

        let relevantContent = relevantContentData.map((content) => {
            // Ensure relevant_content follows the new structure for JSON serialization
            return {
                document: content.document,
                metadata: content.metadata,
                similarity_score: content.similarity_score, // Ensure float is serializable
                cross_encoder_score: content.cross_encoder_score, // Ensure float is serializable
            };
        });

        if (!relevantContent || relevantContent.length === 0) {
            // console.error("No relevant content returned.");
            // appendChatbotMessage("Error: No relevant content found.");
            // return;
            relevantContent = "No relevant content found.";
        }

        // Step 2: Invoke the agent for response
        const responseAgent = await fetch("/invoke_agent", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                user_input: message,
                relevant_content: relevantContent,
            }),
        });

        // Stream the response
        appendChatbotMessage(""); // Add an empty chatbot message container for streaming
        const reader = responseAgent.body.getReader();
        const decoder = new TextDecoder("utf-8");
        const messageContainers = document.querySelectorAll(".chatbot-message-container");
        const messageContainer = messageContainers[messageContainers.length - 1];
        let resultText = messageContainer.querySelector(".text-content-container");

        let done = false;
        let llmOutput = "";
        const userInput = document.getElementById("userInput");
        userInput.setAttribute("contenteditable", "true");
        userInput.focus();

        while (!done) {
            const { value, done: readerDone } = await reader.read();
            done = readerDone;

            if (value) {
                llmOutput += decoder.decode(value);
                resultText.innerHTML = marked.parse(llmOutput);
            }
            // Scroll to the bottom
            scrollToBottom();
        }

        // Step 3: Render reference URLs and metadata
        const seenUrls = new Set(); // To keep track of already seen URLs
        const uniqueReferences = [];

        let uniqueReferencesString = JSON.stringify(uniqueReferences);
        
        if (relevantContent === "No relevant content found.") {
            console.log("No relevant content found.");
        } else {
            relevantContent.forEach((content) => {
                const metadata = content.metadata;
                const url = metadata.url;

                // Check if the URL is already seen
                if (!seenUrls.has(url)) {
                    seenUrls.add(url); // Mark this URL as seen
                    uniqueReferences.push(content); // Add content to the unique references array
                }
            });

            // Convert the de-duplicated object to a string
            uniqueReferencesString = JSON.stringify(uniqueReferences);
            processAndRenderReferences(uniqueReferencesString, true);
            scrollToBottom();
        }

        // Step 4: Update conversation in the session
        const responseUpdateSession = await fetch("/update_session", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session_id: currentSessionId,
                prompt: message,
                llm_output: llmOutput,
                meta_data: uniqueReferencesString,
                session_icon: sessionIcon,
            }),
        });

        if (!responseUpdateSession.ok) {
            console.error("Error updating session:", responseUpdateSession.statusText);
            appendChatbotMessage("Error: " + responseUpdateSession.statusText);
        }
    } catch (error) {
        console.error("Error during fetch or streaming:", error.message);
        appendChatbotMessage("Error: " + error.message);
    } finally {
        // Reset the input, Loading animation and send button
        resetSendButton();
    }
}

// Attach event listener for Enter key
function handleKeyPress(event) {
    const sendButton = document.getElementById("sendButton");
    if (event.key === "Enter" && !sendButton.disabled) {
        event.preventDefault();
        generateChatbotAnswer();
    }
}

// Function to render reference link
function renderReference(filename, url) {
    // Create the reference container div for each reference
    const referenceContainer = document.createElement("div");
    referenceContainer.classList.add("reference-container");

    // Create the anchor tag that will wrap the entire reference container
    const linkWrapper = document.createElement("a");
    linkWrapper.href = url;
    linkWrapper.target = "_blank";
    linkWrapper.classList.add("reference-link-wrapper");

    // Create and append the filename element with a class
    const referenceId = document.createElement("div");
    referenceId.classList.add("reference-filename");
    referenceId.textContent = filename.replace(/_/g, " ").replace(/\.txt$/, "");
    referenceContainer.appendChild(referenceId);

    // Create and append the reference image element with a class
    const referenceImg = document.createElement("div");
    referenceImg.classList.add("reference-img");
    const img = document.createElement("img");
    img.src = "static/images/reference-link.svg";
    referenceImg.appendChild(img);
    referenceContainer.appendChild(referenceImg);

    // Append the reference container inside the link wrapper
    linkWrapper.appendChild(referenceContainer);

    // Return the link wrapper (which is clickable)
    return linkWrapper;
}

// Function to process and render the unique references
function processAndRenderReferences(inputData, isString = false) {

    // Initialize the set to keep track of seen URLs
    const seenUrls = new Set();
    const uniqueReferences = [];
    const referenceWrapper = document.createElement("div");
    referenceWrapper.classList.add("reference-wrapper"); // To wrap all reference containers

    // If input is a string, parse it to JSON
    let referencesData = inputData;
    if (isString) {
        try {
            referencesData = JSON.parse(inputData); // Convert the string to JSON
        } catch (error) {
            console.error("Error parsing JSON:", error);
            return;
        }
    }

    // Process references, either from parsed JSON or the input array
    referencesData.forEach((content) => {
        const metadata = content.metadata;
        const url = metadata.url;

        // Check if the URL is already seen (to avoid duplicates)
        if (!seenUrls.has(url)) {
            seenUrls.add(url); // Mark this URL as seen
            uniqueReferences.push(content); // Add content to the unique references array

            // Call the renderReference function to get the reference div
            const referenceDiv = renderReference(metadata.filename, metadata.url);

            // Append the reference div to the referenceWrapper
            referenceWrapper.appendChild(referenceDiv);
        } else {
        }
    });

    // After processing all references, append the referenceWrapper to the last chatbot message container
    const messageContainers = document.querySelectorAll(".chatbot-message-container");
    const lastMessageContainer = messageContainers[messageContainers.length - 1];

    if (lastMessageContainer) {
        lastMessageContainer.appendChild(referenceWrapper); // Append all references under one wrapper
    }

}
