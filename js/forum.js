document.addEventListener('DOMContentLoaded', function() {
    // 1. Initialize Firebase
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    // 2. Get all HTML elements with null checks
    const elements = {
        messageFeed: document.getElementById('message-feed'),
        messageInput: document.getElementById('message-input'),
        sendButton: document.getElementById('send-button'),
        imageUpload: document.getElementById('image-upload'),
        imageUploadButton: document.getElementById('image-upload-button'),
        imageCount: document.getElementById('image-count'),
        imagePreview: document.getElementById('image-preview'),
        charCounter: document.getElementById('char-counter'),
        tagCounter: document.getElementById('tag-counter'),
        tagCount: document.getElementById('tag-count'),
        jumpToTags: document.getElementById('jump-to-tags'),
        newMessagesAlert: document.getElementById('new-messages-alert'),
        newMessagesCount: document.getElementById('new-messages-count'),
        loadingOlder: document.getElementById('loading-older'),
        mentionButton: document.getElementById('mention-button'),
        mentionPopover: document.getElementById('mention-popover'),
        mentionList: document.getElementById('mention-list'),
        mentionSearch: document.getElementById('mention-search'),
        closeMentionPopover: document.getElementById('close-mention-popover'),
        replyPreview: document.getElementById('reply-preview'),
        replyUsername: document.getElementById('reply-username'),
        replyPreviewText: document.getElementById('reply-preview-text'),
        cancelReply: document.getElementById('cancel-reply'),
        whisperButton: document.getElementById('whisper-button'),
        whisperUI: document.getElementById('whisper-ui'),
        whisperRecipient: document.getElementById('whisper-recipient'),
        cancelWhisper: document.getElementById('cancel-whisper'),
        refreshButton: document.getElementById('refresh-button')
    };

    // Verify all required elements exist
    for (const [key, element] of Object.entries(elements)) {
        if (!element) {
            console.error(`Critical error: Element '${key}' not found in the DOM`);
            return;
        }
    }

    // 3. State management with polling support
    const state = {
        currentUser: null,
        selectedImages: [],
        oldestMessageTimestamp: null,
        isFetchingOlder: false,
        unreadMessages: 0,
        taggedMessages: [],
        replyingToMessage: null,
        mentioningUser: false,
        mentionStartPos: 0,
        whisperRecipient: null,
        lastRefreshTime: null,
        allUsers: [],
        pollingInterval: null,
        lastMessageTimestamp: null,
        lastWhisperTimestamp: null,
        isPolling: false,
        pollCount: 0
    };

    // 4. Initialize the forum with polling system
    function initForum() {
        auth.onAuthStateChanged(user => {
            if (user) {
                state.currentUser = user;
                console.log("User logged in:", user.uid);
                
                // Stop any existing polling
                stopPolling();
                
                // Setup without real-time listeners
                setupScrollListener();
                setupEventListeners();
                
                // Load initial messages and start polling
                fetchInitialMessages().then(() => {
                    // Set initial timestamps from loaded messages
                    setInitialTimestamps();
                    // Start polling system
                    startPolling();
                });
                
                preloadMentionableUsers();
            } else {
                console.log("No user logged in, redirecting to login page");
                stopPolling();
                window.location.href = 'login.html';
            }
        });
    }

    // 5. Polling system implementation
    async function startPolling() {
        if (state.pollingInterval) {
            clearInterval(state.pollingInterval);
        }
        
        // Initial poll
        await pollForNewMessages();
        
        // Set up 10-second interval
        state.pollingInterval = setInterval(async () => {
            if (!state.isPolling && state.currentUser) {
                await pollForNewMessages();
            }
        }, 10000);
        
        console.log("Polling started - checking for new messages every 10 seconds");
    }

    function stopPolling() {
        if (state.pollingInterval) {
            clearInterval(state.pollingInterval);
            state.pollingInterval = null;
            console.log("Polling stopped");
        }
    }

    async function pollForNewMessages() {
        if (state.isPolling) return;
        
        state.isPolling = true;
        state.pollCount++;
        
        try {
            console.log(`Polling for new messages (poll #${state.pollCount})...`);
            
            // Check for new public messages
            await pollPublicMessages();
            
            // Check for new whispers
            await pollWhispers();
            
        } catch (error) {
            console.error("Polling error:", error);
            // Don't show error to user for background polling
        } finally {
            state.isPolling = false;
        }
    }

    async function pollPublicMessages() {
        let query = db.collection('community_messages')
            .where('isWhisper', '==', false)
            .orderBy('timestamp', 'desc')
            .limit(20);
        
        // Only get messages newer than our last known timestamp
        if (state.lastMessageTimestamp) {
            query = query.where('timestamp', '>', state.lastMessageTimestamp);
        }
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            console.log(`Found ${snapshot.docs.length} new public messages`);
            
            // Add new messages to the top (reverse order for proper display)
            const newMessages = snapshot.docs.reverse();
            
            newMessages.forEach(doc => {
                const message = doc.data();
                if (message.timestamp && !document.getElementById(`msg-${doc.id}`)) {
                    prependMessageSmoothly(doc.id, message);
                    
                    // Update tracking
                    if (!state.lastMessageTimestamp || message.timestamp > state.lastMessageTimestamp) {
                        state.lastMessageTimestamp = message.timestamp;
                    }
                    
                    // Handle tags
                    if (message.tags && message.tags.includes(state.currentUser.uid)) {
                        state.taggedMessages.unshift(doc.id);
                        updateTagCounter();
                    }
                    
                    // Handle new message notifications
                    handleNewMessageNotification(message);
                }
            });
        }
    }

    async function pollWhispers() {
        let query = db.collection('community_messages')
            .where('isWhisper', '==', true)
            .where('whisperTo', '==', state.currentUser.uid)
            .orderBy('timestamp', 'desc')
            .limit(10);
        
        if (state.lastWhisperTimestamp) {
            query = query.where('timestamp', '>', state.lastWhisperTimestamp);
        }
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            console.log(`Found ${snapshot.docs.length} new whispers`);
            
            snapshot.docs.reverse().forEach(doc => {
                const message = doc.data();
                if (message.timestamp && !document.getElementById(`msg-${doc.id}`)) {
                    prependWhisperMessageSmoothly(doc.id, message);
                    
                    if (!state.lastWhisperTimestamp || message.timestamp > state.lastWhisperTimestamp) {
                        state.lastWhisperTimestamp = message.timestamp;
                    }
                }
            });
        }
    }

    function setInitialTimestamps() {
        // Get the newest message timestamp as our starting point
        const firstMessage = elements.messageFeed.querySelector('[id^="msg-"]');
        if (firstMessage) {
            const messageId = firstMessage.id.replace('msg-', '');
            // You might need to store timestamps in data attributes or fetch from DOM
            // This ensures we don't re-fetch messages we already have
        }
    }

    // 6. Event listeners setup with improved popover handling
    function setupEventListeners() {
        // Message sending
        elements.sendButton.addEventListener('click', sendMessage);
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Character counter
        elements.messageInput.addEventListener('input', updateCharCounter);

        // Image handling
        elements.imageUploadButton.addEventListener('click', () => {
            elements.imageUpload.click();
        });

        // Handle image selection
        elements.imageUpload.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            
            if (files.length > 4) {
                showError("Maximum 4 images allowed");
                return;
            }
            
            // Validate file types and sizes
            const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            const maxSize = 5 * 1024 * 1024; // 5MB
            
            for (const file of files) {
                if (!validTypes.includes(file.type)) {
                    showError("Only JPEG, PNG, GIF, and WebP images are allowed");
                    return;
                }
                if (file.size > maxSize) {
                    showError("Each image must be less than 5MB");
                    return;
                }
            }
            
            state.selectedImages = files;
            elements.imageCount.textContent = `${files.length}/4`;
            
            // Show image previews
            elements.imagePreview.classList.remove('hidden');
            elements.imagePreview.innerHTML = '';
            
            files.forEach((file, index) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.createElement('div');
                    preview.className = 'relative';
                    preview.innerHTML = `
                        <img src="${e.target.result}" class="w-full h-20 object-cover rounded" alt="Preview">
                        <button class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs" onclick="removeImage(${index})">×</button>
                    `;
                    elements.imagePreview.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
        });

        // Mentions and whispers with improved popover handling
        elements.mentionButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMentionPopover(false);
        });
        
        elements.whisperButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleMentionPopover(true);
        });
        
        // Fix close button
        elements.closeMentionPopover.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeMentionPopover();
        });
        
        // Fix search input to prevent closing on focus
        elements.mentionSearch.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        elements.mentionSearch.addEventListener('input', filterMentionableUsers);
        
        // Prevent popover content clicks from closing it
        elements.mentionPopover.addEventListener('click', (e) => {
            e.stopPropagation();
        });
        
        // Fix document click listener for outside clicks
        document.addEventListener('click', handleDocumentClick);
        
        // ESC key to close popover
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeMentionPopover();
            }
        });

        // Reply system
        elements.cancelReply.addEventListener('click', cancelReplyToMessage);
        elements.cancelWhisper.addEventListener('click', cancelWhisper);

        // Tag navigation
        elements.jumpToTags.addEventListener('click', jumpToTaggedMessages);

        // New messages alert
        elements.newMessagesAlert.addEventListener('click', scrollToNewMessages);

        // Refresh button
        elements.refreshButton.addEventListener('click', refreshMessages);

        // Window focus/blur optimization
        window.addEventListener('focus', () => {
            console.log("Window focused - immediate poll check");
            if (state.currentUser && !state.isPolling) {
                pollForNewMessages();
            }
        });

        window.addEventListener('blur', () => {
            console.log("Window blurred - reducing poll frequency could be implemented here");
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => {
            stopPolling();
        });

        // Delegate event listeners for dynamic elements
        document.addEventListener('click', function(e) {
            // Handle reply button clicks
            if (e.target.classList.contains('reply-btn') || e.target.closest('.reply-btn')) {
                const messageId = e.target.closest('[data-message-id]').dataset.messageId;
                const messageElement = document.getElementById(`msg-${messageId}`);
                if (messageElement) {
                    const message = {
                        id: messageId,
                        username: messageElement.querySelector('.font-bold').textContent,
                        text: messageElement.querySelector('.break-words').textContent
                    };
                    setReplyToMessage(messageId, message);
                }
            }

            // Handle delete button clicks
            if (e.target.classList.contains('delete-btn') || e.target.closest('.delete-btn')) {
                const messageId = e.target.closest('[data-message-id]').dataset.messageId;
                deleteMessage(messageId);
            }

            // Handle flag button clicks
            if (e.target.classList.contains('flag-btn') || e.target.closest('.flag-btn')) {
                const messageId = e.target.closest('[data-message-id]').dataset.messageId;
                flagMessage(messageId);
            }
        });

        // Emoji picker
        if (!document.getElementById('emoji-picker-btn')) {
            const emojiBtn = document.createElement('button');
            emojiBtn.id = 'emoji-picker-btn';
            emojiBtn.type = 'button';
            emojiBtn.className = 'ml-2 text-xl';
            emojiBtn.innerHTML = '😊';
            elements.messageInput.parentNode.appendChild(emojiBtn);
            emojiBtn.addEventListener('click', () => {
                // Simple emoji picker
                const emojis = ['😀','😂','😍','😎','😭','😡','👍','🙏','🎉','🔥'];
                let picker = document.getElementById('emoji-picker-popup');
                if (picker) picker.remove();
                picker = document.createElement('div');
                picker.id = 'emoji-picker-popup';
                picker.className = 'absolute bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow p-2 z-50';
                picker.style.top = (emojiBtn.offsetTop + 30) + 'px';
                picker.style.left = emojiBtn.offsetLeft + 'px';
                emojis.forEach(e => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'text-2xl m-1';
                    btn.textContent = e;
                    btn.onclick = () => {
                        elements.messageInput.value += e;
                        updateCharCounter();
                        picker.remove();
                    };
                    picker.appendChild(btn);
                });
                document.body.appendChild(picker);
                document.addEventListener('click', function closePicker(ev) {
                    if (!picker.contains(ev.target) && ev.target !== emojiBtn) {
                        picker.remove();
                        document.removeEventListener('click', closePicker);
                    }
                });
            });
        }

        // Ctrl+Enter as send shortcut
        elements.messageInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    // 7. Improved popover functions
    function showMentionPopover(isWhisper = false) {
        closeMentionPopover();
        const triggerButton = isWhisper ? elements.whisperButton : elements.mentionButton;
        const rect = triggerButton.getBoundingClientRect();
        const popover = elements.mentionPopover;
        popover.style.position = 'fixed';
        popover.style.width = '280px';
        popover.style.zIndex = '1000';
        // Calculate available space below and above
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;
        const popoverHeight = 300; // max-height in CSS
        let top;
        if (spaceBelow > popoverHeight + 20) {
            // Place below
            top = rect.bottom + 5;
        } else if (spaceAbove > popoverHeight + 20) {
            // Place above
            top = rect.top - popoverHeight - 5;
        } else {
            // Place as best as possible within viewport
            top = Math.max(10, Math.min(rect.bottom + 5, window.innerHeight - popoverHeight - 10));
        }
        popover.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 290))}px`;
        popover.style.top = `${top}px`;
        popover.classList.remove('hidden');
        popover.style.display = 'block';
        elements.mentionSearch.dataset.mode = isWhisper ? 'whisper' : 'mention';
        elements.mentionSearch.value = '';
        setTimeout(() => {
            elements.mentionSearch.focus();
            filterMentionableUsers();
        }, 100);
        popover.dataset.justOpened = 'true';
        setTimeout(() => {
            popover.dataset.justOpened = 'false';
        }, 200);
    }

    function closeMentionPopover() {
        elements.mentionPopover.classList.add('hidden');
        elements.mentionPopover.style.display = 'none';
        elements.mentionSearch.value = '';
        elements.mentionPopover.dataset.justOpened = 'false';
    }

    function toggleMentionPopover(isWhisper = false) {
        if (elements.mentionPopover.classList.contains('hidden')) {
            showMentionPopover(isWhisper);
        } else {
            closeMentionPopover();
        }
    }

    // Improved click outside handler
    function handleDocumentClick(e) {
        // Don't close if popover was just opened
        if (elements.mentionPopover.dataset.justOpened === 'true') {
            return;
        }
        
        // Don't close if clicking inside popover
        if (elements.mentionPopover.contains(e.target)) {
            return;
        }
        
        // Don't close if clicking the trigger buttons
        if (elements.mentionButton.contains(e.target) || 
            elements.whisperButton.contains(e.target)) {
            return;
        }
        
        // Close if clicking anywhere else
        if (!elements.mentionPopover.classList.contains('hidden')) {
            closeMentionPopover();
        }
    }

    // 8. Message handling functions
    async function fetchInitialMessages() {
        try {
            console.log("Fetching initial messages...");
            elements.messageFeed.innerHTML = '<div class="text-center p-4">Loading messages...</div>';
            
            const snapshot = await db.collection('community_messages')
                .where('isWhisper', '==', false)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            
            elements.messageFeed.innerHTML = '';
            
            if (snapshot.empty) {
                elements.messageFeed.innerHTML = '<div class="text-center p-4">No messages yet. Be the first to post!</div>';
                return;
            }
            
            snapshot.docs.forEach(doc => {
                const message = doc.data();
                if (message.timestamp) {
                    appendMessage(doc.id, message);
                    
                    if (message.tags && message.tags.includes(state.currentUser.uid)) {
                        state.taggedMessages.push(doc.id);
                    }
                }
            });
            
            if (snapshot.docs.length > 0) {
                state.oldestMessageTimestamp = snapshot.docs[snapshot.docs.length - 1].data().timestamp;
                state.lastMessageTimestamp = snapshot.docs[0].data().timestamp;
            }
            
            updateTagCounter();
            console.log(`Loaded ${snapshot.docs.length} initial messages`);
            
            fetchWhispers();
            
        } catch (error) {
            console.error("Error fetching initial messages:", error);
            showError("Failed to load messages. Please refresh the page.");
        }
    }

    async function fetchWhispers() {
        try {
            console.log("Fetching whispers...");
            
            const snapshot = await db.collection('community_messages')
                .where('isWhisper', '==', true)
                .where('whisperTo', '==', state.currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();
            
            snapshot.docs.forEach(doc => {
                const message = doc.data();
                if (message.timestamp) {
                    prependWhisperMessage(doc.id, message);
                    
                    if (!state.lastWhisperTimestamp || message.timestamp > state.lastWhisperTimestamp) {
                        state.lastWhisperTimestamp = message.timestamp;
                    }
                }
            });
            
            console.log(`Loaded ${snapshot.docs.length} whispers`);
            
        } catch (error) {
            console.error("Error fetching whispers:", error);
        }
    }

    function setupScrollListener() {
        window.addEventListener('scroll', () => {
            if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                if (!state.isFetchingOlder && state.oldestMessageTimestamp) {
                    loadOlderMessages();
                }
            }
            
            if (window.scrollY === 0) {
                state.unreadMessages = 0;
                elements.newMessagesAlert.classList.add('hidden');
            }
        });
    }

    async function loadOlderMessages() {
        if (state.isFetchingOlder || !state.oldestMessageTimestamp) return;
        
        state.isFetchingOlder = true;
        elements.loadingOlder.classList.remove('hidden');
        
        try {
            console.log("Loading older messages...");
            
            const snapshot = await db.collection('community_messages')
                .where('isWhisper', '==', false)
                .orderBy('timestamp', 'desc')
                .startAfter(state.oldestMessageTimestamp)
                .limit(10)
                .get();
                
            if (!snapshot.empty) {
                snapshot.docs.forEach(doc => {
                    const message = doc.data();
                    appendMessage(doc.id, message);
                    
                    if (message.tags && message.tags.includes(state.currentUser.uid)) {
                        state.taggedMessages.push(doc.id);
                        updateTagCounter();
                    }
                });
                
                state.oldestMessageTimestamp = snapshot.docs[snapshot.docs.length - 1].data().timestamp;
                console.log(`Loaded ${snapshot.docs.length} older messages`);
            } else {
                console.log("No more older messages");
                state.oldestMessageTimestamp = null;
            }
        } catch (error) {
            console.error("Error loading older messages:", error);
        } finally {
            state.isFetchingOlder = false;
            elements.loadingOlder.classList.add('hidden');
        }
    }

    // 9. Message display functions with smooth animations
    function prependMessageSmoothly(id, message) {
        if (document.getElementById(`msg-${id}`)) return;
        
        const messageElement = createMessageElement(id, message);
        
        // Add smooth entrance animation
        messageElement.style.opacity = '0';
        messageElement.style.transform = 'translateY(-20px)';
        messageElement.style.transition = 'all 0.3s ease-in-out';
        
        // Insert at top
        if (elements.messageFeed.firstChild) {
            elements.messageFeed.insertBefore(messageElement, elements.messageFeed.firstChild);
        } else {
            elements.messageFeed.appendChild(messageElement);
        }
        
        // Trigger animation
        requestAnimationFrame(() => {
            messageElement.style.opacity = '1';
            messageElement.style.transform = 'translateY(0)';
        });
        
        // Add subtle highlight for new messages
        setTimeout(() => {
            messageElement.classList.add('new-message-highlight');
            setTimeout(() => messageElement.classList.remove('new-message-highlight'), 2000);
        }, 300);

        // Ensure auto-scroll to new messages
        if (window.scrollY < 100) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function prependWhisperMessageSmoothly(id, message) {
        const whisperElement = createMessageElement(id, message);
        whisperElement.classList.add('border-2', 'border-purple-500');
        
        // Same smooth animation as regular messages
        whisperElement.style.opacity = '0';
        whisperElement.style.transform = 'translateY(-20px)';
        whisperElement.style.transition = 'all 0.3s ease-in-out';
        
        elements.messageFeed.insertBefore(whisperElement, elements.messageFeed.firstChild);
        
        requestAnimationFrame(() => {
            whisperElement.style.opacity = '1';
            whisperElement.style.transform = 'translateY(0)';
        });

        // Ensure auto-scroll to new messages
        if (window.scrollY < 100) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    function appendMessage(id, message) {
        if (document.getElementById(`msg-${id}`)) return;
        elements.messageFeed.appendChild(createMessageElement(id, message));
    }

    function createMessageElement(id, message) {
        if (!message || !message.timestamp) {
            console.error("Invalid message data for ID:", id, message);
            return document.createElement('div');
        }
        
        const messageElement = document.createElement('div');
        messageElement.id = `msg-${id}`;
        messageElement.className = `message-bubble bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 ${getUserBadgeClass(message.userTag)}`;
        messageElement.dataset.messageId = id;
        
        const isWhisper = message.isWhisper;
        const whisperClass = isWhisper ? 'border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20' : '';
        messageElement.className += ` ${whisperClass}`;
        
        const timeString = formatTimestamp(message.timestamp);
        const isOwnMessage = message.userId === state.currentUser.uid;
        
        let messageContent = `
            <div class="flex justify-between items-start mb-2">
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-gray-800 dark:text-white">${message.username}</span>
                    ${isWhisper ? '<span class="text-purple-600 dark:text-purple-400 text-sm"><i class="fas fa-user-secret mr-1"></i>Whisper</span>' : ''}
                    <span class="text-xs ${getTagBadgeClass(message.userTag)} px-2 py-1 rounded-full">${message.userTag}</span>
                </div>
                <span class="text-xs text-gray-500">${timeString}</span>
            </div>
            <div class="break-words text-gray-700 dark:text-gray-300 mb-2">${highlightMentions(message.text)}</div>
        `;
        
        // Add images if present
        if (message.images && message.images.length > 0) {
            messageContent += '<div class="image-grid mb-2">';
            message.images.forEach(image => {
                if (image.type === 'cloudinary') {
                    messageContent += `<img src="${image.url}" class="w-full h-32 object-cover rounded cursor-pointer" onclick="openImageModal('${image.url}')" alt="Message image">`;
                } else if (image.type === 'base64') {
                    messageContent += `<img src="${image.url}" class="w-full h-32 object-cover rounded cursor-pointer" onclick="openImageModal('${image.url}')" alt="Message image">`;
                }
            });
            messageContent += '</div>';
        }
        
        // Add reply info if present
        if (message.replyToUsername) {
            messageContent += `
                <div class="text-sm text-gray-500 dark:text-gray-400 mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded">
                    <i class="fas fa-reply mr-1"></i>Replying to ${message.replyToUsername}
                </div>
            `;
        }
        
        messageContent += `
            <div class="flex space-x-2 text-sm">
                <button class="reply-btn text-indigo-600 dark:text-indigo-400 hover:underline">
                    <i class="fas fa-reply mr-1"></i>Reply
                </button>
                ${isOwnMessage ? '<button class="delete-btn text-red-600 dark:text-red-400 hover:underline"><i class="fas fa-trash mr-1"></i>Delete</button>' : ''}
                <button class="flag-btn text-yellow-600 dark:text-yellow-400 hover:underline">
                    <i class="fas fa-flag mr-1"></i>Flag
                </button>
            </div>
        `;
        
        messageElement.innerHTML = messageContent;
        return messageElement;
    }

    function handleNewMessageNotification(message) {
        // Only show notification if user scrolled down and message is recent
        const messageDate = message.timestamp.toDate();
        const isRecent = (new Date() - messageDate) < 60000; // 1 minute
        
        if (isRecent && window.scrollY > 100) {
            state.unreadMessages++;
            elements.newMessagesCount.textContent = state.unreadMessages;
            elements.newMessagesAlert.classList.remove('hidden');
            
            // Add pulse animation to alert
            elements.newMessagesAlert.classList.add('pulse-animation');
            setTimeout(() => elements.newMessagesAlert.classList.remove('pulse-animation'), 1000);
        }
    }

    // 10. Message sending functions
    async function sendMessage() {
        const text = elements.messageInput.value.trim();
        if (!text || text.length > 500) {
            showError("Message must be between 1-500 characters");
            return;
        }
        
        elements.sendButton.disabled = true;
        elements.sendButton.innerHTML = '<div class="loading-spinner inline-block"></div>';
        
        try {
            console.log("Sending message...");
            
            // Get user data
            const userDoc = await db.collection('users').doc(state.currentUser.uid).get();
            if (!userDoc.exists) throw new Error("User profile not found");
            
            const userData = userDoc.data();
            
            // Upload images if any
            let imageUrls = [];
            if (state.selectedImages.length > 0) {
                console.log("Uploading images...");
                imageUrls = await uploadImagesToCloudinary(state.selectedImages);
            }
            
            // Prepare message
            const messageData = {
                userId: state.currentUser.uid,
                username: userData.username || "Anonymous",
                userTag: userData.userType || "user",
                text: text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                tags: extractTags(text),
                isWhisper: !!state.whisperRecipient,
                whisperTo: state.whisperRecipient?.userId || null,
                whisperToUsername: state.whisperRecipient?.username || null,
                replyTo: state.replyingToMessage?.id || null,
                replyToUsername: state.replyingToMessage?.username || null,
                images: imageUrls // Array of {type: 'cloudinary'|'base64', url: string}
            };
            
            // Add to Firestore
            await db.collection('community_messages').add(messageData);
            
            // Clear input
            elements.messageInput.value = '';
            elements.charCounter.textContent = '0/500';
            clearSelectedImages();
            cancelReplyToMessage();
            
            // Show whisper feedback
            if (state.whisperRecipient) {
                showSuccess(`Whisper sent to ${state.whisperRecipient.username}!`);
                cancelWhisper();
            }
            
            // IMMEDIATE POLL after sending
            console.log("Message sent, polling for updates...");
            setTimeout(() => pollForNewMessages(), 1000); // Small delay to ensure Firebase processes
            
        } catch (error) {
            console.error("Error sending message:", error);
            showError(`Failed to send message: ${error.message}`);
        } finally {
            elements.sendButton.disabled = false;
            elements.sendButton.innerHTML = '<i class="fas fa-paper-plane"></i>';
        }
    }

    // Alternative: Convert image to base64 for storage in Firestore
    async function convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    // Cloudinary image upload function with fallback
    async function uploadImagesToCloudinary(imageFiles) {
        const uploadPromises = imageFiles.map(async (file) => {
            // First try Cloudinary
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', cloudinaryConfig.uploadPreset);
                formData.append('cloud_name', cloudinaryConfig.cloudName);
                
                console.log('Uploading to Cloudinary:', {
                    cloudName: cloudinaryConfig.cloudName,
                    uploadPreset: cloudinaryConfig.uploadPreset,
                    fileName: file.name,
                    fileSize: file.size
                });
                
                const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/image/upload`, {
                    method: 'POST',
                    body: formData
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Cloudinary response:', response.status, errorText);
                    throw new Error(`Upload failed: ${response.status} - ${errorText}`);
                }
                
                const data = await response.json();
                console.log('Upload successful:', data.secure_url);
                return { type: 'cloudinary', url: data.secure_url };
            } catch (error) {
                console.error('Cloudinary upload failed, trying base64 fallback:', error);
                
                // Fallback: Convert to base64
                try {
                    const base64Data = await convertImageToBase64(file);
                    console.log('Base64 conversion successful');
                    return { type: 'base64', url: base64Data };
                } catch (base64Error) {
                    console.error('Base64 conversion failed:', base64Error);
                    throw new Error(`Failed to process image: ${error.message}`);
                }
            }
        });
        
        return Promise.all(uploadPromises);
    }

    // 11. Reply and mention functions
    function setReplyToMessage(id, message) {
        if (!message) return;
        
        state.replyingToMessage = { id, ...message };
        elements.replyUsername.textContent = message.username || 'Anonymous';
        elements.replyPreviewText.textContent = message.text ? 
            (message.text.length > 50 ? message.text.substring(0, 50) + '...' : message.text) : '';
        elements.replyPreview.classList.remove('hidden');
        elements.messageInput.focus();
    }

    function cancelReplyToMessage() {
        state.replyingToMessage = null;
        elements.replyPreview.classList.add('hidden');
    }

    function cancelWhisper() {
        state.whisperRecipient = null;
        elements.whisperUI.classList.add('hidden');
    }

    async function preloadMentionableUsers() {
        try {
            elements.mentionList.innerHTML = '<div class="p-2 text-center">Loading users...</div>';
            
            const snapshot = await db.collection('users')
                .orderBy('username')
                .get();
                
            state.allUsers = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    username: data.username,
                    userId: data.userId || doc.id,
                    userType: data.userType || 'user'
                };
            });
            
            console.log(`Preloaded ${state.allUsers.length} users for mentions`);
            filterMentionableUsers(); // Refresh the list with loaded users
        } catch (error) {
            console.error("Error preloading users:", error);
            elements.mentionList.innerHTML = '<div class="p-2 text-center text-red-500">Could not load users</div>';
        }
    }

    function filterMentionableUsers() {
        const searchTerm = elements.mentionSearch.value.trim().toLowerCase();
        elements.mentionList.innerHTML = '';
        
        const filteredUsers = searchTerm 
            ? state.allUsers
                .filter(user => 
                    user.username.toLowerCase().includes(searchTerm.toLowerCase()) &&
                    user.userId !== state.currentUser.uid
                )
            : state.allUsers
                .filter(user => user.userId !== state.currentUser.uid)
                .slice(0, 20);
        
        if (filteredUsers.length === 0) {
            elements.mentionList.innerHTML = '<div class="p-2 text-center text-red-500">No users found. Please check your connection or ask an admin to add users.</div>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center user-option';
            userElement.innerHTML = `
                <span class="flex-1">${user.username}</span>
                <span class="text-xs ${getTagBadgeClass(user.userType)} px-2 py-1 rounded-full">
                    ${user.userType}
                </span>
            `;
            
            // Fix user selection handler
            userElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectUser(user);
            });
            
            elements.mentionList.appendChild(userElement);
        });
    }

    function selectUser(user) {
        const isWhisperMode = elements.mentionSearch.dataset.mode === 'whisper';
        
        if (isWhisperMode) {
            // Handle whisper selection
            state.whisperRecipient = user;
            elements.whisperRecipient.textContent = user.username;
            elements.whisperUI.classList.remove('hidden');
            showSuccess(`Whisper mode: messaging ${user.username}`);
        } else {
            // Handle mention selection
            const currentText = elements.messageInput.value;
            const newText = currentText.substring(0, state.mentionStartPos) + 
                           `@${user.username} ` + 
                           currentText.substring(elements.messageInput.selectionStart);
            elements.messageInput.value = newText;
            
            // Set cursor position after the mention
            const newCursorPos = state.mentionStartPos + user.username.length + 2;
            elements.messageInput.focus();
            elements.messageInput.setSelectionRange(newCursorPos, newCursorPos);
            
            updateCharCounter();
        }
        
        // Close popover after selection
        closeMentionPopover();
    }

    function updateCharCounter() {
        elements.charCounter.textContent = `${elements.messageInput.value.length}/500`;
        handleMentionTrigger();
    }

    function handleMentionTrigger() {
        const cursorPos = elements.messageInput.selectionStart;
        const textBeforeCursor = elements.messageInput.value.substring(0, cursorPos);
        const lastAtPos = textBeforeCursor.lastIndexOf('@');
        
        // Check if @ was just typed or we're in a mention
        if (lastAtPos >= 0 && (cursorPos - lastAtPos === 1 || !textBeforeCursor.substring(lastAtPos + 1).includes(' '))) {
            state.mentioningUser = true;
            state.mentionStartPos = lastAtPos;
            showMentionPopover(false);
            
            // Filter based on text after @
            const currentMention = textBeforeCursor.substring(lastAtPos + 1);
            elements.mentionSearch.value = currentMention;
            filterMentionableUsers();
        } else {
            state.mentioningUser = false;
            elements.mentionPopover.classList.add('hidden');
        }
    }

    // 12. Utility functions
    function highlightMentions(text) {
        if (!text) return '';
        // Updated regex to match @ followed by any characters except whitespace
        return text.replace(/@([^\s]+)/g, '<span class="mention bg-yellow-100 px-1 rounded">@$1</span>');
    }

    function extractTags(text) {
        // Updated regex to match @ followed by any characters except whitespace
        const mentions = [...text.matchAll(/@([^\s]+)/g)];
        return mentions.map(m => m[1]);
    }

    function updateTagCounter() {
        elements.tagCount.textContent = state.taggedMessages.length;
        elements.tagCounter.classList.toggle('hidden', state.taggedMessages.length === 0);
    }

    function jumpToTaggedMessages() {
        if (state.taggedMessages.length > 0) {
            const firstTag = document.getElementById(`msg-${state.taggedMessages[0]}`);
            if (firstTag) {
                firstTag.scrollIntoView({ behavior: 'smooth' });
                firstTag.classList.add('tag-highlight');
                setTimeout(() => firstTag.classList.remove('tag-highlight'), 2000);
            }
        }
    }

    function scrollToNewMessages() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        elements.newMessagesAlert.classList.add('hidden');
        state.unreadMessages = 0;
    }

    function clearSelectedImages() {
        state.selectedImages = [];
        elements.imagePreview.classList.add('hidden');
        elements.imageCount.textContent = '0/4';
        elements.imageUpload.value = '';
    }

    async function flagMessage(messageId) {
        if (confirm("Are you sure you want to flag this message as inappropriate?")) {
            try {
                await db.collection('community_messages').doc(messageId).update({
                    flagged: true
                });
                showSuccess("Message has been flagged for review. Thank you.");
            } catch (error) {
                console.error("Error flagging message:", error);
                showError("Failed to flag message. Please try again.");
            }
        }
    }

    async function deleteMessage(messageId) {
        if (confirm("Are you sure you want to delete this message?")) {
            try {
                await db.collection('community_messages').doc(messageId).delete();
                showSuccess("Message deleted successfully.");
            } catch (error) {
                console.error("Error deleting message:", error);
                showError("Failed to delete message. You may not have permission.");
            }
        }
    }

    function formatTimestamp(timestamp) {
        if (!timestamp) return '';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function getUserBadgeClass(userTag) {
        switch(userTag) {
            case 'doctor': return 'bg-red-50 border-l-4 border-red-500';
            case 'student': return 'bg-blue-50 border-l-4 border-blue-500';
            case 'enthusiast': return 'bg-green-50 border-l-4 border-green-500';
            default: return 'bg-gray-50 border-l-4 border-gray-500';
        }
    }

    function getTagBadgeClass(userTag) {
        switch(userTag) {
            case 'doctor': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
            case 'student': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
            case 'enthusiast': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
            default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        }
    }

    function prependWhisperMessage(id, message) {
        const whisperElement = createMessageElement(id, message);
        whisperElement.classList.add('border-2', 'border-purple-500');
        elements.messageFeed.insertBefore(whisperElement, elements.messageFeed.firstChild);
    }

    function showWhisperNotification(senderName) {
        if (Notification.permission === 'granted') {
            new Notification(`New whisper from ${senderName}`, {
                body: 'You received a private message',
                icon: '/favicon.ico'
            });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') showWhisperNotification(senderName);
            });
        }
        
        // Fallback browser alert
        if (!document.hidden) {
            const alert = document.createElement('div');
            alert.className = 'fixed top-4 right-4 bg-purple-600 text-white px-4 py-2 rounded-lg shadow-lg z-50';
            alert.innerHTML = `
                <i class="fas fa-user-secret mr-2"></i>
                New whisper from ${senderName}
            `;
            document.body.appendChild(alert);
            setTimeout(() => alert.remove(), 5000);
        }
    }

    async function refreshMessages() {
        elements.refreshButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i>';
        elements.refreshButton.disabled = true;
        
        try {
            console.log("Manual refresh triggered - full reload");
            
            // Stop polling during refresh
            stopPolling();
            
            // Clear everything
            elements.messageFeed.innerHTML = '<div class="text-center p-4">Refreshing messages...</div>';
            state.oldestMessageTimestamp = null;
            state.taggedMessages = [];
            state.lastMessageTimestamp = null;
            state.lastWhisperTimestamp = null;
            state.unreadMessages = 0;
            elements.newMessagesAlert.classList.add('hidden');
            
            // Reload everything
            await fetchInitialMessages();
            await fetchWhispers();
            
            // Restart polling
            setInitialTimestamps();
            startPolling();
            
            showSuccess("Messages refreshed successfully!");
            
        } catch (error) {
            console.error("Refresh failed:", error);
            showError("Failed to refresh messages. Please try again.");
        } finally {
            elements.refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-1"></i>';
            elements.refreshButton.disabled = false;
        }
    }

    function showError(message) {
        const errorEl = document.createElement('div');
        errorEl.className = 'fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        errorEl.textContent = message;
        document.body.appendChild(errorEl);
        setTimeout(() => errorEl.remove(), 5000);
    }

    function showSuccess(message) {
        const successEl = document.createElement('div');
        successEl.className = 'fixed top-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-50';
        successEl.textContent = message;
        document.body.appendChild(successEl);
        setTimeout(() => successEl.remove(), 5000);
    }

    // 13. Global functions for HTML event handlers
    window.openImageModal = function(imageUrl) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="max-w-4xl max-h-full p-4">
                <img src="${imageUrl}" class="max-w-full max-h-full object-contain" alt="Full size image">
                <button class="absolute top-4 right-4 text-white text-2xl" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        document.body.appendChild(modal);
    };

    // Remove image function
    window.removeImage = function(index) {
        state.selectedImages.splice(index, 1);
        elements.imageCount.textContent = `${state.selectedImages.length}/4`;
        
        if (state.selectedImages.length === 0) {
            elements.imagePreview.classList.add('hidden');
            elements.imageUpload.value = '';
        } else {
            // Recreate previews
            elements.imagePreview.innerHTML = '';
            state.selectedImages.forEach((file, idx) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const preview = document.createElement('div');
                    preview.className = 'relative';
                    preview.innerHTML = `
                        <img src="${e.target.result}" class="w-full h-20 object-cover rounded" alt="Preview">
                        <button class="absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 text-xs" onclick="removeImage(${idx})">×</button>
                    `;
                    elements.imagePreview.appendChild(preview);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    window.scrollToMessage = function(messageId) {
        const targetMessage = document.getElementById(`msg-${messageId}`);
        if (targetMessage) {
            targetMessage.scrollIntoView({ behavior: 'smooth' });
            targetMessage.classList.add('highlight-message');
            setTimeout(() => targetMessage.classList.remove('highlight-message'), 2000);
        }
    };

    // 14. Start the forum
    initForum();

    // Add dark/light mode toggle in header if not present
    // Fix dark/light mode toggle: persist in localStorage and apply on page load
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark');
            localStorage.setItem('carecore-theme', 'dark');
        } else {
            document.body.classList.remove('dark');
            localStorage.setItem('carecore-theme', 'light');
        }
        // Optionally update toggle icon
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            btn.innerHTML = document.body.classList.contains('dark') ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        }
    }
    // On page load, apply saved theme
    (function() {
        const saved = localStorage.getItem('carecore-theme');
        if (saved === 'dark') {
            document.body.classList.add('dark');
        } else if (saved === 'light') {
            document.body.classList.remove('dark');
        }
    })();
    // Update the theme toggle button to use applyTheme
    if (!document.getElementById('theme-toggle-btn')) {
        const header = document.querySelector('header .container');
        const btn = document.createElement('button');
        btn.id = 'theme-toggle-btn';
        btn.className = 'ml-4 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400';
        btn.innerHTML = '<i class="fas fa-moon"></i>';
        btn.title = 'Toggle Dark/Light Mode';
        btn.onclick = () => {
            const isDark = document.body.classList.contains('dark');
            applyTheme(isDark ? 'light' : 'dark');
        };
        header.appendChild(btn);
    } else {
        document.getElementById('theme-toggle-btn').onclick = () => {
            const isDark = document.body.classList.contains('dark');
            applyTheme(isDark ? 'light' : 'dark');
        };
    }
});