// eye.js - Enhanced with all test types and fixed functionality

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let userEyeData = null;
let testTimer;
let currentRow = 0;
let currentEye = 'right';
let testResults = {
    right: { smallestLine: 0, correctAnswers: [] },
    left: { smallestLine: 0, correctAnswers: [] }
};

// Snellen chart configuration with random letter generation
const snellenLetters = ['E', 'F', 'P', 'T', 'O', 'Z', 'L', 'D', 'C', 'A', 'B', 'H', 'K', 'M', 'N', 'R', 'S', 'U', 'V', 'W', 'X', 'Y'];

function generateRandomSnellenChart() {
    return [
        { size: 72, letterCount: 6 },
        { size: 60, letterCount: 9 },
        { size: 48, letterCount: 10 },
        { size: 36, letterCount: 10 },
        { size: 24, letterCount: 10 },
        { size: 18, letterCount: 10 }
    ].map(row => {
        const letters = [];
        for (let i = 0; i < row.letterCount; i++) {
            letters.push(snellenLetters[Math.floor(Math.random() * snellenLetters.length)]);
        }
        return {
            ...row,
            letters: letters.join(' '),
            correct: letters.join('')
        };
    });
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize animations
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 800,
            easing: 'ease-in-out',
            once: true
        });
    }

    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            initializeApp();
        } else {
            window.location.href = 'login.html';
        }
    });

    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobileMenuButton');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', function() {
            const mobileMenu = document.getElementById('mobileMenu');
            if (mobileMenu) {
                mobileMenu.classList.toggle('hidden');
            }
        });
    }

    // FAQ toggle functionality
    document.querySelectorAll('.faq-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.closest('.bg-white');
            const content = faqItem.querySelector('.faq-content');
            const icon = button.querySelector('i');
            
            if (content) content.classList.toggle('hidden');
            if (icon) {
                icon.classList.toggle('transform');
                icon.classList.toggle('rotate-180');
            }
        });
    });

    // Replace placeholder image
    const heroImage = document.querySelector('.hero-gradient img');
    if (heroImage) {
        heroImage.src = 'https://images.unsplash.com/photo-1505576399279-565b52d4ac71?ixlib=rb-1.2.1&auto=format&fit=crop&w=600&h=400&q=80';
    }

    // Initialize test buttons
    setupTestButtons();
});

// Initialize the app for authenticated users
function initializeApp() {
    const userProfileSection = document.getElementById('userProfileSection');
    const dashboardContent = document.getElementById('dashboardContent');
    const userDisplayName = document.getElementById('userDisplayName');
    
    if (userProfileSection) userProfileSection.classList.remove('hidden');
    if (dashboardContent) dashboardContent.classList.remove('hidden');
    if (userDisplayName) {
        userDisplayName.textContent = currentUser.displayName || currentUser.email.split('@')[0];
    }
    
    loadUserEyeData();
}

// Set up test button event listeners
function setupTestButtons() {
    // Start test buttons - look for buttons with data-test-type or specific button classes
    const testButtons = document.querySelectorAll('[data-test-type], .test-button, button[onclick*="startTest"]');
    testButtons.forEach(button => {
        // Remove inline onclick to prevent conflicts
        button.removeAttribute('onclick');
        
        // Add proper event listener
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Get test type from data attribute or button text
            let testType = this.getAttribute('data-test-type');
            if (!testType) {
                const buttonText = this.textContent.toLowerCase();
                if (buttonText.includes('visual acuity')) testType = 'visual-acuity';
                else if (buttonText.includes('color vision')) testType = 'color-vision';
                else if (buttonText.includes('contrast')) testType = 'contrast';
                else if (buttonText.includes('astigmatism')) testType = 'astigmatism';
                else if (buttonText.includes('near vision')) testType = 'near-vision';
                else if (buttonText.includes('complete')) testType = 'complete';
                else testType = 'visual-acuity'; // default
            }
            
            console.log('Starting test:', testType); // Debug log
            startTest(testType);
        });
    });

    // Close modal button
    const closeTestModalBtn = document.getElementById('closeTestModal');
    if (closeTestModalBtn) {
        closeTestModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            closeTestModal();
        });
    }

    // Screen calibration slider
    const calibrationSlider = document.getElementById('calibrationSlider');
    if (calibrationSlider) {
        calibrationSlider.addEventListener('input', function(e) {
            const value = e.target.value;
            const calibrationBox = document.getElementById('cardSizeCalibration');
            if (calibrationBox) {
                calibrationBox.style.width = `${85.6 * (value / 100)}mm`;
            }
        });
    }

    // Start test button in calibration
    const startTestButton = document.getElementById('startTestButton');
    if (startTestButton) {
        startTestButton.addEventListener('click', function(e) {
            e.preventDefault();
            proceedToTest();
        });
    }
}

// Load user eye data from Firestore
function loadUserEyeData() {
    console.log('Loading user eye data for:', currentUser.uid);
    db.collection('eye').doc(currentUser.uid).get()
        .then(doc => {
            if (doc.exists) {
                userEyeData = doc.data();
                console.log('Loaded existing eye data:', userEyeData);
                // Convert Firestore timestamps to JavaScript Date objects
                if (userEyeData.testHistory) {
                    userEyeData.testHistory = userEyeData.testHistory.map(test => ({
                        ...test,
                        date: test.date && test.date.toDate ? test.date.toDate() : new Date(test.date || Date.now()),
                        timestamp: test.timestamp && test.timestamp.toDate ? test.timestamp.toDate() : new Date(test.timestamp || Date.now())
                    }));
                }
                if (userEyeData.lastTest && userEyeData.lastTest.toDate) {
                    userEyeData.lastTest = userEyeData.lastTest.toDate();
                }
                updateDashboard();
            } else {
                console.log('No existing eye data found, creating new data');
                userEyeData = {
                    testHistory: [],
                    badges: [],
                    lastTest: null,
                    streak: 0,
                    totalTests: 0,
                    bestScore: 0
                };
                db.collection('eye').doc(currentUser.uid).set(userEyeData)
                    .then(() => {
                        console.log('Created new eye data document');
                        updateDashboard();
                    })
                    .catch(error => {
                        console.error("Error creating new eye data:", error);
                        updateDashboard();
                    });
            }
        })
        .catch(error => {
            console.error("Error loading user eye data:", error);
            // Initialize with default data if there's an error
            userEyeData = {
                testHistory: [],
                badges: [],
                lastTest: null,
                streak: 0,
                totalTests: 0,
                bestScore: 0
            };
            updateDashboard();
        });
}

// Update dashboard with user data
function updateDashboard() {
    // Check if Chart.js is available before trying to create charts
    if (typeof Chart === 'undefined') {
        console.warn('Chart.js not loaded yet, skipping chart initialization');
        // Still update other dashboard elements
        updateRecentTests();
        updateBadges();
        updateStreak();
        updateNextTestRecommendation();
        return;
    }
    
    initTestHistoryChart();
    updateRecentTests();
    updateBadges();
    updateStreak();
    updateNextTestRecommendation();
}

// Initialize test history chart
function initTestHistoryChart() {
    const chartElement = document.getElementById('testHistoryChart');
    if (!chartElement || typeof Chart === 'undefined') return;
    
    // Destroy existing chart if it exists and is a valid Chart instance
    if (window.testHistoryChart && typeof window.testHistoryChart.destroy === 'function') {
        try {
            window.testHistoryChart.destroy();
        } catch (error) {
            console.warn('Error destroying existing chart:', error);
        }
    }
    
    const ctx = chartElement.getContext('2d');
    const labels = [];
    const scores = [];
    const recentTests = userEyeData.testHistory ? userEyeData.testHistory.slice(-7).reverse() : [];
    
    recentTests.forEach(test => {
        const date = test.date instanceof Date ? test.date : new Date(test.date);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        
        if (test.testType === 'visual-acuity') {
            // Convert line number to percentage (line 8 = 100%, line 0 = 0%)
            const percentage = Math.round((test.overallScore / 8) * 100);
            scores.push(percentage);
        } else {
            scores.push(80);
        }
    });
    
    if (recentTests.length === 0) {
        labels.push('No tests yet');
        scores.push(0);
    }
    
    try {
        window.testHistoryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Vision Score',
                    data: scores,
                    fill: false,
                    borderColor: '#6366F1',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Score: ${Math.round(context.raw)}%`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error creating chart:', error);
    }
}

// Update recent tests list
function updateRecentTests() {
    const recentTestsContainer = document.getElementById('recentTests');
    if (!recentTestsContainer) return;
    
    if (!userEyeData.testHistory || userEyeData.testHistory.length === 0) {
        recentTestsContainer.innerHTML = '<div class="text-center py-4 text-gray-500">No tests completed yet</div>';
        return;
    }
    
    const recentTests = userEyeData.testHistory.slice(-3).reverse();
    let html = '';
    
    recentTests.forEach(test => {
        const date = test.date instanceof Date ? test.date : new Date(test.date);
        const dateStr = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        let testName = '';
        let testColor = '';
        let score = '';
        
        switch(test.testType) {
            case 'visual-acuity': 
                testName = 'Visual Acuity Test'; 
                testColor = 'indigo'; 
                score = test.result || `${test.overallScore}/8`;
                break;
            case 'color-vision': testName = 'Color Vision Test'; testColor = 'green'; break;
            case 'contrast': testName = 'Contrast Sensitivity'; testColor = 'blue'; break;
            case 'astigmatism': testName = 'Astigmatism Test'; testColor = 'purple'; break;
            case 'near-vision': testName = 'Near Vision Test'; testColor = 'yellow'; break;
            default: testName = 'Eye Test'; testColor = 'gray';
        }
        
        html += `
            <div class="border-b border-gray-200 pb-4">
                <div class="flex justify-between items-center mb-1">
                    <h4 class="font-medium text-gray-800">${testName}</h4>
                    <span class="text-sm text-${testColor}-600">${score}</span>
                </div>
                <p class="text-sm text-gray-500">Completed: ${dateStr}</p>
            </div>
        `;
    });
    
    recentTestsContainer.innerHTML = html;
}

// Update badges display
function updateBadges() {
    console.log('Updating badges with data:', userEyeData);
    const badgeCount = userEyeData.badges ? userEyeData.badges.length : 0;
    const badgeCountElement = document.getElementById('badgeCount');
    if (badgeCountElement) {
        badgeCountElement.textContent = `${badgeCount}/12`;
    }
    
    document.querySelectorAll('.badge-item').forEach(badge => {
        const badgeId = badge.getAttribute('data-badge');
        const badgeIcon = badge.querySelector('.w-16');
        
        console.log(`Checking badge ${badgeId}:`, userEyeData.badges && userEyeData.badges.includes(badgeId));
        
        if (badgeIcon && userEyeData.badges && userEyeData.badges.includes(badgeId)) {
            badgeIcon.classList.remove('badge-locked');
            badgeIcon.classList.add('badge-unlocked');
        } else if (badgeIcon) {
            badgeIcon.classList.add('badge-locked');
            badgeIcon.classList.remove('badge-unlocked');
        }
    });
}

// Update streak display
function updateStreak() {
    const currentStreakElement = document.getElementById('currentStreak');
    if (currentStreakElement) {
        currentStreakElement.textContent = `${userEyeData.streak || 0} Days`;
    }
    
    const streakIndicators = document.querySelectorAll('.bg-indigo-50 .rounded-full');
    streakIndicators.forEach((indicator, index) => {
        if (index < (userEyeData.streak || 0)) {
            indicator.classList.remove('bg-gray-200');
            indicator.classList.add('bg-indigo-600');
        } else {
            indicator.classList.add('bg-gray-200');
            indicator.classList.remove('bg-indigo-600');
        }
    });
}

// Update next test recommendation
function updateNextTestRecommendation() {
    const container = document.getElementById('nextTestRecommendation');
    if (!container) return;
    
    if (!userEyeData.testHistory || userEyeData.testHistory.length === 0) {
        container.innerHTML = `
            <div class="mr-3 bg-green-100 p-2 rounded-lg">
                <i class="fas fa-eye text-green-600"></i>
            </div>
            <div>
                <p class="font-medium text-green-800">Visual Acuity Test</p>
                <p class="text-sm text-green-600">Last completed: Never</p>
            </div>
        `;
        return;
    }
    
    const testTypes = ['visual-acuity', 'color-vision', 'contrast', 'astigmatism', 'near-vision'];
    let oldestTest = null;
    let oldestDate = new Date();
    
    testTypes.forEach(type => {
        const test = userEyeData.testHistory
            .filter(t => t.testType === type)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            
        if (!test || new Date(test.date) < oldestDate) {
            oldestTest = type;
            oldestDate = test ? new Date(test.date) : new Date(0);
        }
    });
    
    let testName = '';
    let testIcon = '';
    
    switch(oldestTest) {
        case 'visual-acuity': testName = 'Visual Acuity Test'; testIcon = 'eye'; break;
        case 'color-vision': testName = 'Color Vision Test'; testIcon = 'palette'; break;
        case 'contrast': testName = 'Contrast Sensitivity'; testIcon = 'adjust'; break;
        case 'astigmatism': testName = 'Astigmatism Test'; testIcon = 'asterisk'; break;
        case 'near-vision': testName = 'Near Vision Test'; testIcon = 'book-open'; break;
        default: testName = 'Visual Acuity Test'; testIcon = 'eye';
    }
    
    const lastCompleted = oldestDate.getTime() === 0 ? 
        'Never' : 
        oldestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    container.innerHTML = `
        <div class="mr-3 bg-green-100 p-2 rounded-lg">
            <i class="fas fa-${testIcon} text-green-600"></i>
        </div>
        <div>
            <p class="font-medium text-green-800">${testName}</p>
            <p class="text-sm text-green-600">Last completed: ${lastCompleted}</p>
        </div>
    `;
}

// Test modal functionality
let currentTest = null;
let currentSnellenRows = [];

function startTest(testType) {
    console.log('startTest called with:', testType);
    currentTest = testType;
    currentRow = 0;
    currentEye = 'right';
    testResults = {
        right: { smallestLine: 0, correctAnswers: [] },
        left: { smallestLine: 0, correctAnswers: [] }
    };
    
    // Generate new random Snellen chart for each test
    currentSnellenRows = generateRandomSnellenChart();
    
    const modalTitle = document.getElementById('testModalTitle');
    if (modalTitle) {
        switch(testType) {
            case 'visual-acuity': 
                modalTitle.textContent = 'Visual Acuity Test'; 
                setupVisualAcuityTest();
                break;
            case 'color-vision': 
                modalTitle.textContent = 'Color Vision Test';
                showInDevelopment();
                break;
            case 'contrast': 
                modalTitle.textContent = 'Contrast Sensitivity Test';
                showInDevelopment();
                break;
            case 'astigmatism': 
                modalTitle.textContent = 'Astigmatism Test';
                showInDevelopment();
                break;
            case 'near-vision': 
                modalTitle.textContent = 'Near Vision Test';
                showInDevelopment();
                break;
            case 'complete': 
                modalTitle.textContent = 'Complete Eye Exam';
                showInDevelopment();
                break;
        }
    }
    
    const calibrationStep = document.getElementById('calibrationStep');
    const testContent = document.getElementById('testContent');
    const testModal = document.getElementById('testModal');
    
    // Check if mobile device and skip calibration
    if (window.innerWidth <= 768) {
        if (calibrationStep) calibrationStep.classList.add('hidden');
        if (testContent) testContent.classList.remove('hidden');
        proceedToTest();
    } else {
        if (calibrationStep) calibrationStep.classList.remove('hidden');
        if (testContent) testContent.classList.add('hidden');
    }
    
    if (testModal) testModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function proceedToTest() {
    const calibrationStep = document.getElementById('calibrationStep');
    const testContent = document.getElementById('testContent');
    const loading = document.getElementById('loading');
    
    if (calibrationStep) calibrationStep.classList.add('hidden');
    if (testContent) testContent.classList.remove('hidden');
    if (loading) loading.classList.remove('hidden');
    
    setTimeout(() => {
        if (loading) loading.classList.add('hidden');
        const visualAcuityContent = document.getElementById('visual-acuity-content');
        if (visualAcuityContent) {
            visualAcuityContent.classList.remove('hidden');
            const currentEyeElement = document.getElementById('currentEye');
            if (currentEyeElement) currentEyeElement.textContent = 'Right';
            startEyeTest();
        }
    }, 1000);
}

function showInDevelopment() {
    const calibrationStep = document.getElementById('calibrationStep');
    const testContent = document.getElementById('testContent');
    const loading = document.getElementById('loading');
    
    if (calibrationStep) calibrationStep.classList.add('hidden');
    if (testContent) testContent.classList.remove('hidden');
    if (loading) loading.classList.add('hidden');
    
    const content = `
        <div class="text-center p-8">
            <div class="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <i class="fas fa-tools text-yellow-600 text-3xl"></i>
            </div>
            <h3 class="text-2xl font-bold text-gray-800 mb-2">Test In Development</h3>
            <p class="text-gray-600 mb-6">This test is currently under development and will be available soon.</p>
            <button id="closeInDevTest" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition duration-300">
                Return to Tests
            </button>
        </div>
    `;
    
    if (testContent) testContent.innerHTML = content;
    
    // Add event listener for the close button
    setTimeout(() => {
        const closeBtn = document.getElementById('closeInDevTest');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                closeTestModal();
            });
        }
    }, 100);
}

function setupVisualAcuityTest() {
    const testContent = document.getElementById('testContent');
    if (!testContent) return;
    
    testContent.innerHTML = `
        <div class="text-center" id="loading">
            <div class="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
            <p class="mt-4 text-gray-600">Loading test...</p>
        </div>
        
        <div id="visual-acuity-content" class="hidden">
            <div id="testInstructions" class="mb-6">
                <h3 class="text-xl font-bold text-gray-800 mb-2">Test Instructions</h3>
                <p class="text-gray-700 mb-4">
                    Cover one eye and read the letters from the top down. You'll have 20 seconds per line.
                    Type the letters you see in the input box (no spaces needed) and click Submit or press Enter.
                </p>
                <div class="bg-blue-50 p-4 rounded-lg">
                    <p class="text-blue-800"><strong>Current Eye:</strong> <span id="currentEye">Right</span></p>
                    <p class="text-blue-800"><strong>Time Remaining:</strong> <span id="timeRemaining">20</span> seconds</p>
                </div>
            </div>
            
            <div class="flex justify-center mb-8">
                <div class="snellen-chart bg-white p-8 rounded-lg shadow-md">
                    <div id="snellenRows"></div>
                </div>
            </div>
            
            <div id="currentRowInput" class="mb-6 hidden">
                <label for="userInput" class="block text-gray-700 mb-2">Type the letters you see:</label>
                <input type="text" id="userInput" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 uppercase" maxlength="10">
                <button id="submitRow" class="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition duration-300">
                    Submit
                </button>
            </div>
            
            <div class="flex justify-between">
                <button id="cancelTest" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg transition duration-300">
                    Cancel Test
                </button>
                <button id="nextEye" class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg transition duration-300 hidden">
                    Test Left Eye
                </button>
            </div>
        </div>
        
        <div id="testResults" class="hidden">
            <div class="text-center mb-8">
                <div class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-check text-green-600 text-3xl"></i>
                </div>
                <h3 class="text-2xl font-bold text-gray-800 mb-2">Test Completed!</h3>
                <p class="text-gray-600" id="resultsMessage">Your visual acuity results have been recorded.</p>
            </div>
            
            <div class="bg-gray-50 p-6 rounded-lg mb-6">
                <h4 class="font-bold text-gray-800 mb-3">Your Results:</h4>
                <div class="space-y-3">
                    <div class="flex justify-between">
                        <span class="text-gray-600">Visual Acuity:</span>
                        <span class="font-medium" id="acuityResult">20/20</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Right Eye Score:</span>
                        <span class="font-medium" id="rightEyeResult">0/6</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Left Eye Score:</span>
                        <span class="font-medium" id="leftEyeResult">0/6</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Overall Score:</span>
                        <span class="font-medium" id="overallScoreResult">0/6</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-gray-600">Test Date:</span>
                        <span class="font-medium" id="testDateResult">Today</span>
                    </div>
                </div>
            </div>
            
            <div class="bg-blue-50 p-6 rounded-lg mb-6">
                <h4 class="font-bold text-gray-800 mb-3">Recommendations:</h4>
                <p class="text-gray-700" id="testRecommendation">
                    Your vision appears to be in the normal range. Consider repeating this test every 3-6 months to monitor any changes.
                </p>
            </div>
            
            <div class="flex justify-between">
                <button id="viewDashboard" class="bg-gray-300 hover:bg-gray-400 text-gray-800 px-6 py-3 rounded-lg transition duration-300">
                    View Dashboard
                </button>
                <button id="shareResults" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg transition duration-300">
                    Share Results
                </button>
            </div>
        </div>
    `;
    
    // Set up event listeners for visual acuity test after a short delay
    setTimeout(() => {
        const submitRowBtn = document.getElementById('submitRow');
        if (submitRowBtn) {
            submitRowBtn.addEventListener('click', function(e) {
                e.preventDefault();
                processRowSubmission();
            });
        }
        
        const nextEyeBtn = document.getElementById('nextEye');
        if (nextEyeBtn) {
            nextEyeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                startEyeTest();
            });
        }
        
        const cancelTestBtn = document.getElementById('cancelTest');
        if (cancelTestBtn) {
            cancelTestBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeTestModal();
            });
        }
        
        const userInputField = document.getElementById('userInput');
        if (userInputField) {
            userInputField.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    processRowSubmission();
                }
            });
        }

        // View Dashboard button
        const viewDashboardBtn = document.getElementById('viewDashboard');
        if (viewDashboardBtn) {
            viewDashboardBtn.addEventListener('click', function(e) {
                e.preventDefault();
                closeTestModal();
                const dashboardSection = document.getElementById('dashboard');
                if (dashboardSection) {
                    dashboardSection.scrollIntoView({ behavior: 'smooth' });
                }
            });
        }

        // Share Results button
        const shareResultsBtn = document.getElementById('shareResults');
        if (shareResultsBtn) {
            shareResultsBtn.addEventListener('click', function(e) {
                e.preventDefault();
                alert('Results sharing feature will be implemented soon!');
            });
        }
    }, 100);
}

function closeTestModal() {
    const testModal = document.getElementById('testModal');
    if (testModal) testModal.classList.add('hidden');
    
    document.body.style.overflow = 'auto';
    resetTest();
}

function resetTest() {
    currentTest = null;
    clearInterval(testTimer);
}

// Visual acuity test functions
function startEyeTest() {
    const snellenContainer = document.getElementById('snellenRows');
    if (!snellenContainer) return;
    
    snellenContainer.innerHTML = '';
    
    currentSnellenRows.forEach((row, index) => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `snellen-row-${index+1} mb-4 ${index > 0 ? 'hidden' : ''}`;
        rowDiv.id = `row-${index}`;
        rowDiv.style.fontSize = `${row.size}px`;
        rowDiv.style.fontFamily = 'monospace';
        rowDiv.style.letterSpacing = '0.2em';
        rowDiv.textContent = row.letters;
        snellenContainer.appendChild(rowDiv);
    });
    
    currentRow = 0;
    showCurrentRow();
}

function showCurrentRow() {
    document.querySelectorAll('[id^="row-"]').forEach(row => {
        row.classList.add('hidden');
    });
    
    const currentRowElement = document.getElementById(`row-${currentRow}`);
    const currentRowInput = document.getElementById('currentRowInput');
    const userInput = document.getElementById('userInput');
    const timeRemainingElement = document.getElementById('timeRemaining');
    
    if (currentRowElement) currentRowElement.classList.remove('hidden');
    if (currentRowInput) currentRowInput.classList.remove('hidden');
    if (userInput) {
        userInput.value = '';
        userInput.focus();
    }
    
    let timeLeft = 20;
    if (timeRemainingElement) timeRemainingElement.textContent = timeLeft;
    
    clearInterval(testTimer);
    testTimer = setInterval(() => {
        timeLeft--;
        if (timeRemainingElement) timeRemainingElement.textContent = timeLeft;
        
        if (timeLeft <= 0) {
            clearInterval(testTimer);
            processRowSubmission();
        }
    }, 1000);
}

function processRowSubmission() {
    clearInterval(testTimer);
    
    const userAnswer = document.getElementById('userInput').value.toUpperCase().replace(/\s/g, '');
    const correctAnswer = currentSnellenRows[currentRow].correct;
    
    testResults[currentEye].correctAnswers.push({
        row: currentRow,
        userAnswer: userAnswer,
        isCorrect: userAnswer === correctAnswer,
        correctAnswer: correctAnswer
    });
    
    if (currentRow < currentSnellenRows.length - 1) {
        currentRow++;
        showCurrentRow();
    } else {
        finishEyeTest();
    }
}

function finishEyeTest() {
    const correctRows = testResults[currentEye].correctAnswers
        .filter(answer => answer.isCorrect)
        .map(answer => answer.row);
    
    testResults[currentEye].smallestLine = correctRows.length > 0 ? 
        Math.max(...correctRows) + 1 : 0;
    
    if (currentEye === 'right') {
        currentEye = 'left';
        document.getElementById('currentEye').textContent = 'Left';
        document.getElementById('nextEye').classList.remove('hidden');
        document.getElementById('currentRowInput').classList.add('hidden');
    } else {
        completeVisualAcuityTest();
    }
}

function completeVisualAcuityTest() {
    const rightScore = testResults.right.smallestLine;
    const leftScore = testResults.left.smallestLine;
    const overallScore = Math.max(rightScore, leftScore);
    
    const acuityScores = {
        '0': '20/200 or worse',
        '1': '20/200',
        '2': '20/100',
        '3': '20/70',
        '4': '20/50',
        '5': '20/40',
        '6': '20/30',
        '7': '20/25',
        '8': '20/20'
    };
    
    const acuityResult = acuityScores[overallScore] || '20/200 or worse';
    
    document.getElementById('visual-acuity-content').classList.add('hidden');
    document.getElementById('testResults').classList.remove('hidden');
    
    document.getElementById('acuityResult').textContent = acuityResult;
    document.getElementById('rightEyeResult').textContent = `${rightScore}/6`;
    document.getElementById('leftEyeResult').textContent = `${leftScore}/6`;
    document.getElementById('overallScoreResult').textContent = `${overallScore}/6`;
    document.getElementById('testDateResult').textContent = new Date().toLocaleDateString();
    
    let recommendation = '';
    if (overallScore >= 5) {
        recommendation = 'Excellent! Your vision appears to be in the normal range. Continue to monitor your eye health regularly.';
    } else if (overallScore >= 3) {
        recommendation = 'Your vision may be below average. Consider scheduling an appointment with an eye care professional for a comprehensive exam.';
    } else {
        recommendation = 'Your results suggest significant vision impairment. Please consult an eye care professional as soon as possible for proper diagnosis and treatment.';
    }
    document.getElementById('testRecommendation').textContent = recommendation;
    
    saveTestResults(currentTest, {
        rightEye: testResults.right,
        leftEye: testResults.left,
        overallScore: overallScore,
        result: acuityResult,
        date: new Date(),
        detailedResults: testResults,
        rightEyeScore: rightScore,
        leftEyeScore: leftScore
    });
}

// Save test results to Firestore with improved gamification
function saveTestResults(testType, results) {
    const testRecord = {
        testType: testType,
        ...results,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    const newTestHistory = userEyeData.testHistory ? [...userEyeData.testHistory, testRecord] : [testRecord];
    const newBadges = userEyeData.badges ? [...userEyeData.badges] : [];
    const newTotalTests = (userEyeData.totalTests || 0) + 1;
    const newBestScore = Math.max(userEyeData.bestScore || 0, results.overallScore);
    
    // Enhanced badge logic
    if (!newBadges.includes('first_test')) newBadges.push('first_test');
    if (newTotalTests >= 3 && !newBadges.includes('three_tests')) newBadges.push('three_tests');
    if (newTotalTests >= 5 && !newBadges.includes('five_tests')) newBadges.push('five_tests');
    if (results.overallScore >= 6 && !newBadges.includes('excellent_vision')) newBadges.push('excellent_vision');
    if (results.overallScore >= 4 && !newBadges.includes('good_vision')) newBadges.push('good_vision');
    if (results.rightEyeScore === results.leftEyeScore && 
        results.rightEyeScore > 0 && 
        !newBadges.includes('balanced_vision')) newBadges.push('balanced_vision');
    if (results.rightEyeScore >= 5 && results.leftEyeScore >= 5 && 
        !newBadges.includes('perfect_both_eyes')) newBadges.push('perfect_both_eyes');
    
    console.log('Badge calculation:', {
        newTotalTests,
        overallScore: results.overallScore,
        rightEyeScore: results.rightEyeScore,
        leftEyeScore: results.leftEyeScore,
        newBadges
    });
    
    // Streak calculation with improved logic
    let newStreak = userEyeData.streak || 0;
    const now = new Date();
    const lastTestDate = userEyeData.lastTest || null;
    
    if (!lastTestDate) {
        newStreak = 1;
    } else {
        const lastDate = lastTestDate instanceof Date ? lastTestDate : new Date(lastTestDate);
        const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Same day test - maintain streak
            newStreak = userEyeData.streak || 0;
        } else if (diffDays === 1) {
            // Consecutive day - increase streak
            newStreak = (userEyeData.streak || 0) + 1;
        } else if (diffDays > 1) {
            // Gap in testing - reset streak
            newStreak = 1;
        }
    }
    
    // Streak-based badges
    if (newStreak >= 7 && !newBadges.includes('week_streak')) newBadges.push('week_streak');
    if (newStreak >= 30 && !newBadges.includes('month_streak')) newBadges.push('month_streak');
    if (newStreak >= 100 && !newBadges.includes('century_streak')) newBadges.push('century_streak');
    
    // Performance-based badges
    if (results.overallScore >= 6 && newTotalTests >= 3 && !newBadges.includes('consistent_excellence')) {
        newBadges.push('consistent_excellence');
    }
    
    // Update Firestore
    db.collection('eye').doc(currentUser.uid).set({
        testHistory: newTestHistory,
        badges: newBadges,
        lastTest: firebase.firestore.FieldValue.serverTimestamp(),
        streak: newStreak,
        totalTests: newTotalTests,
        bestScore: newBestScore
    }, { merge: true })
    .then(() => {
        // Update local data with the new values
        userEyeData.testHistory = newTestHistory;
        userEyeData.badges = newBadges;
        userEyeData.streak = newStreak;
        userEyeData.totalTests = newTotalTests;
        userEyeData.bestScore = newBestScore;
        userEyeData.lastTest = new Date(); // Use current date for local update
        
        // Update dashboard
        updateDashboard();
        
        // Show achievement notification if new badges were earned
        const previousBadgeCount = userEyeData.badges ? userEyeData.badges.length : 0;
        const newBadgesEarned = newBadges.length - previousBadgeCount;
        if (newBadgesEarned > 0) {
            showAchievementNotification(newBadgesEarned);
        }
    })
    .catch(error => {
        console.error("Error saving test results:", error);
        // Show error notification to user
        alert("Error saving test results. Please try again.");
    });
}

// Show achievement notification
function showAchievementNotification(badgeCount) {
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-trophy mr-3 text-xl"></i>
            <div>
                <h4 class="font-bold">Achievement Unlocked!</h4>
                <p>You've earned ${badgeCount} new badge${badgeCount > 1 ? 's' : ''}!</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
}