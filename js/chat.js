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
    if (chatContainer.children.length === 0) {
        const username = getUserName();
        let welcomeMessage = "Hello! I'm your CareCoreAI Health Assistant. I'm here to provide general health information and support. Please note that I'm not a substitute for professional medical advice. How can I help you today?";
        
        if (username) {
            welcomeMessage = `Hello ${username}! I'm your CareCoreAI Health Assistant. I'm here to provide general health information and support. Please note that I'm not a substitute for professional medical advice. How can I help you today?`;
        }
        
        addMessageToUI(welcomeMessage, false);
        
        // Ensure chat scrolls to bottom after welcome message
        setTimeout(scrollToBottom, 100);
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
    
    if (isUser) {
        // User messages appear instantly
        messageDiv.innerHTML = `
            <div class="message-content bg-accent text-primary p-4 rounded-lg border-l-4 border-transparent shadow-sm">
                <div class="message-text">${content}</div>
                <div class="message-timestamp text-xs opacity-75 mt-2">${timeString}</div>
            </div>
        `;
        chatContainer.appendChild(messageDiv);
        scrollToBottom();
    } else {
        // AI messages get typing animation
        const formattedContent = formatMessageContent(content);
        messageDiv.innerHTML = `
            <div class="message-content bg-accent bg-opacity-10 p-4 rounded-lg border-l-4 border-accent shadow-sm">
                <div class="flex items-center mb-2">
                    <div class="assistant-avatar mr-2">
                        <i class="fas fa-robot"></i>
                    </div>
                    <span class="font-medium text-accent">CareCoreAI</span>
                </div>
                <div class="message-text typing-container"></div>
                <div class="message-timestamp text-xs opacity-75 mt-2">${timeString}</div>
            </div>
        `;
        chatContainer.appendChild(messageDiv);
        
        // Start typing animation
        typeMessage(messageDiv.querySelector('.typing-container'), formattedContent);
    }
}

// Function to format message content with markdown-like syntax
function formatMessageContent(content) {
    if (!content) return '';
    
    let formatted = content
        // Convert **text** to bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Convert *text* to italic
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Convert numbered lists (1. text)
        .replace(/^(\d+)\.\s+(.+)$/gm, '<div class="list-item numbered"><span class="list-number">$1.</span><span class="list-text">$2</span></div>')
        // Convert bullet points (- text or • text)
        .replace(/^[-•]\s+(.+)$/gm, '<div class="list-item bulleted"><span class="list-bullet">•</span><span class="list-text">$1</span></div>')
        // Convert line breaks to proper HTML
        .replace(/\n/g, '<br>');
    
    // Wrap consecutive list items in a list container
    formatted = formatted.replace(
        /(<div class="list-item[^>]*>.*?<\/div>)+/g,
        (match) => `<div class="message-list">${match}</div>`
    );
    
    return formatted;
}

// Function to animate typing with HTML support
function typeMessage(container, content) {
    // Split content into chunks that preserve HTML tags
    const chunks = splitContentIntoTypableChunks(content);
    let currentIndex = 0;
    
    // Adjust typing speed based on content length
    const baseSpeed = 8; // milliseconds per chunk
    const speedMultiplier = Math.min(1, 100 / chunks.length); // Faster for longer messages
    const typingSpeed = Math.max(3, baseSpeed * speedMultiplier); // Minimum 3ms, maximum 8ms
    
    function typeNextChunk() {
        if (currentIndex < chunks.length) {
            container.innerHTML += chunks[currentIndex];
            currentIndex++;
            
            // Scroll to bottom after each chunk
            scrollToBottom();
            
            // Continue typing
            setTimeout(typeNextChunk, typingSpeed);
        } else {
            // Animation complete, ensure final scroll
            setTimeout(scrollToBottom, 100);
        }
    }
    
    // Start typing animation
    typeNextChunk();
}

// Function to split content into typable chunks while preserving HTML
function splitContentIntoTypableChunks(content) {
    const chunks = [];
    let currentChunk = '';
    let inTag = false;
    let tagBuffer = '';
    
    for (let i = 0; i < content.length; i++) {
        const char = content[i];
        
        if (char === '<') {
            // Start of HTML tag
            if (currentChunk) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
            inTag = true;
            tagBuffer = '<';
        } else if (char === '>') {
            // End of HTML tag
            tagBuffer += '>';
            chunks.push(tagBuffer);
            tagBuffer = '';
            inTag = false;
        } else if (inTag) {
            // Inside HTML tag
            tagBuffer += char;
        } else {
            // Regular text character
            currentChunk += char;
            
            // Split on spaces for natural word boundaries
            if (char === ' ' && currentChunk.length > 0) {
                chunks.push(currentChunk);
                currentChunk = '';
            }
        }
    }
    
    // Add any remaining content
    if (tagBuffer) {
        chunks.push(tagBuffer);
    }
    if (currentChunk) {
        chunks.push(currentChunk);
    }
    
    return chunks;
}

// Improved scroll function
function scrollToBottom() {
    const chatContainer = document.getElementById('chatContainer');
    
    // Use requestAnimationFrame for smooth scrolling
    requestAnimationFrame(() => {
        try {
            chatContainer.scrollTo({
                top: chatContainer.scrollHeight,
                behavior: 'smooth'
            });
        } catch (error) {
            // Fallback for browsers that don't support smooth scrolling
            chatContainer.scrollTop = chatContainer.scrollHeight;
        }
    });
}

// Enhanced typing indicator with auto-scroll
function showTypingIndicator() {
    const chatContainer = document.getElementById('chatContainer');
    const template = document.getElementById('typingIndicator');
    const clone = template.content.cloneNode(true);
    
    chatContainer.appendChild(clone);
    scrollToBottom();
}

function hideTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
        // Scroll to bottom after removing typing indicator
        scrollToBottom();
    }
}

// Add scroll to bottom when textarea is resized
function resetTextareaHeight(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = '50px'; // Reset to default height
    // Scroll to bottom when input area changes
    setTimeout(scrollToBottom, 100);
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
        // Clear all messages and add welcome message again
        chatContainer.innerHTML = '';
        addWelcomeMessage();
    });

    // Export chat button
    const exportChatButton = document.getElementById('exportChat');
    exportChatButton.addEventListener('click', () => {
        const chatMessages = Array.from(document.querySelectorAll('.message-text'))
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
    
    console.log('Setting up emoji button:', emojiButton);
    console.log('Setting up emoji picker:', emojiPicker);
    
    emojiButton.addEventListener('click', () => {
        console.log('Emoji button clicked');
        emojiPicker.classList.toggle('hidden');
        // Scroll to bottom when emoji picker is toggled
        setTimeout(scrollToBottom, 100);
    });
    
    // Close emoji picker when clicking outside
    document.addEventListener('click', (e) => {
        if (!emojiButton.contains(e.target) && !emojiPicker.contains(e.target)) {
            emojiPicker.classList.add('hidden');
        }
    });
    
    document.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('Emoji clicked:', btn.textContent);
            userInput.value += btn.textContent;
            userInput.focus();
            emojiPicker.classList.add('hidden');
        });
    });

    // Auto-resize textarea
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = `${Math.min(userInput.scrollHeight, 150)}px`;
        // Scroll to bottom when input changes
        setTimeout(scrollToBottom, 50);
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

    console.log('Setting up voice button:', voiceButton);
    console.log('Speech recognition available:', 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        voiceButton.addEventListener('click', () => {
            console.log('Voice button clicked, current state:', voiceButton.classList.contains('listening'));
            if (voiceButton.classList.contains('listening')) {
                recognition.stop();
                voiceButton.classList.remove('listening');
                voiceStatus.classList.add('hidden');
            } else {
                try {
                    recognition.start();
                    voiceButton.classList.add('listening');
                    voiceStatus.classList.remove('hidden');
                } catch (error) {
                    console.error('Speech recognition start error:', error);
                    addMessageToUI("Voice input failed to start. Please try again.", false);
                }
            }
        });

        recognition.onstart = () => {
            console.log('Speech recognition started');
        };

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
            
            if (event.error === 'not-allowed') {
                addMessageToUI("Microphone access denied. Please allow microphone access and try again.", false);
            } else {
                addMessageToUI("Voice input failed. Please try typing instead.", false);
            }
        };

        recognition.onend = () => {
            voiceButton.classList.remove('listening');
            voiceStatus.classList.add('hidden');
        };
    } else {
        voiceButton.disabled = true;
        voiceButton.title = 'Speech recognition not supported in your browser';
        voiceButton.addEventListener('click', () => {
            alert('Speech recognition is not supported in your browser. Please use text input instead.');
        });
    }
}