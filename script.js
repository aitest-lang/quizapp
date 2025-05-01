// --- DOM Elements ---
const weekSelect = document.getElementById('week-select');
const modeLearnButton = document.getElementById('mode-learn');
const modeRepeatButton = document.getElementById('mode-repeat');
const restartButton = document.getElementById('restart-button');
const themeToggle = document.getElementById('theme-toggle');
const questionContainer = document.getElementById('question-container');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackArea = document.getElementById('feedback-area');
const repetitionProgress = document.getElementById('repetition-progress');
const nextButton = document.getElementById('next-button');
const completionArea = document.getElementById('completion-area');
const completionMessage = document.getElementById('completion-message');

// --- State Variables ---
let originalFilteredQuestions = [];
let currentQuestions = [];
let currentQuestionIndex = 0;
let selectedWeek = '';
let currentMode = 'Learning';
let score = 0;
let incorrectQueue = [];
let totalErrorsInRepetition = 0;
let isAnswered = false;

// --- Utility Functions ---
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array];
    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
}

// --- Theme Handling ---
function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('quizTheme', theme);
    if (themeToggle) {
         themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// --- State Management (localStorage) ---
function saveState() {
    const state = {
        selectedWeek,
        currentMode,
        // Keep it simple: Don't save progress state on unload due to shuffling complexity
    };
    localStorage.setItem('quizState', JSON.stringify(state));
     // Theme is saved separately in applyTheme
}

function loadState() {
    const savedState = localStorage.getItem('quizState');
    if (savedState) {
        const state = JSON.parse(savedState);
        selectedWeek = state.selectedWeek || ''; // Load preferred week
        currentMode = state.currentMode || 'Learning'; // Load preferred mode
    }
    // Always reset progress variables on load for simplicity with shuffling
    currentQuestionIndex = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    originalFilteredQuestions = [];
    currentQuestions = [];
}


// --- UI Update Functions ---
function updateModeButtons() {
    if (modeLearnButton && modeRepeatButton) {
        modeLearnButton.classList.toggle('active', currentMode === 'Learning');
        modeRepeatButton.classList.toggle('active', currentMode === 'Repetition');
    } else {
        console.error("Mode buttons not found!");
    }
}

function displayRepetitionProgress() {
    if (currentMode === 'Repetition' && totalErrorsInRepetition > 0) {
        repetitionProgress.textContent = `Remaining retries: ${incorrectQueue.length} / ${totalErrorsInRepetition}`;
    } else {
        repetitionProgress.textContent = '';
    }
}

// --- Core Quiz Logic ---
function startQuiz() {
    // Filter questions
    if (selectedWeek === 'all') {
        originalFilteredQuestions = allQuestions.filter(q => typeof q.week === 'number');
    } else {
        // Handle potential string 'other' or numeric weeks
        const weekValue = selectedWeek === 'other' ? 'other' : parseInt(selectedWeek);
        if (!isNaN(weekValue) || weekValue === 'other') {
             originalFilteredQuestions = allQuestions.filter(q => q.week === weekValue);
        } else {
             originalFilteredQuestions = []; // Handle invalid week selection
        }
    }

    // Shuffle
    currentQuestions = shuffleArray(originalFilteredQuestions);

    // Reset state
    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;

    // Update UI
    completionArea.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    nextButton.classList.add('hidden');
    repetitionProgress.textContent = '';
    updateModeButtons(); // Ensure buttons reflect current mode

    if (currentQuestions.length > 0) {
        displayQuestion();
    } else {
        questionText.textContent = "No questions found for this selection.";
        optionsContainer.innerHTML = "";
    }
}

function displayQuestion() {
    isAnswered = false;
    feedbackArea.textContent = '';
    nextButton.classList.add('hidden'); // Always hide initially

    questionContainer.classList.add('fade-out');

    setTimeout(() => {
        let questionToShow;
        let questionOriginalIndex = -1;

        // Determine which question to show
        if (currentMode === 'Repetition' && incorrectQueue.length > 0 && totalErrorsInRepetition > 0) {
            // Retry phase: get ORIGINAL index from queue
            const originalIndex = incorrectQueue[currentQuestionIndex % incorrectQueue.length]; // Cycle through queue
            questionToShow = originalFilteredQuestions[originalIndex];
            questionOriginalIndex = originalIndex; // Store for repetition handling
            displayRepetitionProgress(); // Update progress display
        } else {
            // Learning mode or first pass of Repetition mode
             if (currentQuestionIndex >= currentQuestions.length) {
                 showCompletion(); // Reached end
                 return;
            }
            questionToShow = currentQuestions[currentQuestionIndex];
            // Find its original index for potential addition to incorrectQueue
            questionOriginalIndex = originalFilteredQuestions.findIndex(q => q.question === questionToShow.question);
            repetitionProgress.textContent = ''; // Clear progress display
        }

        // Check if a question was found (safety)
        if (!questionToShow) {
             showCompletion();
             return;
        }

        // Display the question text
        questionText.textContent = questionToShow.question;
        optionsContainer.innerHTML = ""; // Clear previous options

        // Shuffle and display options
        const shuffledOptions = shuffleArray(questionToShow.options);
        shuffledOptions.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.classList.add('option-button');
            // Pass original index needed for Repetition mode tracking
            button.addEventListener('click', () => handleOptionClick(optionText, button, questionToShow.correctAnswer, questionOriginalIndex));
            optionsContainer.appendChild(button);
        });

        // Fade in the new question
        questionContainer.classList.remove('fade-out');

    }, 400); // Match CSS transition duration
}

function handleOptionClick(selectedOptionText, button, correctAnswer, originalIndex) {
    if (isAnswered) return; // Prevent multiple clicks
    isAnswered = true;

    const isCorrect = selectedOptionText === correctAnswer;

    // Disable all buttons and provide visual feedback
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        // Always highlight the correct answer in green after selection
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        }
    });

    if (currentMode === 'Learning') {
        handleLearningModeAnswer(isCorrect, button);
        nextButton.classList.remove('hidden'); // Show next button
    } else { // Repetition Mode
        handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex);
        // Show next button regardless of correct/incorrect in Repetition Mode
        nextButton.classList.remove('hidden');
    }
}

function handleLearningModeAnswer(isCorrect, selectedButton) {
     if (isCorrect) {
        score++;
        // Correct answer already highlighted green in handleOptionClick
    } else {
        selectedButton.classList.add('incorrect'); // Highlight selected incorrect answer red
    }
}

function handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex) {
    const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);

    if (totalErrorsInRepetition === 0) { // First pass
        if (!isCorrect) {
            if (!incorrectQueue.includes(originalIndex)) {
                 incorrectQueue.push(originalIndex);
            }
            if (selectedButton) selectedButton.classList.add('incorrect'); // Show selected as incorrect
        } else {
             if (selectedButton && !selectedButton.classList.contains('correct')){
                 // The globally correct button is marked green; ensure the selected one is too if correct
                 selectedButton.classList.add('correct');
             }
        }
    } else { // Retry phase
        if (isCorrect) {
            // Remove the correctly answered question's original index from the queue
            incorrectQueue = incorrectQueue.filter(idx => idx !== originalIndex);
             if (selectedButton && !selectedButton.classList.contains('correct')) {
                 selectedButton.classList.add('correct'); // Mark selected as correct
             }
             // Update progress display after potential removal
             displayRepetitionProgress();
        } else {
             // Add shake effect and mark as incorrect
             if(selectedButton) {
                 selectedButton.classList.add('incorrect');
             }
        }
    }
}

function handleNextQuestion() {
    if (currentMode === 'Repetition' && totalErrorsInRepetition > 0) {
        // Retry Phase Logic
        if (incorrectQueue.length === 0) {
            showCompletion(); // All errors corrected
        } else {
            // No index increment needed here as we use modulo on the queue length
            // Just need to trigger redisplay which happens in displayQuestion
             displayQuestion(); // Display next question from the remaining queue
        }
    } else {
        // Learning Mode or First Pass Repetition Mode Logic
        currentQuestionIndex++; // Move to the next index in the *shuffled* list
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            // End of Learning mode or first pass of Repetition mode
            if (currentMode === 'Repetition' && incorrectQueue.length > 0) {
                // Start the retry phase
                totalErrorsInRepetition = incorrectQueue.length;
                currentQuestionIndex = 0; // Reset index for cycling through the *incorrectQueue*
                displayQuestion(); // Display first question from the retry queue
            } else {
                showCompletion(); // Quiz finished (Learning or Repetition with 0 errors)
            }
        }
    }
}

function showCompletion() {
    questionContainer.classList.add('hidden');
    completionArea.classList.remove('hidden');
    let weekText = '';
    if (selectedWeek === 'all') weekText = 'All Weeks';
    else if (selectedWeek === 'other') weekText = 'Other';
    else weekText = `Week ${selectedWeek}`;

    let message = `Excellent! You've mastered all questions for ${weekText}!`; // Default completion message

    if (currentMode === 'Learning') {
        // You could add score here if desired: `(${score} / ${currentQuestions.length} correct)`
        message = `You finished the ${weekText} questions!`;
    }
    // For Repetition mode, the default message works well for successful completion.

    completionMessage.textContent = message;
    // Clear potentially saved state on completion
    localStorage.removeItem('quizState');
}

// --- Event Handlers ---
function handleWeekChange(event) {
    selectedWeek = event.target.value;
    restartQuiz();
}

function switchMode(newMode) {
    if (currentMode !== newMode) {
        currentMode = newMode;
        // Don't update buttons immediately, restartQuiz will call startQuiz which calls updateModeButtons
        restartQuiz(); // Switching mode restarts the quiz
    }
}

function restartQuiz() {
    // Clear progress state
    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;
    originalFilteredQuestions = [];
    currentQuestions = [];

    // Keep user's selected week and mode preferences
    saveState(); // Save current selectedWeek and currentMode

    // Start the quiz with the current settings
    startQuiz();
}

// --- Setup and Initialization ---
function populateWeeks() {
    if (!weekSelect) { console.error("Week select dropdown not found!"); return; }
    // Assuming getUniqueWeeks is available from questions.js
    const weeks = getUniqueWeeks();
    weekSelect.innerHTML = ''; // Clear existing

    // Add "All Weeks"
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Weeks';
    weekSelect.appendChild(allOption);

    // Add specific weeks
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week === 'other' ? 'Other' : `Week ${week}`;
        weekSelect.appendChild(option);
    });
}

function setupEventListeners() {
    if (weekSelect) weekSelect.addEventListener('change', handleWeekChange); else console.error("Week select not found!");
    if (modeLearnButton) modeLearnButton.addEventListener('click', () => switchMode('Learning')); else console.error("Learn button not found!");
    if (modeRepeatButton) modeRepeatButton.addEventListener('click', () => switchMode('Repetition')); else console.error("Repeat button not found!");
    if (restartButton) restartButton.addEventListener('click', restartQuiz); else console.error("Restart button not found!");
    if (nextButton) nextButton.addEventListener('click', handleNextQuestion); else console.error("Next button not found!");
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme); else console.error("Theme toggle button not found!");
}

function initializeQuiz() {
    loadState(); // Load preferences (week, mode)
    populateWeeks(); // Create dropdown options
    setupEventListeners(); // Attach button clicks etc.
    applyTheme(localStorage.getItem('quizTheme') || 'light'); // Set initial theme

    // Set dropdown to loaded/default week *after* populating
    const validWeeks = Array.from(weekSelect.options).map(opt => opt.value);
    if (selectedWeek && validWeeks.includes(selectedWeek)) {
        weekSelect.value = selectedWeek;
    } else {
        selectedWeek = validWeeks.length > 0 ? validWeeks[0] : ''; // Default to first option ('all')
        if (selectedWeek) { weekSelect.value = selectedWeek; }
    }
    // Ensure state variable matches dropdown
    selectedWeek = weekSelect.value;

    // Start the quiz with loaded/default settings
    startQuiz();
}

// --- Global Event Listener ---
// Save preferences on unload (optional, but useful for week/mode/theme)
window.addEventListener('beforeunload', () => {
    saveState(); // Saves current selectedWeek and currentMode
    // Theme is saved by applyTheme
});

// --- Start Application ---
initializeQuiz(); // This call now happens after all functions are defined.
