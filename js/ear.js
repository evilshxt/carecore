// ear.js - Enhanced with localStorage for demo purposes

// Initialize Firebase (configuration comes from keys.js)
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Global variables
let currentUser = null;
let userHearingData = null;
let currentTest = null;
let testState = {};
let speechSynthesis = window.speechSynthesis;
let testHistoryChartInstance = null;

// Test phrases and sentences
const testPhrases = [
    "The quick brown fox jumps over the lazy dog",
    "Pack my box with five dozen liquor jugs",
    "How vexingly quick daft zebras jump",
    "Bright vixens jump; dozy fowl quack",
    "Sphinx of black quartz, judge my vow",
    "Crazy Fredrick bought many very exquisite opal jewels",
    "We promptly judged antique ivory buckles for the next prize",
    "A quick movement of the enemy will jeopardize six gunboats",
    "Grumpy wizards make toxic brew for the evil queen and jack",
    "The five boxing wizards jump quickly"
];

const testWords = [
    "apple", "banana", "cherry", "dolphin", "elephant",
    "fountain", "giraffe", "hamburger", "island", "jungle",
    "kangaroo", "lighthouse", "mountain", "notebook", "octopus",
    "penguin", "quilt", "rainbow", "sunflower", "telescope",
    "umbrella", "volcano", "waterfall", "xylophone", "yacht", "zebra"
];

const testSentences = [
    "The apple fell from the tree onto the soft grass",
    "She packed a banana in her lunchbox for the hike",
    "We saw a dolphin jumping out of the ocean waves",
    "The elephant at the zoo was eating fresh hay",
    "Children were playing near the colorful fountain",
    "A giraffe can have a neck up to six feet long",
    "He ordered a hamburger with extra pickles and cheese",
    "Our vacation to the tropical island was wonderful",
    "The kangaroo carried its baby in a cozy pouch",
    "From the lighthouse, we could see ships in the distance"
];

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
    document.getElementById('mobileMenuButton').addEventListener('click', function() {
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

    // Play calibration sound
    document.getElementById('playCalibrationSound')?.addEventListener('click', function() {
        const soundWave = document.querySelector('#calibrationStep .sound-wave');
        soundWave?.classList.remove('hidden');
        speak("This is a test sound for volume calibration. Please adjust your volume to a comfortable level.", 0.7);
        setTimeout(() => soundWave?.classList.add('hidden'), 3000);
    });

    // Close modal buttons
    document.getElementById('closeTestModal')?.addEventListener('click', closeTestModal);
    document.getElementById('cancelTest')?.addEventListener('click', closeTestModal);

    // Start test button
    document.getElementById('startTestButton')?.addEventListener('click', function() {
        document.getElementById('calibrationStep')?.classList.add('hidden');
        document.getElementById('testContent')?.classList.remove('hidden');
        
        // Show loading initially
        document.getElementById('loading')?.classList.remove('hidden');
        
        // Hide all test content sections
        document.querySelectorAll('#testContent > div:not(#loading):not(#testResults)').forEach(el => {
            el.classList.add('hidden');
        });
        
        // After a short delay, hide loading and show appropriate test content
        setTimeout(() => {
            document.getElementById('loading')?.classList.add('hidden');
            
            // Initialize the appropriate test based on currentTest
            switch(currentTest) {
                case 'speech-recognition':
                    initSpeechRecognitionTest();
                    break;
                case 'multiple-choice':
                    initMultipleChoiceTest();
                    break;
                case 'volume-sensitivity':
                    initVolumeSensitivityTest();
                    break;
                case 'word-detection':
                    initWordDetectionTest();
                    break;
                case 'frequency-range':
                    // initFrequencyRangeTest();
                    break;
            }
        }, 1000);
    });

    // Submit test results button
    document.getElementById('submitTest')?.addEventListener('click', handleTestSubmission);

    // View dashboard button
    document.getElementById('viewDashboard')?.addEventListener('click', function() {
        closeTestModal();
        window.location.href = '#dashboard';
    });

    // Share results button
    document.getElementById('shareResults')?.addEventListener('click', function() {
        alert('In a complete implementation, this would share your results or generate a report.');
    });
});

// Initialize the app for authenticated users
function initializeApp() {
    // Show user profile
    document.getElementById('userProfileSection')?.classList.remove('hidden');
    document.getElementById('dashboardContent')?.classList.remove('hidden');
    document.getElementById('userDisplayName').textContent = currentUser.displayName || currentUser.email.split('@')[0];

    // Load user hearing data
    loadUserHearingData();
}

// Load user hearing data from localStorage
function loadUserHearingData() {
    console.log('Loading user hearing data from localStorage');
    
    // For demo purposes, use localStorage instead of Firestore
    const storedData = localStorage.getItem('hearingData');
    
    if (storedData) {
        try {
            userHearingData = JSON.parse(storedData);
            console.log('Loaded existing hearing data:', userHearingData);
            
            // Convert date strings back to Date objects
            if (userHearingData.testHistory) {
                userHearingData.testHistory = userHearingData.testHistory.map(test => ({
                    ...test,
                    date: new Date(test.date),
                    timestamp: new Date(test.timestamp || test.date)
                }));
            }
            if (userHearingData.lastTest) {
                userHearingData.lastTest = new Date(userHearingData.lastTest);
            }
        } catch (error) {
            console.error('Error parsing stored hearing data:', error);
            userHearingData = getDefaultHearingData();
        }
    } else {
        console.log('No existing hearing data found, creating new data');
        userHearingData = getDefaultHearingData();
        saveHearingDataToStorage();
    }
    
    updateDashboard();
}

// Get default hearing data structure
function getDefaultHearingData() {
    return {
        testHistory: [],
        badges: [],
        lastTest: null,
        streak: 0,
        totalTests: 0,
        bestScore: 0
    };
}

// Save hearing data to localStorage
function saveHearingDataToStorage() {
    try {
        localStorage.setItem('hearingData', JSON.stringify(userHearingData));
        console.log('Hearing data saved to localStorage:', userHearingData);
    } catch (error) {
        console.error('Error saving hearing data to localStorage:', error);
    }
}

// Update dashboard with user data
function updateDashboard() {
    // Update test history chart
    initTestHistoryChart();

    // Update recent tests list
    updateRecentTests();

    // Update badges
    updateBadges();

    // Update streak
    updateStreak();

    // Update next test recommendation
    updateNextTestRecommendation();
}

// Initialize test history chart
function initTestHistoryChart() {
    const ctx = document.getElementById('testHistoryChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart instance if it exists
    if (testHistoryChartInstance) {
        testHistoryChartInstance.destroy();
        testHistoryChartInstance = null;
    }
    
    // Prepare data for chart
    const labels = [];
    const scores = [];
    
    // Get last 7 tests or available tests
    const recentTests = userHearingData.testHistory.slice(-7).reverse();
    
    recentTests.forEach(test => {
        const date = test.date.toDate ? test.date.toDate() : new Date(test.date);
        labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        scores.push(test.score || 0);
    });
    
    // If no tests, show empty state
    if (recentTests.length === 0) {
        labels.push('No tests yet');
        scores.push(0);
    }
    
    // Create new chart instance
    testHistoryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Hearing Score',
                data: scores,
                fill: false,
                borderColor: '#6366F1',
                backgroundColor: '#6366F1',
                tension: 0.1,
                pointBackgroundColor: '#6366F1',
                pointBorderColor: '#6366F1'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Score: ${Math.round(context.raw)}/100`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
        }
    });
}

// Update recent tests list
function updateRecentTests() {
    const recentTestsContainer = document.getElementById('recentTests');
    if (!recentTestsContainer) return;
    
    if (userHearingData.testHistory.length === 0) {
        recentTestsContainer.innerHTML = `
            <div class="text-center py-4 text-gray-500">
                No tests completed yet
            </div>
        `;
        return;
    }
    
    // Show last 3 tests
    const recentTests = userHearingData.testHistory.slice(-3).reverse();
    let html = '';
    
    recentTests.forEach(test => {
        const dateObj = test.date && typeof test.date.toDate === 'function' ? test.date.toDate() : new Date(test.date);
        const dateStr = dateObj.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            year: 'numeric'
        });
        
        let testName = '';
        let testColor = '';
        
        switch(test.testType) {
            case 'speech-recognition':
                testName = 'Speech Recognition';
                testColor = 'indigo';
                break;
            case 'multiple-choice':
                testName = 'Multiple Choice';
                testColor = 'green';
                break;
            case 'volume-sensitivity':
                testName = 'Volume Sensitivity';
                testColor = 'blue';
                break;
            case 'word-detection':
                testName = 'Word Detection';
                testColor = 'purple';
                break;
            case 'frequency-range':
                testName = 'Frequency Range';
                testColor = 'yellow';
                break;
            default:
                testName = 'Hearing Test';
                testColor = 'gray';
        }
        
        html += `
            <div class="border-b border-gray-200 pb-4">
                <div class="flex justify-between items-center mb-1">
                    <h4 class="font-medium text-gray-800">${testName}</h4>
                    <span class="text-sm text-${testColor}-600">${test.score || 0}%</span>
                </div>
                <p class="text-sm text-gray-500">Completed: ${dateStr}</p>
            </div>
        `;
    });
    
    recentTestsContainer.innerHTML = html;
}

// Update badges display
function updateBadges() {
    const badgeCount = userHearingData.badges.length;
    const badgeCountElement = document.getElementById('badgeCount');
    if (badgeCountElement) {
        badgeCountElement.textContent = `${badgeCount}/12`;
    }
    
    // Update each badge state
    document.querySelectorAll('.badge-item').forEach(badge => {
        const badgeId = badge.getAttribute('data-badge');
        const badgeIcon = badge.querySelector('.w-16');
        
        if (userHearingData.badges.includes(badgeId)) {
            badgeIcon?.classList.remove('badge-locked');
            badgeIcon?.classList.add('badge-unlocked');
        } else {
            badgeIcon?.classList.add('badge-locked');
            badgeIcon?.classList.remove('badge-unlocked');
        }
    });
}

// Update streak display
function updateStreak() {
    const streakElement = document.getElementById('currentStreak');
    if (streakElement) {
        streakElement.textContent = `${userHearingData.streak} Days`;
    }
    
    // Update streak indicators (last 7 days)
    const streakIndicators = document.querySelectorAll('.bg-indigo-50 .rounded-full');
    streakIndicators.forEach((indicator, index) => {
        if (index < userHearingData.streak) {
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
    const recommendationContainer = document.getElementById('nextTestRecommendation');
    if (!recommendationContainer) return;
    
    if (userHearingData.testHistory.length === 0) {
        recommendationContainer.innerHTML = `
            <div class="mr-3 bg-green-100 p-2 rounded-lg">
                <i class="fas fa-keyboard text-green-600"></i>
            </div>
            <div>
                <p class="font-medium text-green-800">Speech Recognition Test</p>
                <p class="text-sm text-green-600">Last completed: Never</p>
            </div>
        `;
        return;
    }
    
    // Simple recommendation logic - suggest the test with the oldest last completion
    const testTypes = ['speech-recognition', 'multiple-choice', 'volume-sensitivity', 'word-detection', 'frequency-range'];
    let oldestTest = null;
    let oldestDate = new Date();
    
    testTypes.forEach(type => {
        const test = userHearingData.testHistory
            .filter(t => t.testType === type)
            .sort((a, b) => b.date - a.date)[0];
            
        if (!test || test.date.toDate() < oldestDate) {
            oldestTest = type;
            oldestDate = test ? test.date.toDate() : new Date(0);
        }
    });
    
    let testName = '';
    let testIcon = '';
    
    switch(oldestTest) {
        case 'speech-recognition':
            testName = 'Speech Recognition Test';
            testIcon = 'keyboard';
            break;
        case 'multiple-choice':
            testName = 'Multiple Choice Test';
            testIcon = 'list-ol';
            break;
        case 'volume-sensitivity':
            testName = 'Volume Sensitivity Test';
            testIcon = 'volume-down';
            break;
        case 'word-detection':
            testName = 'Word Detection Test';
            testIcon = 'search';
            break;
        case 'frequency-range':
            testName = 'Frequency Range Test';
            testIcon = 'wave-square';
            break;
        default:
            testName = 'Speech Recognition Test';
            testIcon = 'keyboard';
    }
    
    const lastCompleted = oldestDate.getTime() === 0 ? 
        'Never' : 
        oldestDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    recommendationContainer.innerHTML = `
        <div class="mr-3 bg-green-100 p-2 rounded-lg">
            <i class="fas fa-${testIcon} text-green-600"></i>
        </div>
        <div>
            <p class="font-medium text-green-800">${testName}</p>
            <p class="text-sm text-green-600">Last completed: ${lastCompleted}</p>
        </div>
    `;
}

// Speak text using Web Speech API
function speak(text, volume = 1) {
    try {
        // Cancel any ongoing speech
        speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.volume = volume;
        utterance.lang = 'en-US';
        
        // Show sound wave animation
        const soundWave = document.querySelector('.sound-wave:not(.hidden)');
        if (soundWave) {
            soundWave.classList.remove('hidden');
            utterance.onend = () => {
                soundWave.classList.add('hidden');
            };
        }
        
        speechSynthesis.speak(utterance);
    } catch (error) {
        console.error("Error with speech synthesis:", error);
        alert("Error playing audio. Please try again.");
    }
}

// Start a test
function startTest(testType) {
    currentTest = testType;
    testState = {
        currentStep: 0,
        score: 0,
        volumeLevel: 1.0,
        questions: [],
        answers: []
    };
    
    const modal = document.getElementById('testModal');
    const modalTitle = document.getElementById('testModalTitle');
    
    if (!modal || !modalTitle) return;
    
    // Set modal title based on test type
    switch(testType) {
        case 'speech-recognition':
            modalTitle.textContent = 'Speech Recognition Test';
            break;
        case 'multiple-choice':
            modalTitle.textContent = 'Multiple Choice Test';
            break;
        case 'volume-sensitivity':
            modalTitle.textContent = 'Volume Sensitivity Test';
            break;
        case 'word-detection':
            modalTitle.textContent = 'Word Detection Test';
            break;
        case 'frequency-range':
            modalTitle.textContent = 'Frequency Range Test';
            break;
        case 'complete':
            modalTitle.textContent = 'Complete Hearing Exam';
            break;
    }
    
    // Show calibration step and hide test content
    document.getElementById('calibrationStep')?.classList.remove('hidden');
    document.getElementById('testContent')?.classList.add('hidden');
    
    // Show modal
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

// Close modal
function closeTestModal() {
    document.getElementById('testModal')?.classList.add('hidden');
    document.body.style.overflow = 'auto';
    resetTest();
}

// Reset test state
function resetTest() {
    currentTest = null;
    testState = {};
    document.querySelectorAll('#testContent > div').forEach(el => {
        el.classList.add('hidden');
    });
}

// Initialize speech recognition test
function initSpeechRecognitionTest() {
    const content = document.getElementById('speech-recognition-content');
    if (!content) return;
    
    content.classList.remove('hidden');
    
    // Generate 5 random phrases for the test
    testState.questions = [];
    for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * testPhrases.length);
        testState.questions.push(testPhrases[randomIndex]);
    }
    
    // Start with first question
    testState.currentStep = 0;
    
    const playBtn = document.getElementById('playSpeech');
    if (playBtn) {
        playBtn.onclick = playCurrentPhrase;
    }
    
    document.getElementById('heardPhrase').value = '';
    playCurrentPhrase();
}

function playCurrentPhrase() {
    const currentPhrase = testState.questions[testState.currentStep];
    speak(currentPhrase);
}

// Initialize multiple choice test
function initMultipleChoiceTest() {
    const content = document.getElementById('multiple-choice-content');
    if (!content) return;
    
    content.classList.remove('hidden');
    
    // Generate 5 questions for the test
    testState.questions = [];
    for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * testPhrases.length);
        const correctAnswer = testPhrases[randomIndex];
        
        // Generate 2 wrong answers
        const wrongAnswers = [];
        while (wrongAnswers.length < 2) {
            const wrongIndex = Math.floor(Math.random() * testPhrases.length);
            if (wrongIndex !== randomIndex && !wrongAnswers.includes(testPhrases[wrongIndex])) {
                wrongAnswers.push(testPhrases[wrongIndex]);
            }
        }
        
        testState.questions.push({
            phrase: correctAnswer,
            options: shuffleArray([correctAnswer, ...wrongAnswers])
        });
    }
    
    // Start with first question
    testState.currentStep = 0;
    
    const playBtn = document.getElementById('playMultipleChoice');
    if (playBtn) {
        playBtn.onclick = playCurrentMultipleChoice;
    }
    
    showMultipleChoiceQuestion();
    playCurrentMultipleChoice();
}

function playCurrentMultipleChoice() {
    const currentQuestion = testState.questions[testState.currentStep];
    speak(currentQuestion.phrase);
}

function showMultipleChoiceQuestion() {
    const currentQuestion = testState.questions[testState.currentStep];
    const optionsContainer = document.getElementById('multipleChoiceOptions');
    if (!optionsContainer) return;
    
    optionsContainer.innerHTML = '';
    
    currentQuestion.options.forEach((option, index) => {
        const optionElement = document.createElement('div');
        optionElement.className = 'flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer';
        optionElement.innerHTML = `
            <input type="radio" name="multipleChoice" id="option${index}" value="${option}" class="mr-3">
            <label for="option${index}" class="cursor-pointer">${option}</label>
        `;
        optionsContainer.appendChild(optionElement);
    });
}

// Initialize volume sensitivity test
function initVolumeSensitivityTest() {
    const content = document.getElementById('volume-sensitivity-content');
    if (!content) return;
    
    content.classList.remove('hidden');
    
    // Generate test words
    testState.questions = [];
    testState.answers = []; // Initialize answers array
    for (let i = 0; i < 5; i++) { // Increased to 5 words for better testing
        const randomIndex = Math.floor(Math.random() * testWords.length);
        testState.questions.push(testWords[randomIndex]);
    }
    
    // Start with first word at full volume
    testState.currentStep = 0;
    testState.volumeLevel = 1.0;
    // Track the lowest volume at which the word was still heard
    testState.minHeardVolume = null;
    updateVolumeIndicator();
    
    const playBtn = document.getElementById('playVolumeTest');
    if (playBtn) {
        playBtn.onclick = playCurrentVolumeTest;
    }
    
    const heardBtn = document.getElementById('heardButton');
    if (heardBtn) {
        heardBtn.onclick = heardCurrentWord;
    }
    
    const notHeardBtn = document.getElementById('notHeardButton');
    if (notHeardBtn) {
        notHeardBtn.onclick = notHeardCurrentWord;
    }
    
    playCurrentVolumeTest();
}

function playCurrentVolumeTest() {
    const currentWord = testState.questions[testState.currentStep];
    speak(currentWord, testState.volumeLevel);
}

function heardCurrentWord() {
    // Record the minimal volume at which the current word is heard
    if (testState.minHeardVolume === null) {
        testState.minHeardVolume = testState.volumeLevel;
    } else {
        testState.minHeardVolume = Math.min(testState.minHeardVolume, testState.volumeLevel);
    }
    
    // Move to next volume level (decrease by 0.1 for finer control)
    testState.volumeLevel = Math.max(0.1, testState.volumeLevel - 0.1);
    updateVolumeIndicator();
    
    // Play the word again at new volume
    playCurrentVolumeTest();
}

function notHeardCurrentWord() {
    // Record the threshold volume for this word
    // Use the lowest volume at which the user could still hear the word
    // If they never heard it, use the current volume level as threshold
    const threshold = testState.minHeardVolume !== null ? testState.minHeardVolume : testState.volumeLevel;
    
    testState.answers.push({
        word: testState.questions[testState.currentStep],
        threshold: threshold
    });
    
    console.log(`Word "${testState.questions[testState.currentStep]}" threshold: ${threshold}`);
    
    // Move to next word or finish test
    testState.currentStep++;
    if (testState.currentStep < testState.questions.length) {
        testState.volumeLevel = 1.0;
        testState.minHeardVolume = null;
        updateVolumeIndicator();
        playCurrentVolumeTest();
    } else {
        finishVolumeSensitivityTest();
    }
}

function updateVolumeIndicator() {
    const volumeLevelElement = document.getElementById('currentVolumeLevel');
    const volumeIndicator = document.getElementById('volumeIndicator');
    
    if (volumeLevelElement) {
        volumeLevelElement.textContent = `${Math.round(testState.volumeLevel * 100)}%`;
    }
    
    if (volumeIndicator) {
        volumeIndicator.style.width = `${testState.volumeLevel * 100}%`;
    }
}

function finishVolumeSensitivityTest() {
    console.log('Volume sensitivity test answers:', testState.answers);
    
    // Calculate average threshold (lower is better for hearing sensitivity)
    const avgThreshold = testState.answers.reduce((sum, answer) => sum + answer.threshold, 0) / testState.answers.length;
    
    // Convert threshold to score (lower threshold = higher score)
    // Threshold of 0.1 = 100% score, Threshold of 1.0 = 0% score
    const score = Math.round((1 - avgThreshold) * 100);
    
    console.log('Volume sensitivity calculation:', {
        avgThreshold,
        score,
        answers: testState.answers
    });
    
    // Show results
    showTestResults('Volume Sensitivity Test', score, `
        Your average hearing threshold is ${Math.round(avgThreshold * 100)}% volume.
        ${score >= 80 ? 'Excellent hearing sensitivity!' : 
          score >= 60 ? 'Good hearing sensitivity.' : 
          score >= 40 ? 'Fair hearing sensitivity.' :
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results
    saveTestResults('volume-sensitivity', {
        score: score,
        threshold: avgThreshold,
        answers: testState.answers
    });
}

// Initialize word detection test
function initWordDetectionTest() {
    const content = document.getElementById('word-detection-content');
    if (!content) return;
    
    content.classList.remove('hidden');
    
    // Generate 5 questions
    testState.questions = [];
    for (let i = 0; i < 5; i++) {
        const randomSentenceIndex = Math.floor(Math.random() * testSentences.length);
        const sentence = testSentences[randomSentenceIndex];
        
        // Extract a target word (50% chance it's in the sentence)
        let targetWord, isPresent;
        if (Math.random() > 0.5) {
            // Pick a word that is in the sentence
            const words = sentence.split(' ').filter(word => word.length > 3);
            targetWord = words[Math.floor(Math.random() * words.length)].replace(/[^a-zA-Z]/g, '').toLowerCase();
            isPresent = true;
        } else {
            // Pick a random word that's not in the sentence
            do {
                targetWord = testWords[Math.floor(Math.random() * testWords.length)];
                isPresent = sentence.toLowerCase().includes(targetWord);
            } while (isPresent);
            isPresent = false;
        }
        
        testState.questions.push({
            sentence: sentence,
            targetWord: targetWord,
            isPresent: isPresent
        });
    }
    
    // Start with first question
    testState.currentStep = 0;
    
    const playBtn = document.getElementById('playSentence');
    if (playBtn) {
        playBtn.onclick = playCurrentSentence;
    }
    
    showCurrentWordDetectionQuestion();
    playCurrentSentence();
}

function playCurrentSentence() {
    const currentQuestion = testState.questions[testState.currentStep];
    speak(currentQuestion.sentence);
}

function showCurrentWordDetectionQuestion() {
    const currentQuestion = testState.questions[testState.currentStep];
    const targetWordElement = document.getElementById('targetWord');
    if (targetWordElement) {
        targetWordElement.textContent = `"${currentQuestion.targetWord}"`;
    }
    
    // Set up event listeners for buttons
    const yesBtn = document.getElementById('yesButton');
    if (yesBtn) {
        yesBtn.onclick = () => answerWordDetection(true);
    }
    
    const noBtn = document.getElementById('noButton');
    if (noBtn) {
        noBtn.onclick = () => answerWordDetection(false);
    }
}

function answerWordDetection(userAnswer) {
    const currentQuestion = testState.questions[testState.currentStep];
    const isCorrect = (userAnswer === currentQuestion.isPresent);
    
    testState.answers.push({
        isCorrect: isCorrect,
        targetWord: currentQuestion.targetWord,
        sentence: currentQuestion.sentence
    });
    
    // Move to next question or finish test
    testState.currentStep++;
    if (testState.currentStep < testState.questions.length) {
        playCurrentSentence();
        showCurrentWordDetectionQuestion();
    } else {
        finishWordDetectionTest();
    }
}

function finishWordDetectionTest() {
    // Calculate score
    const correctAnswers = testState.answers.filter(answer => answer.isCorrect).length;
    const score = Math.round((correctAnswers / testState.answers.length) * 100);
    
    // Show results
    showTestResults('Word Detection Test', score, `
        You correctly identified ${correctAnswers} out of ${testState.answers.length} words.
        ${score >= 80 ? 'Your word detection ability is excellent!' : 
          score >= 60 ? 'Your word detection ability is good.' : 
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results
    saveTestResults('word-detection', {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: testState.answers.length,
        date: firebase.firestore.FieldValue.serverTimestamp()
    });
}

// Fix 1: Update the handleTestSubmission function to properly handle multiple choice
function handleTestSubmission() {
    if (currentTest === 'speech-recognition') {
        const heardPhrase = document.getElementById('heardPhrase')?.value.trim();
        
        if (!heardPhrase) {
            alert('Please type what you heard.');
            return;
        }
        
        // Calculate similarity with original phrase
        const originalPhrase = testState.questions[testState.currentStep];
        const similarity = calculateSimilarity(heardPhrase, originalPhrase);
        const isCorrect = similarity >= 0.8;
        
        // Record answer
        testState.answers.push({
            heard: heardPhrase,
            original: originalPhrase,
            similarity: similarity,
            isCorrect: isCorrect
        });
        
        // Move to next question or finish test
        testState.currentStep++;
        if (testState.currentStep < testState.questions.length) {
            document.getElementById('heardPhrase').value = '';
            playCurrentPhrase();
        } else {
            finishSpeechRecognitionTest();
        }
    } else if (currentTest === 'multiple-choice') {
        const selectedOption = document.querySelector('input[name="multipleChoice"]:checked');
        
        if (!selectedOption) {
            alert('Please select an option.');
            return;
        }
        
        // Check if answer is correct
        const currentQuestion = testState.questions[testState.currentStep];
        const isCorrect = selectedOption.value === currentQuestion.phrase;
        
        // Record answer
        testState.answers.push({
            selected: selectedOption.value,
            correct: currentQuestion.phrase,
            isCorrect: isCorrect
        });
        
        // Move to next question or finish test
        testState.currentStep++;
        if (testState.currentStep < testState.questions.length) {
            showMultipleChoiceQuestion();
            playCurrentMultipleChoice();
        } else {
            finishMultipleChoiceTest();
        }
    }
}


// Fix 3: Update the test completion functions to use proper timestamps
function finishSpeechRecognitionTest() {
    // Calculate score
    const correctAnswers = testState.answers.filter(answer => answer.isCorrect).length;
    const score = Math.round((correctAnswers / testState.answers.length) * 100);
    
    // Show results
    showTestResults('Speech Recognition Test', score, `
        You correctly identified ${correctAnswers} out of ${testState.answers.length} phrases.
        ${score >= 80 ? 'Your speech recognition is excellent!' : 
          score >= 60 ? 'Your speech recognition is good.' : 
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results with proper timestamp
    saveTestResults('speech-recognition', {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: testState.answers.length
    });
}

function finishMultipleChoiceTest() {
    // Calculate score
    const correctAnswers = testState.answers.filter(answer => answer.isCorrect).length;
    const score = Math.round((correctAnswers / testState.answers.length) * 100);
    
    // Show results
    showTestResults('Multiple Choice Test', score, `
        You correctly identified ${correctAnswers} out of ${testState.answers.length} phrases.
        ${score >= 80 ? 'Your hearing comprehension is excellent!' : 
          score >= 60 ? 'Your hearing comprehension is good.' : 
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results with proper timestamp
    saveTestResults('multiple-choice', {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: testState.answers.length
    });
}

function finishVolumeSensitivityTest() {
    console.log('Volume sensitivity test answers:', testState.answers);
    
    // Calculate average threshold (lower is better for hearing sensitivity)
    const avgThreshold = testState.answers.reduce((sum, answer) => sum + answer.threshold, 0) / testState.answers.length;
    
    // Convert threshold to score (lower threshold = higher score)
    // Threshold of 0.1 = 100% score, Threshold of 1.0 = 0% score
    const score = Math.round((1 - avgThreshold) * 100);
    
    console.log('Volume sensitivity calculation:', {
        avgThreshold,
        score,
        answers: testState.answers
    });
    
    // Show results
    showTestResults('Volume Sensitivity Test', score, `
        Your average hearing threshold is ${Math.round(avgThreshold * 100)}% volume.
        ${score >= 80 ? 'Excellent hearing sensitivity!' : 
          score >= 60 ? 'Good hearing sensitivity.' : 
          score >= 40 ? 'Fair hearing sensitivity.' :
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results
    saveTestResults('volume-sensitivity', {
        score: score,
        threshold: avgThreshold,
        answers: testState.answers
    });
}

function finishWordDetectionTest() {
    // Calculate score
    const correctAnswers = testState.answers.filter(answer => answer.isCorrect).length;
    const score = Math.round((correctAnswers / testState.answers.length) * 100);
    
    // Show results
    showTestResults('Word Detection Test', score, `
        You correctly identified ${correctAnswers} out of ${testState.answers.length} words.
        ${score >= 80 ? 'Your word detection ability is excellent!' : 
          score >= 60 ? 'Your word detection ability is good.' : 
          'You may want to consult an audiologist for further evaluation.'}
    `);
    
    // Save results with proper timestamp
    saveTestResults('word-detection', {
        score: score,
        correctAnswers: correctAnswers,
        totalQuestions: testState.answers.length
    });
}

// Show test results
function showTestResults(testType, score, recommendation) {
    // Hide test content and show results
    document.querySelector('#testContent > div:not(#testResults)')?.classList.add('hidden');
    document.getElementById('testResults')?.classList.remove('hidden');
    
    // Set results
    const testTypeElement = document.getElementById('testTypeResult');
    const testScoreElement = document.getElementById('testScoreResult');
    const testDateElement = document.getElementById('testDateResult');
    const testRecommendationElement = document.getElementById('testRecommendation');
    const resultsMessageElement = document.getElementById('resultsMessage');
    
    if (testTypeElement) testTypeElement.textContent = testType;
    if (testScoreElement) testScoreElement.textContent = `${score}%`;
    if (testDateElement) testDateElement.textContent = new Date().toLocaleDateString();
    if (testRecommendationElement) testRecommendationElement.textContent = recommendation;
    if (resultsMessageElement) resultsMessageElement.textContent = `Your ${testType.toLowerCase()} results have been recorded.`;
}

// Fix 2: Update the saveTestResults function to handle Firebase timestamp correctly
function saveTestResults(testType, results) {
    console.log('Saving test results:', { testType, results });
    
    // Create test record with current timestamp
    const testRecord = {
        testType: testType,
        ...results,
        date: new Date(),
        timestamp: new Date()
    };
    
    // Update user data
    const newTestHistory = [...userHearingData.testHistory, testRecord];
    const newBadges = [...userHearingData.badges];
    const newTotalTests = (userHearingData.totalTests || 0) + 1;
    const newBestScore = Math.max(userHearingData.bestScore || 0, results.score);
    
    // Enhanced badge logic
    if (!newBadges.includes('first_test')) {
        newBadges.push('first_test');
    }
    
    if (newTotalTests >= 3 && !newBadges.includes('three_tests')) {
        newBadges.push('three_tests');
    }
    
    if (newTotalTests >= 5 && !newBadges.includes('five_tests')) {
        newBadges.push('five_tests');
    }
    
    if (results.score >= 90 && !newBadges.includes('excellent_hearing')) {
        newBadges.push('excellent_hearing');
    }
    
    if (results.score >= 70 && !newBadges.includes('good_hearing')) {
        newBadges.push('good_hearing');
    }
    
    // Calculate streak
    let newStreak = userHearingData.streak || 0;
    const now = new Date();
    const lastTestDate = userHearingData.lastTest || null;
    
    if (!lastTestDate) {
        newStreak = 1;
    } else {
        const lastDate = lastTestDate instanceof Date ? lastTestDate : new Date(lastTestDate);
        const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Same day test - maintain streak
            newStreak = userHearingData.streak || 0;
        } else if (diffDays === 1) {
            // Consecutive day - increase streak
            newStreak = (userHearingData.streak || 0) + 1;
        } else if (diffDays > 1) {
            // Gap in testing - reset streak
            newStreak = 1;
        }
    }
    
    // Streak-based badges
    if (newStreak >= 7 && !newBadges.includes('week_streak')) {
        newBadges.push('week_streak');
    }
    
    // Update local data
    userHearingData.testHistory = newTestHistory;
    userHearingData.badges = newBadges;
    userHearingData.streak = newStreak;
    userHearingData.totalTests = newTotalTests;
    userHearingData.bestScore = newBestScore;
    userHearingData.lastTest = new Date();
    
    // Save to localStorage
    saveHearingDataToStorage();
    
    // Update dashboard
    updateDashboard();
    
    // Show achievement notification if new badges were earned
    const previousBadgeCount = userHearingData.badges ? userHearingData.badges.length : 0;
    const newBadgesEarned = newBadges.length - previousBadgeCount;
    if (newBadgesEarned > 0) {
        showAchievementNotification(newBadgesEarned);
    }
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

// Utility function to calculate similarity between strings
function calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

// Utility function to shuffle array
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Levenshtein distance for string similarity
function levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
        matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
        matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
        for (let j = 1; j <= str1.length; j++) {
            if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    
    return matrix[str2.length][str1.length];
}