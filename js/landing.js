// landing.js - Updated version

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const themeToggle = document.getElementById('theme-toggle');
    const themeModal = document.getElementById('theme-modal');
    const closeThemeModal = document.getElementById('close-theme-modal');
    const themeOptions = document.querySelectorAll('.theme-option');
    const customThemePicker = document.getElementById('custom-theme-picker');
    const applyCustomTheme = document.getElementById('apply-custom-theme');
    const profileBtn = document.getElementById('profile-btn');
    const profileModal = document.getElementById('profile-modal');
    const closeProfileModal = document.getElementById('close-profile-modal');
    const logoutBtn = document.getElementById('logout-btn');
    const featuresGrid = document.querySelector('.features-grid');
    const typedGreeting = document.getElementById('typed-greeting');
    const profileImage = document.getElementById('profile-image');
    
    // Current user data
    let currentUser = null;
    let userData = null;
    
    // Feature data with appropriate icons
    const features = [
        {
            title: 'Health Professionals',
            icon: 'fa-user-md',
            fallbackIcon: '👨‍⚕️',
            description: 'Connect with certified health professionals for personalized advice and consultations.',
            link: 'professionals.html'
        },
        {
            title: 'AI Chat Support',
            icon: 'fa-robot',
            fallbackIcon: '🤖',
            description: 'Get instant health information from our AI-powered chatbot available 24/7.',
            link: 'chat.html'
        },
        {
            title: 'Community Forum',
            icon: 'fa-users',
            fallbackIcon: '👥',
            description: 'Join discussions, share experiences, and get support from our health community.',
            link: 'forum.html'
        },
        {
            title: 'Health Marketplace',
            icon: 'fa-store',
            fallbackIcon: '🏪',
            description: 'Discover and purchase health and wellness products from trusted vendors.',
            link: 'mkt.html'
        },
        {
            title: 'Eye Health Tests',
            icon: 'fa-eye',
            fallbackIcon: '👁️',
            description: 'Take simple eye tests to monitor your vision health and get recommendations.',
            link: 'eye.html'
        },
        {
            title: 'Hearing Tests',
            icon: 'fa-deaf',
            fallbackIcon: '🦻',
            description: 'Evaluate your hearing with our easy-to-use audio tests and track results over time.',
            link: 'ear.html'
        }
    ];
    
    // Initialize the page
    function init() {
        // Load saved theme
        const savedTheme = localStorage.getItem('carecore-theme') || 'default';
        document.documentElement.className = `theme-${savedTheme}`;
        
        // Check auth state
        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                loadUserData();
            } else {
                window.location.href = 'login.html';
            }
        });
        
        // Initialize feature cards
        initFeatureCards();
        setupUsernameEditing();
    }
    
    // Initialize Typed Greeting
    function initTypedGreeting() {
        // Clear any existing content
        typedGreeting.innerHTML = '';
        
        // Check if Typed.js is properly loaded
        if (typeof Typed === 'undefined') {
            console.error('Typed.js not loaded');
            typedGreeting.textContent = 'Welcome to CareCore';
            return;
        }

        const username = userData?.username || currentUser?.displayName || 'User';
        
        // Destroy previous instance if exists
        if (typedGreeting._typed) {
            typedGreeting._typed.destroy();
        }
        
        // Initialize with proper options
        typedGreeting._typed = new Typed(typedGreeting, {
            strings: [
                `Welcome to CareCore, ${username}`,
                `Hello ${username}!`,
                `Are you reeady to feel better ${username}?`,
                `Enjoy you day ${username}!`,
                `Don't be shy to reach out.`
            ],
            typeSpeed: 50,
            backSpeed: 30,
            startDelay: 300,
            loop: true,
            showCursor: true,
            cursorChar: '|',
            contentType: 'html',
            onBegin: () => {
                typedGreeting.style.visibility = 'visible';
            },
            onDestroy: () => {
                typedGreeting.textContent = '';
            }
        });
    }

    // Initialize feature cards
    function initFeatureCards() {
        console.log('Initializing feature cards...');
        featuresGrid.innerHTML = '';
        
        features.forEach(feature => {
            console.log(`Creating card for: ${feature.title} with icon: ${feature.icon}`);
            const card = document.createElement('a');
            card.href = feature.link;
            card.className = 'feature-card bg-card-bg rounded-xl shadow-md p-6 hover:shadow-lg transition-all';
            card.innerHTML = `
                <div class="text-center">
                    <div class="feature-icon w-16 h-16 bg-primary bg-opacity-10 text-primary rounded-full flex items-center justify-center mx-auto mb-4 text-2xl" style="display: flex !important; align-items: center !important; justify-content: center !important; background-color: rgba(79, 70, 229, 0.1) !important; border-radius: 50% !important; margin: 0 auto 1rem auto !important;">
                        <i class="fas ${feature.icon}" style="display: inline-block !important; visibility: visible !important; opacity: 1 !important; font-size: 1.5rem !important; color: #4F46E5 !important;"></i>
                        <span class="fallback-icon" style="display: none; font-size: 1.5rem;">${feature.fallbackIcon}</span>
                    </div>
                    <h3 class="text-xl font-bold mb-2">${feature.title}</h3>
                    <p class="text-gray-600">${feature.description}</p>
                </div>
            `;
            featuresGrid.appendChild(card);
        });
        
        console.log('Feature cards created, attempting to load icons...');
        
        // Multiple attempts to ensure Font Awesome icons load
        const loadIcons = () => {
            console.log('Attempting to load Font Awesome icons...');
            if (window.FontAwesome) {
                console.log('FontAwesome found, calling i2svg...');
                window.FontAwesome.dom.i2svg();
            } else {
                console.log('FontAwesome not found');
            }
            // Also try the older method
            if (window.FontAwesome && window.FontAwesome.dom && window.FontAwesome.dom.watch) {
                console.log('Calling FontAwesome watch...');
                window.FontAwesome.dom.watch();
            }
        };
        
        // Try immediately
        loadIcons();
        
        // Try after a short delay
        setTimeout(loadIcons, 100);
        
        // Try after a longer delay
        setTimeout(loadIcons, 500);
        
        // Try after Font Awesome is fully loaded
        setTimeout(loadIcons, 1000);
        
        // Check if Font Awesome icons are working after 2 seconds
        setTimeout(() => {
            console.log('Checking if Font Awesome icons are visible...');
            const featureIcons = document.querySelectorAll('.feature-icon i');
            let iconsVisible = false;
            
            featureIcons.forEach(icon => {
                // Check if the icon has actual content or is just an empty element
                const computedStyle = window.getComputedStyle(icon, '::before');
                const content = computedStyle.content;
                console.log('Icon content:', content);
                
                if (content && content !== 'none' && content !== 'normal') {
                    iconsVisible = true;
                }
            });
            
            if (!iconsVisible) {
                console.log('Font Awesome icons not visible, showing fallback emojis...');
                const fallbackIcons = document.querySelectorAll('.fallback-icon');
                fallbackIcons.forEach(fallback => {
                    fallback.style.display = 'block';
                });
                const faIcons = document.querySelectorAll('.feature-icon i');
                faIcons.forEach(icon => {
                    icon.style.display = 'none';
                });
            } else {
                console.log('Font Awesome icons are working!');
                // Force show the icons with inline styles
                featureIcons.forEach(icon => {
                    icon.style.display = 'inline-block';
                    icon.style.visibility = 'visible';
                    icon.style.opacity = '1';
                    icon.style.fontSize = '1.5rem';
                    icon.style.color = 'inherit';
                });
            }
        }, 2000);
    }
    
    // Update loadUserData to ensure proper initialization
    async function loadUserData() {
        try {
            const doc = await db.collection('users').doc(currentUser.uid).get();
            if (doc.exists) {
                userData = doc.data();
                populateProfileInfo();
                // Initialize greeting after short delay
                setTimeout(initTypedGreeting, 100);
            } else {
                userData = {
                    username: currentUser.displayName || 'User',
                    email: currentUser.email,
                    userType: 'regular',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                await db.collection('users').doc(currentUser.uid).set(userData);
                populateProfileInfo();
                setTimeout(initTypedGreeting, 100);
            }
        } catch (error) {
            console.error("Error loading user data:", error);
            typedGreeting.textContent = 'Welcome to CareCore';
            typedGreeting.style.visibility = 'visible';
        }
    }
    
    // Populate Profile Info with User Data
    function populateProfileInfo() {
        if (!userData) return;
        
        // Set profile information
        document.getElementById('profile-username').textContent = userData.username || currentUser.displayName || 'User';
        document.getElementById('profile-email').textContent = userData.email || currentUser.email || '';
        
        // Set user type with proper formatting
        const userType = userData.userType || 'regular';
        document.getElementById('profile-user-type').textContent = 
            userType.charAt(0).toUpperCase() + userType.slice(1);
        
        // Set profile icon based on user type
        setProfileIcon(userType);
        
        // Show doctor verification if user is a doctor
        if (userType === 'doctor') {
            document.getElementById('doctor-verification-section').classList.remove('hidden');
            document.getElementById('doctor-license').textContent = userData.doctorLicense || 'Not provided';
            document.getElementById('doctor-specialty').textContent = userData.specialty || 'Not specified';
        }
    }
    
    // Set profile icon based on user type
    function setProfileIcon(userType) {
        const iconMap = {
            'doctor': 'fa-user-md',
            'student': 'fa-user-graduate',
            'enthusiast': 'fa-heartbeat',
            'regular': 'fa-user'
        };
        
        const defaultIcon = 'fa-user-circle';
        const iconClass = iconMap[userType] || defaultIcon;
        
        // Replace the image with an icon
        profileImage.parentElement.innerHTML = `
            <div class="w-20 h-20 rounded-full bg-primary bg-opacity-10 text-primary 
                flex items-center justify-center mx-auto mb-2 text-4xl">
                <i class="fas ${iconClass}"></i>
            </div>
        `;
    }

    // Event Listeners
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        mobileMenu.classList.toggle('hidden');
    });
    
    themeToggle.addEventListener('click', () => {
        themeModal.classList.remove('hidden');
        gsap.from(themeModal, {
            duration: 0.3,
            opacity: 0,
            y: 20,
            ease: "power2.out"
        });
    });
    
    closeThemeModal.addEventListener('click', () => {
        themeModal.classList.add('hidden');
    });
    
    themeOptions.forEach(option => {
        option.addEventListener('click', () => {
            const theme = option.dataset.theme;
            if (theme === 'custom') {
                customThemePicker.classList.remove('hidden');
            } else {
                document.documentElement.className = `theme-${theme}`;
                localStorage.setItem('carecore-theme', theme);
                themeModal.classList.add('hidden');
                customThemePicker.classList.add('hidden');
            }
        });
    });
    
    applyCustomTheme.addEventListener('click', () => {
        const primaryColor = document.getElementById('custom-primary').value;
        const secondaryColor = document.getElementById('custom-secondary').value;
        
        // Calculate darker shade for primary-dark
        const primaryDark = shadeColor(primaryColor, -20);
        
        // Apply custom theme
        document.documentElement.style.setProperty('--primary', primaryColor);
        document.documentElement.style.setProperty('--primary-dark', primaryDark);
        document.documentElement.style.setProperty('--secondary', secondaryColor);
        document.documentElement.style.setProperty('--bg-color', '#f8f9fa');
        document.documentElement.style.setProperty('--text-color', '#333');
        document.documentElement.style.setProperty('--card-bg', '#ffffff');
        
        localStorage.setItem('carecore-theme', 'custom');
        themeModal.classList.add('hidden');
        customThemePicker.classList.add('hidden');
    });
    
    profileBtn.addEventListener('click', () => {
        profileModal.classList.remove('hidden');
        gsap.from(profileModal, {
            duration: 0.3,
            opacity: 0,
            y: 20,
            ease: "power2.out"
        });
    });
    
    closeProfileModal.addEventListener('click', () => {
        profileModal.classList.add('hidden');
    });
    
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            window.location.href = 'login.html';
        }).catch(error => {
            console.error("Logout error:", error);
            alert('Error during logout. Please try again.');
        });
    });
    
    // Helper function to shade colors
    function shadeColor(color, percent) {
        let R = parseInt(color.substring(1,3), 16);
        let G = parseInt(color.substring(3,5), 16);
        let B = parseInt(color.substring(5,7), 16);

        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);

        R = (R<255)?R:255;  
        G = (G<255)?G:255;  
        B = (B<255)?B:255;  

        R = Math.round(R);
        G = Math.round(G);
        B = Math.round(B);

        const RR = ((R.toString(16).length===1)?"0"+R.toString(16):R.toString(16));
        const GG = ((G.toString(16).length===1)?"0"+G.toString(16):G.toString(16));
        const BB = ((B.toString(16).length===1)?"0"+B.toString(16):B.toString(16));

        return "#"+RR+GG+BB;
    }

    // Add these to your existing landing.js

    // Update setProfileIcon function
    function setProfileIcon(userType) {
        const iconMap = {
            'doctor': 'fa-user-md',
            'student': 'fa-user-graduate',
            'enthusiast': 'fa-heartbeat',
            'regular': 'fa-user-circle'
        };
        
        const profileIcon = document.getElementById('profile-icon');
        profileIcon.className = `fas ${iconMap[userType] || 'fa-user-circle'}`;
    }

    // Add username editing functionality
    function setupUsernameEditing() {
        const editBtn = document.getElementById('edit-username-btn');
        const editModal = document.getElementById('username-edit-modal');
        const closeModal = document.getElementById('close-username-modal');
        const cancelBtn = document.getElementById('cancel-username-change');
        const saveBtn = document.getElementById('save-username');
        const newUsernameInput = document.getElementById('new-username');
        const usernameError = document.getElementById('username-error');
        
        editBtn.addEventListener('click', () => {
            newUsernameInput.value = userData.username || '';
            editModal.classList.remove('hidden');
        });
        
        [closeModal, cancelBtn].forEach(btn => {
            btn.addEventListener('click', () => {
                editModal.classList.add('hidden');
                usernameError.classList.add('hidden');
            });
        });
        
        saveBtn.addEventListener('click', async () => {
            const newUsername = newUsernameInput.value.trim();
            
            if (!newUsername) {
                usernameError.textContent = 'Username cannot be empty';
                usernameError.classList.remove('hidden');
                return;
            }
            
            if (newUsername.length < 3) {
                usernameError.textContent = 'Username must be at least 3 characters';
                usernameError.classList.remove('hidden');
                return;
            }
            
            try {
                await db.collection('users').doc(currentUser.uid).update({
                    username: newUsername
                });
                
                userData.username = newUsername;
                document.getElementById('profile-username').textContent = newUsername;
                initTypedGreeting(); // Update the greeting with new username
                editModal.classList.add('hidden');
            } catch (error) {
                console.error("Error updating username:", error);
                usernameError.textContent = 'Error updating username. Please try again.';
                usernameError.classList.remove('hidden');
            }
        });
    }

    
    // Initialize the app
    init();
});