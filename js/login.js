document.addEventListener('DOMContentLoaded', function() {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // Setup UI and form handling
    setupUI(auth, db);
    createHealthIcons();
    setupFormHandling(auth, db);

    function setupUI(auth, db) {
        // Theme toggle functionality
        const themeToggleBtn = document.getElementById('theme-toggle');
        const body = document.body;
        
        // Check saved theme preference
        const savedTheme = localStorage.getItem('theme') || 'light';
        
        if (savedTheme === 'dark') {
            body.classList.add('dark-mode');
            themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
        }
        
        // Toggle theme
        themeToggleBtn.addEventListener('click', function() {
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                localStorage.setItem('theme', 'dark');
                themeToggleBtn.innerHTML = '<i class="fas fa-sun"></i>';
            } else {
                localStorage.setItem('theme', 'light');
                themeToggleBtn.innerHTML = '<i class="fas fa-moon"></i>';
            }
        });

        // Password visibility toggle
        const togglePasswordBtns = document.querySelectorAll('.toggle-password');
        togglePasswordBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const targetId = this.getAttribute('data-target');
                const passwordInput = document.getElementById(targetId);
                
                if (passwordInput.type === 'password') {
                    passwordInput.type = 'text';
                    this.classList.replace('fa-eye', 'fa-eye-slash');
                } else {
                    passwordInput.type = 'password';
                    this.classList.replace('fa-eye-slash', 'fa-eye');
                }
            });
        });

        // Form switching between login and signup
        const showSignupBtn = document.getElementById('show-signup');
        const showLoginBtn = document.getElementById('show-login');
        const loginPanel = document.getElementById('login-panel');
        const signupPanel = document.getElementById('signup-panel');
        const formTitle = document.getElementById('form-title');
        const formSubtitle = document.getElementById('form-subtitle');
        
        showSignupBtn.addEventListener('click', function(e) {
            e.preventDefault();
            loginPanel.classList.remove('active');
            signupPanel.classList.add('active');
            formTitle.textContent = 'Create Account';
            formSubtitle.textContent = 'Join CareCore for comprehensive health support';
            resetFormErrors('signup');
        });
        
        showLoginBtn.addEventListener('click', function(e) {
            e.preventDefault();
            signupPanel.classList.remove('active');
            loginPanel.classList.add('active');
            formTitle.textContent = 'Welcome Back';
            formSubtitle.textContent = 'Sign in to access your CareCore account';
            resetFormErrors('login');
        });

        // Custom dropdown for user type selection
        const userTypeDisplay = document.getElementById('user-type-display');
        const userTypeDropdown = document.getElementById('user-type-dropdown');
        const userTypeInput = document.getElementById('user-type');
        const selectItems = document.querySelectorAll('.select-item');
        
        userTypeDisplay.addEventListener('click', function() {
            userTypeDropdown.classList.toggle('show');
        });
        
        selectItems.forEach(item => {
            item.addEventListener('click', function() {
                const value = this.getAttribute('data-value');
                userTypeDisplay.textContent = this.textContent;
                userTypeInput.value = value;
                userTypeDropdown.classList.remove('show');
            });
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!userTypeDisplay.contains(e.target)) {
                userTypeDropdown.classList.remove('show');
            }
        });
    }

    function createHealthIcons() {
        const container = document.getElementById('health-icons-container');
        const icons = [
            'fa-heartbeat', 'fa-brain', 'fa-lungs', 'fa-stethoscope',
            'fa-prescription-bottle-alt', 'fa-tablets', 'fa-dna',
            'fa-microscope', 'fa-ambulance', 'fa-hospital', 'fa-notes-medical'
        ];
        
        for (let i = 0; i < 15; i++) {
            const icon = document.createElement('i');
            const randomIcon = icons[Math.floor(Math.random() * icons.length)];
            icon.className = `fas ${randomIcon} health-icon`;
            
            icon.style.left = `${Math.random() * 90 + 5}%`;
            icon.style.top = `${Math.random() * 90 + 5}%`;
            icon.style.animationDelay = `${Math.random() * 3}s`;
            icon.style.animationDuration = `${Math.random() * 2 + 2}s`;
            
            container.appendChild(icon);
        }
    }

    function setupFormHandling(auth, db) {
        // Login form elements
        const loginForm = document.getElementById('login-form');
        const loginEmail = document.getElementById('login-email');
        const loginPassword = document.getElementById('login-password');
        const loginError = document.getElementById('login-error');
        const loginSpinner = document.getElementById('login-spinner');
        
        // Signup form elements
        const signupForm = document.getElementById('signup-form');
        const signupUsername = document.getElementById('signup-username');
        const signupEmail = document.getElementById('signup-email');
        const signupPassword = document.getElementById('signup-password');
        const signupConfirmPassword = document.getElementById('signup-confirm-password');
        const userType = document.getElementById('user-type');
        const signupError = document.getElementById('signup-error');
        const signupSuccess = document.getElementById('signup-success');
        const signupSpinner = document.getElementById('signup-spinner');
        
        // Google auth buttons
        const googleLoginBtn = document.getElementById('google-login');
        const googleSignupBtn = document.getElementById('google-signup');
        
        // Add real-time validation for signup form
        signupEmail.addEventListener('input', validateEmail);
        signupPassword.addEventListener('input', validatePassword);
        signupConfirmPassword.addEventListener('input', validatePasswordMatch);
        
        // Handle login form submission
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            loginSpinner.style.display = 'inline-block';
            loginError.style.display = 'none';
            
            const email = loginEmail.value.trim();
            const password = loginPassword.value;
            
            // Basic validation
            if (!email || !password) {
                showLoginError('Please fill in all fields');
                return;
            }
            
            auth.signInWithEmailAndPassword(email, password)
                .then(() => {
                    window.location.href = 'loader.html';
                })
                .catch(error => {
                    loginSpinner.style.display = 'none';
                    showLoginError(getEnhancedErrorMessage(error));
                });
        });
        
        // Handle signup form submission
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Reset all messages and show spinner
            signupSpinner.style.display = 'inline-block';
            signupError.style.display = 'none';
            signupSuccess.style.display = 'none';
            resetFormErrors('signup');
            
            const username = signupUsername.value.trim();
            const email = signupEmail.value.trim();
            const password = signupPassword.value;
            const confirmPassword = signupConfirmPassword.value;
            const role = userType.value;
            
            // Enhanced validation with specific error messages
            if (!username) {
                showSignupError('Please enter a username');
                return;
            }
            
            if (username.length < 3) {
                showSignupError('Username must be at least 3 characters');
                return;
            }
            
            if (!email) {
                showSignupError('Please enter your email address');
                return;
            }
            
            if (!isValidEmail(email)) {
                showSignupError('Please enter a valid email address');
                return;
            }
            
            if (!role) {
                showSignupError('Please select your role');
                return;
            }
            
            if (!password) {
                showSignupError('Please enter a password');
                return;
            }
            
            if (password.length < 6) {
                showSignupError('Password should be at least 6 characters');
                return;
            }
            
            if (password !== confirmPassword) {
                showSignupError('Passwords do not match');
                return;
            }
            
            auth.createUserWithEmailAndPassword(email, password)
                .then(userCredential => {
                    return db.collection('users').doc(userCredential.user.uid).set({
                        username: username,
                        email: email,
                        userType: role,
                        createdAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                })
                .then(() => {
                    // Clear any previous errors and show success
                    signupError.style.display = 'none';
                    signupSpinner.style.display = 'none';
                    signupSuccess.textContent = 'Account created successfully! Redirecting...';
                    signupSuccess.style.display = 'block';
                    setTimeout(() => {
                        window.location.href = 'loader.html';
                    }, 1500);
                })
                .catch(error => {
                    // Ensure spinner is hidden and show error
                    signupSpinner.style.display = 'none';
                    signupSuccess.style.display = 'none';
                    showSignupError(getEnhancedErrorMessage(error));
                });
        });
        
        // Google auth handler
        function signInWithGoogle() {
            const provider = new firebase.auth.GoogleAuthProvider();
            
            auth.signInWithPopup(provider)
                .then(result => {
                    const user = result.user;
                    const isNewUser = result.additionalUserInfo.isNewUser;
                    
                    if (isNewUser) {
                        return db.collection('users').doc(user.uid).set({
                            username: user.displayName || 'User',
                            email: user.email,
                            userType: 'regular',
                            createdAt: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    }
                })
                .then(() => {
                    window.location.href = 'loader.html';
                })
                .catch(error => {
                    console.error('Google sign-in error:', error);
                    const errorPanel = document.querySelector('.form-panel.active .error-message');
                    errorPanel.textContent = getEnhancedErrorMessage(error);
                    errorPanel.style.display = 'block';
                });
        }
        
        // Attach Google auth to both buttons
        googleLoginBtn.addEventListener('click', signInWithGoogle);
        googleSignupBtn.addEventListener('click', signInWithGoogle);
        
        // Helper functions
        function showLoginError(message) {
            loginSpinner.style.display = 'none';
            loginError.textContent = message;
            loginError.style.display = 'block';
            loginForm.classList.add('form-error');
            setTimeout(() => loginForm.classList.remove('form-error'), 500);
        }
        
        function showSignupError(message) {
            signupSpinner.style.display = 'none';
            signupError.textContent = message;
            signupError.style.display = 'block';
            signupForm.classList.add('form-error');
            setTimeout(() => signupForm.classList.remove('form-error'), 500);
        }
        
        function resetFormErrors(formType) {
            if (formType === 'login') {
                loginError.style.display = 'none';
                loginEmail.style.borderColor = '';
                loginPassword.style.borderColor = '';
            } else {
                signupError.style.display = 'none';
                signupUsername.style.borderColor = '';
                signupEmail.style.borderColor = '';
                signupPassword.style.borderColor = '';
                signupConfirmPassword.style.borderColor = '';
            }
        }
        
        function validateEmail() {
            const email = signupEmail.value.trim();
            if (email && !isValidEmail(email)) {
                signupEmail.style.borderColor = 'var(--error)';
            } else {
                signupEmail.style.borderColor = '';
            }
        }
        
        function validatePassword() {
            if (signupPassword.value.length > 0 && signupPassword.value.length < 6) {
                signupPassword.style.borderColor = 'var(--error)';
            } else {
                signupPassword.style.borderColor = '';
            }
        }
        
        function validatePasswordMatch() {
            if (signupConfirmPassword.value && signupConfirmPassword.value !== signupPassword.value) {
                signupConfirmPassword.style.borderColor = 'var(--error)';
            } else {
                signupConfirmPassword.style.borderColor = '';
            }
        }
        
        function isValidEmail(email) {
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email);
        }
        
        function getEnhancedErrorMessage(error) {
            console.error("Auth error:", error);
            
            // Handle Firestore errors
            if (error.code === 'firestore/') {
                return 'Database error. Please try again later.';
            }
            
            // Handle Firebase Auth errors
            switch (error.code) {
                case 'auth/email-already-in-use':
                    return 'This email is already registered. Try signing in or use a different email.';
                case 'auth/invalid-email':
                    return 'Please enter a valid email address.';
                case 'auth/weak-password':
                    return 'Password should be at least 6 characters and include a mix of letters and numbers.';
                case 'auth/operation-not-allowed':
                    return 'Email/password accounts are not enabled. Please contact support.';
                case 'auth/network-request-failed':
                    return 'Network error. Please check your internet connection.';
                case 'auth/too-many-requests':
                    return 'Too many attempts. Please try again later.';
                case 'auth/user-disabled':
                    return 'This account has been disabled. Please contact support.';
                case 'auth/user-not-found':
                    return 'No account found with this email.';
                case 'auth/wrong-password':
                    return 'Incorrect password. Please try again.';
                default:
                    return 'An unexpected error occurred. Please try again.';
            }
        }
    }

    // Forgot Password Functionality
    const forgotPasswordLink = document.getElementById('forgot-password');
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const cancelResetBtn = document.getElementById('cancel-reset');
    const sendResetLinkBtn = document.getElementById('send-reset-link');
    const resetEmailInput = document.getElementById('reset-email');
    const resetError = document.getElementById('reset-error');
    const resetSuccess = document.getElementById('reset-success');

    // Show modal
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.classList.remove('hidden');
        resetError.classList.add('hidden');
        resetSuccess.classList.add('hidden');
        resetEmailInput.value = '';
    });

    // Hide modal
    cancelResetBtn.addEventListener('click', () => {
        forgotPasswordModal.classList.add('hidden');
    });

    // Send password reset email
    // Replace your current sendResetLinkBtn event listener with this:
    sendResetLinkBtn.addEventListener('click', (e) => {
        e.preventDefault(); // Add this to prevent any default form submission behavior
        const email = resetEmailInput.value.trim();
        
        console.log("Send Link clicked"); // Debug log
        
        if (!email) {
            showResetError('Please enter your email address');
            return;
        }
        
        if (!isValidEmail(email)) {
            showResetError('Please enter a valid email address');
            return;
        }
        
        console.log("Attempting to send reset email to:", email); // Debug log
        
        auth.sendPasswordResetEmail(email)
            .then(() => {
                console.log("Password reset email sent successfully"); // Debug log
                resetSuccess.textContent = 'Password reset email sent! Check your inbox.';
                resetSuccess.classList.remove('hidden');
                resetError.classList.add('hidden');
                
                setTimeout(() => {
                    forgotPasswordModal.classList.add('hidden');
                }, 3000);
            })
            .catch(error => {
                console.error("Error sending reset email:", error); // Debug log
                showResetError(getEnhancedErrorMessage(error));
            });
    });

});