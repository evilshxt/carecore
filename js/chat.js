// chat.js - CareCoreAI Health Assistant Chat Interface
document.addEventListener('DOMContentLoaded', async () => {
    if (!window.location.pathname.includes('chat.html')) return;

    try {
        // 1. Initialize UI
        initUI();
        
        // 2. Initialize Firebase
        await initFirebase();
        
        // 3. Add welcome message with user's name if available
        addWelcomeMessage();
        
        // 4. Setup event listeners for chat
        setupEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
        addMessageToUI("Failed to initialize chat. Please refresh the page.", false);
    }
});

async function initFirebase() {
    try {
        // Check if Firebase is already initialized
        if (!firebase.apps.length) {
            firebase.initializeApp({
                apiKey: firebaseConfig.apiKey,
                authDomain: firebaseConfig.authDomain,
                projectId: firebaseConfig.projectId,
                storageBucket: firebaseConfig.storageBucket,
                messagingSenderId: firebaseConfig.messagingSenderId,
                appId: firebaseConfig.appId
            });
        }
        console.log("✅ Firebase initialized successfully");
        return true;
    } catch (error) {
        console.error("Firebase initialization failed:", error);
        return false;
    }
}

async function getCurrentUser() {
    return new Promise((resolve) => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            unsubscribe();
            resolve(user);
        });
    });
}

async function getUserID() {
    // First try to get from Firebase auth
    const user = await getCurrentUser();
    if (user) {
        return user.uid;
    }
    
    // Fallback to local storage or generate new ID
    const storedID = localStorage.getItem('voiceflowUserID');
    if (storedID) {
        return storedID;
    }
    
    // Generate new ID
    const newID = `user_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('voiceflowUserID', newID);
    return newID;
}

function getUserName() {
    const user = firebase.auth().currentUser;
    if (user && user.displayName) {
        return user.displayName.split(' ')[0]; // Return first name
    }
    return null;
}

function addWelcomeMessage() {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer.children.length <= 1) {
        const username = getUserName();
        let welcomeMessage = "Hello! I'm your CareCoreAI Health Assistant. How can I help you today?";
        
        if (username) {
            welcomeMessage = `Hello ${username}! I'm your CareCoreAI Health Assistant. How can I help you today?`;
        }
        
        addMessageToUI(welcomeMessage, false);
    }
}

function setupEventListeners() {
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    
    // Send message on button click
    sendButton.addEventListener('click', sendMessage);
    
    // Send message on Enter key (but allow Shift+Enter for new lines)
    userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

async function sendMessage() {
    const userInput = document.getElementById('userInput');
    const message = userInput.value.trim();
    if (!message) return;

    // Get user ID for Voiceflow
    const userID = await getUserID();
    
    // Add user message to UI
    addMessageToUI(message, true);
    userInput.value = '';
    showTypingIndicator();

    try {
        // Voiceflow API constants 
        const versionID = 'production'; // Or your specific version ID
        const projectID = 'VF.DM.6827c961f58c2c56b8161a1e.6PFz128CiHtP2xhW'; // Your Voiceflow project ID

        // Make API request to Voiceflow
        const response = await fetch(`https://general-runtime.voiceflow.com/state/${versionID}/user/${userID}/interact`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': projectID
            },
            body: JSON.stringify({
                action: {
                    type: 'text',
                    payload: message
                },
                config: {
                    tts: false,
                    stripSSML: true,
                    stopAll: true
                }
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();
        handleVoiceflowResponse(data);
    } catch (error) {
        handleVoiceflowError(error);
    }
}

function handleVoiceflowResponse(response) {
    hideTypingIndicator();

    if (Array.isArray(response)) {
        let hasProcessedMessage = false;
        
        response.forEach(trace => {
            if ((trace.type === 'speak' || trace.type === 'text') && trace.payload?.message) {
                addMessageToUI(trace.payload.message, false);
                hasProcessedMessage = true;
            }
        });
        
        if (!hasProcessedMessage) {
            addMessageToUI("I didn't get a clear response. Try asking me something else?", false);
        }
    } else {
        addMessageToUI("I didn't get a proper response. Try again?", false);
    }
}

function handleVoiceflowError(error) {
    console.error('Voiceflow error:', error);
    hideTypingIndicator();
    let errorMessage = "Sorry, I'm having trouble connecting right now. Please try again later.";
    
    if (error.message.includes('Failed to fetch')) {
        errorMessage = "Network error. Please check your internet connection.";
    } else if (error.message.includes('401')) {
        errorMessage = "Authentication failed. Please contact support.";
    }
    
    addMessageToUI(errorMessage, false);
}

// UI Helper Functions
function addMessageToUI(content, isUser) {
    const chatContainer = document.getElementById('chatContainer');
    const messageDiv = document.createElement('div');
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    messageDiv.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;
    messageDiv.innerHTML = `
        <div class="message-content ${isUser ? 'bg-accent text-primary' : 'bg-accent bg-opacity-10'} p-4 rounded-lg border-l-4 ${isUser ? 'border-transparent' : 'border-accent'} shadow-sm">
            ${!isUser ? `
            <div class="flex items-center mb-2">
                <div class="assistant-avatar mr-2">
                    <i class="fas fa-robot text-accent"></i>
                </div>
                <span class="font-medium text-accent">CareCoreAI</span>
            </div>
            ` : ''}
            <p>${content}</p>
            <div class="message-timestamp">${timeString}</div>
        </div>
    `;
    
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
    const chatContainer = document.getElementById('chatContainer');
    const template = document.getElementById('typingIndicator');
    const clone = template.content.cloneNode(true);
    
    chatContainer.appendChild(clone);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function resetTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = '50px'; // Reset to default height
}

function initUI() {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    const mobileMenu = document.getElementById('mobileMenu');
    
    mobileMenuButton.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
    });

    // Clear chat button
    const clearChatButton = document.getElementById('clearChat');
    clearChatButton.addEventListener('click', () => {
        const chatContainer = document.getElementById('chatContainer');
        // Keep only the first welcome message
        while (chatContainer.children.length > 1) {
            chatContainer.removeChild(chatContainer.lastChild);
        }
    });

    // Export chat button
    const exportChatButton = document.getElementById('exportChat');
    exportChatButton.addEventListener('click', () => {
        const chatMessages = Array.from(document.querySelectorAll('.message-content p'))
            .map(p => p.textContent)
            .join('\n\n');
        
        const blob = new Blob([chatMessages], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'CareCoreAI-chat-export.txt';
        a.click();
        URL.revokeObjectURL(url);
    });

    // Emoji picker
    const emojiButton = document.getElementById('emojiButton');
    const emojiPicker = document.getElementById('emojiPicker');
    const userInput = document.getElementById('userInput');
    
    emojiButton.addEventListener('click', () => {
        emojiPicker.classList.toggle('hidden');
    });
    
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            userInput.value += btn.textContent;
            userInput.focus();
        });
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
    });

    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    const themeDropdown = document.getElementById('themeDropdown');

    themeToggle.addEventListener('click', () => {
        themeDropdown.classList.toggle('hidden');
    });

    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            document.documentElement.setAttribute('data-theme', theme);
            themeDropdown.classList.add('hidden');
            localStorage.setItem('selectedTheme', theme);
        });
    });

    // Load saved theme
    const savedTheme = localStorage.getItem('selectedTheme') || 'health';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Voice input functionality
    const voiceButton = document.getElementById('voiceButton');
    const voiceStatus = document.getElementById('voiceStatus');

    if ('webkitSpeechRecognition' in window) {
        const recognition = new webkitSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceButton.addEventListener('click', () => {
            if (voiceButton.classList.contains('listening')) {
                recognition.stop();
                voiceButton.classList.remove('listening');
                voiceStatus.classList.add('hidden');
            } else {
                recognition.start();
                voiceButton.classList.add('listening');
                voiceStatus.classList.remove('hidden');
            }
        });

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            voiceButton.classList.remove('listening');
            voiceStatus.classList.add('hidden');
            userInput.focus();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            voiceButton.classList.remove('listening');
            voiceStatus.classList.add('hidden');
            addMessageToUI("Voice input failed. Please try typing instead.", false);
        };
    } else {
        voiceButton.disabled = true;
        voiceButton.title = 'Speech recognition not supported in your browser';
    }
}