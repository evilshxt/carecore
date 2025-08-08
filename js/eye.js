// eye.js - Enhanced with localStorage for demo purposes

// Initialize Firebase (configuration comes from keys.js)
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
    // Initialize AOS animation library
    AOS.init({
        duration: 800,
        easing: 'ease-in-out',
        once: true
    });

    // Check auth state
    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            initializeApp();
        } else {
            // Redirect to login if not authenticated
            window.location.href = 'login.html';
        }
    });

    // Mobile menu toggle
    document.getElementById('mobileMenuButton')?.addEventListener('click', function() {
        const mobileMenu = document.getElementById('mobileMenu');
        mobileMenu.classList.toggle('hidden');
    });

    // FAQ toggle functionality
    document.querySelectorAll('.faq-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const faqItem = button.closest('.bg-white');
            const content = faqItem.querySelector('.faq-content');
            const icon = button.querySelector('i');
            
            content.classList.toggle('hidden');
            icon.classList.toggle('transform');
            icon.classList.toggle('rotate-180');
        });
    });

    // Close modal buttons
    document.getElementById('closeTestModal')?.addEventListener('click', closeTestModal);
    document.getElementById('cancelTest')?.addEventListener('click', closeTestModal);
});

function initializeApp() {
    console.log('Initializing eye app for user:', currentUser.uid);
    loadUserEyeData();
    setupTestButtons();
}

function setupTestButtons() {
    // Test type buttons
    document.querySelectorAll('[data-test-type]').forEach(button => {
        button.addEventListener('click', function() {
            const testType = this.getAttribute('data-test-type');
            startTest(testType);
        });
    });
}

// Load user eye data from localStorage
function loadUserEyeData() {
    console.log('Loading user eye data for:', currentUser.uid);
    
    const storageKey = `eyeData_${currentUser.uid}`;
    const storedData = localStorage.getItem(storageKey);
    
    if (storedData) {
        try {
            userEyeData = JSON.parse(storedData);
            console.log('Loaded existing eye data:', userEyeData);
            
            // Convert date strings back to Date objects
            if (userEyeData.testHistory) {
                userEyeData.testHistory = userEyeData.testHistory.map(test => ({
                    ...test,
                    date: new Date(test.date),
                    timestamp: new Date(test.timestamp || test.date)
                }));
            }
            if (userEyeData.lastTest) {
                userEyeData.lastTest = new Date(userEyeData.lastTest);
            }
        } catch (error) {
            console.error('Error parsing stored eye data:', error);
            userEyeData = getDefaultEyeData();
        }
    } else {
        console.log('No existing eye data found, creating new data');
        userEyeData = getDefaultEyeData();
        saveEyeDataToStorage();
    }
    
    updateDashboard();
}

function getDefaultEyeData() {
    return {
        testHistory: [],
        badges: [],
        lastTest: null,
        streak: 0,
        totalTests: 0,
        bestScore: 0
    };
}

function saveEyeDataToStorage() {
    const storageKey = `eyeData_${currentUser.uid}`;
    localStorage.setItem(storageKey, JSON.stringify(userEyeData));
    console.log('Saved eye data to localStorage:', userEyeData);
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
            case 'color-vision': 
                testName = 'Color Vision Test'; 
                testColor = 'purple'; 
                score = `${test.score || 0}%`;
                break;
            case 'contrast': 
                testName = 'Contrast Sensitivity'; 
                testColor = 'blue'; 
                score = `${test.score || 0}%`;
                break;
            case 'astigmatism': 
                testName = 'Astigmatism Test'; 
                testColor = 'green'; 
                score = test.result || 'Normal';
                break;
            case 'near-vision': 
                testName = 'Near Vision Test'; 
                testColor = 'yellow'; 
                score = `${test.score || 0}%`;
                break;
            default: 
                testName = 'Eye Test'; 
                testColor = 'gray'; 
                score = 'Completed';
        }
        
        html += `
            <div class="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm">
                <div class="flex items-center">
                    <div class="w-3 h-3 bg-${testColor}-500 rounded-full mr-3"></div>
                    <div>
                        <p class="font-medium text-gray-800">${testName}</p>
                        <p class="text-sm text-gray-500">${dateStr}</p>
                    </div>
                </div>
                <span class="text-sm font-semibold text-${testColor}-600">${score}</span>
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

function startTest(testType) {
    currentTest = testType;
    
    const modal = document.getElementById('testModal');
    const modalTitle = document.getElementById('testModalTitle');
    const modalContent = document.getElementById('testModalContent');
    
    if (!modal || !modalTitle || !modalContent) return;
    
    // Set modal title
    switch(testType) {
        case 'visual-acuity': modalTitle.textContent = 'Visual Acuity Test'; break;
        case 'color-vision': modalTitle.textContent = 'Color Vision Test'; break;
        case 'contrast': modalTitle.textContent = 'Contrast Sensitivity Test'; break;
        case 'astigmatism': modalTitle.textContent = 'Astigmatism Test'; break;
        case 'near-vision': modalTitle.textContent = 'Near Vision Test'; break;
        default: modalTitle.textContent = 'Eye Test';
    }
    
    // Show appropriate content
    modalContent.innerHTML = `
        <div class="text-center py-8">
            <div class="mb-6">
                <i class="fas fa-eye text-4xl text-indigo-600 mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">${modalTitle.textContent}</h3>
                <p class="text-gray-600">This test will help assess your vision health.</p>
            </div>
            <div class="space-y-4">
                <button onclick="proceedToTest()" class="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition duration-300">
                    Start Test
                </button>
                <button onclick="closeTestModal()" class="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 transition duration-300">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    modal.classList.remove('hidden');
}

function proceedToTest() {
    switch(currentTest) {
        case 'visual-acuity':
            setupVisualAcuityTest();
            break;
        case 'color-vision':
        case 'contrast':
        case 'astigmatism':
        case 'near-vision':
            showInDevelopment();
            break;
        default:
            showInDevelopment();
    }
}

function showInDevelopment() {
    const modalContent = document.getElementById('testModalContent');
    if (modalContent) {
        modalContent.innerHTML = `
            <div class="text-center py-8">
                <div class="mb-6">
                    <i class="fas fa-tools text-4xl text-yellow-600 mb-4"></i>
                    <h3 class="text-xl font-semibold text-gray-800 mb-2">Coming Soon!</h3>
                    <p class="text-gray-600">This test is currently under development. Check back soon!</p>
                </div>
                <button onclick="closeTestModal()" class="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition duration-300">
                    Close
                </button>
            </div>
        `;
    }
}

function setupVisualAcuityTest() {
    const modalContent = document.getElementById('testModalContent');
    if (!modalContent) return;
    
    modalContent.innerHTML = `
        <div class="text-center py-6">
            <div class="mb-6">
                <h3 class="text-lg font-semibold text-gray-800 mb-4">Visual Acuity Test</h3>
                <div class="bg-gray-100 p-4 rounded-lg mb-4">
                    <p class="text-sm text-gray-600 mb-2">Instructions:</p>
                    <ul class="text-sm text-gray-600 text-left space-y-1">
                        <li>• Sit 10 feet (3 meters) from your screen</li>
                        <li>• Cover one eye at a time</li>
                        <li>• Read the letters from largest to smallest</li>
                        <li>• Type what you see in the input field</li>
                    </ul>
                </div>
                <div class="flex justify-center space-x-4 mb-4">
                    <button onclick="startEyeTest()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-300">
                        Start Test
                    </button>
                    <button onclick="closeTestModal()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-300">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    `;
}

function closeTestModal() {
    const modal = document.getElementById('testModal');
    if (modal) {
        modal.classList.add('hidden');
    }
    resetTest();
}

function resetTest() {
    testResults = {
        right: { smallestLine: 0, correctAnswers: [] },
        left: { smallestLine: 0, correctAnswers: [] }
    };
    currentRow = 0;
    currentEye = 'right';
    clearInterval(testTimer);
}

function startEyeTest() {
    const modalContent = document.getElementById('testModalContent');
    if (!modalContent) return;
    
    // Generate random Snellen chart
    currentSnellenRows = generateRandomSnellenChart();
    
    modalContent.innerHTML = `
        <div class="text-center py-4">
            <div class="mb-4">
                <h3 class="text-lg font-semibold text-gray-800 mb-2">Testing ${currentEye === 'right' ? 'Right' : 'Left'} Eye</h3>
                <p class="text-sm text-gray-600">Row ${currentRow + 1} of ${currentSnellenRows.length}</p>
            </div>
            
            <div class="snellen-chart mb-6">
                <div style="font-size: ${currentSnellenRows[currentRow].size}px; font-weight: bold; color: black; margin: 10px 0;">
                    ${currentSnellenRows[currentRow].letters}
                </div>
            </div>
            
            <div class="mb-4">
                <input type="text" id="userInput" placeholder="Type what you see..." 
                       class="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                       style="letter-spacing: 0.5em; text-align: center;">
            </div>
            
            <div class="flex justify-center space-x-4">
                <button id="submitRow" onclick="processRowSubmission()" class="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition duration-300">
                    Submit
                </button>
                <button onclick="closeTestModal()" class="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-400 transition duration-300">
                    Cancel
                </button>
            </div>
        </div>
    `;
    
    // Focus on input and add enter key listener
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.focus();
        userInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                processRowSubmission();
            }
        });
    }
    
    showCurrentRow();
}

function showCurrentRow() {
    const userInput = document.getElementById('userInput');
    if (userInput) {
        userInput.value = '';
        userInput.focus();
    }
}

function processRowSubmission() {
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
    if (currentEye === 'right') {
        // Switch to left eye
        currentEye = 'left';
        currentRow = 0;
        startEyeTest();
    } else {
        // Both eyes completed
        completeVisualAcuityTest();
    }
}

function completeVisualAcuityTest() {
    // Calculate scores for each eye
    const rightScore = testResults.right.correctAnswers.filter(answer => answer.isCorrect).length;
    const leftScore = testResults.left.correctAnswers.filter(answer => answer.isCorrect).length;
    const overallScore = Math.round((rightScore + leftScore) / 2);
    
    // Determine acuity result
    let acuityResult = '';
    if (overallScore >= 6) acuityResult = 'Excellent';
    else if (overallScore >= 4) acuityResult = 'Good';
    else if (overallScore >= 2) acuityResult = 'Fair';
    else acuityResult = 'Poor';
    
    // Generate recommendation
    let recommendation = '';
    if (overallScore >= 6) {
        recommendation = 'Your vision appears to be excellent. Continue with regular eye care.';
    } else if (overallScore >= 4) {
        recommendation = 'Your vision is good. Consider a professional eye exam for a complete assessment.';
    } else {
        recommendation = 'Your vision may need attention. Please consult an eye care professional.';
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

// Save test results to localStorage with improved gamification
function saveTestResults(testType, results) {
    console.log('Saving test results:', { testType, results });
    
    const testRecord = {
        testType: testType,
        ...results,
        timestamp: new Date()
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
    
    // Update local data
    userEyeData.testHistory = newTestHistory;
    userEyeData.badges = newBadges;
    userEyeData.streak = newStreak;
    userEyeData.totalTests = newTotalTests;
    userEyeData.bestScore = newBestScore;
    userEyeData.lastTest = new Date();
    
    // Save to localStorage
    saveEyeDataToStorage();
    
    // Update dashboard
    updateDashboard();
    
    // Show achievement notification if new badges were earned
    const previousBadgeCount = userEyeData.badges ? userEyeData.badges.length : 0;
    const newBadgesEarned = newBadges.length - previousBadgeCount;
    if (newBadgesEarned > 0) {
        showAchievementNotification(newBadgesEarned);
    }
    
    // Close modal and show results
    closeTestModal();
    
    // Show results notification
    const notification = document.createElement('div');
    notification.className = 'fixed top-4 left-4 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 transform transition-all duration-300';
    notification.innerHTML = `
        <div class="flex items-center">
            <i class="fas fa-check-circle mr-3 text-xl"></i>
            <div>
                <h4 class="font-bold">Test Completed!</h4>
                <p>Score: ${results.overallScore}/8 (${results.result})</p>
            </div>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Remove notification after 5 seconds
    setTimeout(() => {
        notification.style.transform = 'translateX(-100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
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