// --- DOM Elements (Keep as before) ---
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
let originalFilteredQuestions = []; // Unshuffled list for the selected week/all
let currentQuestions = []; // Shuffled list currently being used in the quiz
let currentQuestionIndex = 0;
let selectedWeek = '';
let currentMode = 'Learning';
let score = 0;
let incorrectQueue = []; // Stores *original indices* from originalFilteredQuestions
let totalErrorsInRepetition = 0;
let isAnswered = false;

// --- Utility Functions ---
// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array]; // Create a copy

    while (currentIndex !== 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
}

// --- Initialization ---
function initializeQuiz() {
    // No need to wrap in DOMContentLoaded if using defer
    loadState();
    populateWeeks();
    setupEventListeners();
    applyTheme(localStorage.getItem('quizTheme') || 'light');

    const validWeeks = Array.from(weekSelect.options).map(opt => opt.value);
    if (selectedWeek && validWeeks.includes(selectedWeek)) {
        weekSelect.value = selectedWeek;
    } else {
        selectedWeek = validWeeks.length > 0 ? validWeeks[0] : '';
        if (selectedWeek) { // Ensure a valid week is selected before setting
            weekSelect.value = selectedWeek;
        }
    }
     // Ensure selectedWeek reflects the actual dropdown value after potential defaulting
    selectedWeek = weekSelect.value;

    updateModeButtons();
    startQuiz();
}

function populateWeeks() {
    // Assuming getUniqueWeeks is available from questions.js [1]
    const weeks = getUniqueWeeks();
    weekSelect.innerHTML = '';

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Weeks';
    weekSelect.appendChild(allOption);

    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week === 'other' ? 'Other' : `Week ${week}`;
        weekSelect.appendChild(option);
    });
}

function setupEventListeners() {
    // Check if elements exist before adding listeners (optional safety check)
    if (weekSelect) weekSelect.addEventListener('change', handleWeekChange);
    if (modeLearnButton) modeLearnButton.addEventListener('click', () => switchMode('Learning'));
    if (modeRepeatButton) modeRepeatButton.addEventListener('click', () => switchMode('Repetition'));
    if (restartButton) restartButton.addEventListener('click', restartQuiz);
    if (nextButton) nextButton.addEventListener('click', handleNextQuestion);
    if (themeToggle) themeToggle.addEventListener('click', toggleTheme);
    else console.error("Theme toggle button not found!"); // Debugging line
}

// --- State Management (localStorage) ---
function saveState() {
    // Basic save state - consider improving robustness for shuffled quizzes if needed
    const state = {
        selectedWeek,
        currentMode,
        // Don't save index/queue for now, restart on load for simplicity with shuffling
    };
    localStorage.setItem('quizState', JSON.stringify(state));
     // Save theme separately as it's independent of quiz progress
    // localStorage.setItem('quizTheme', document.body.classList.contains('dark-theme') ? 'dark' : 'light'); // Already done in applyTheme
}

function loadState() {
    const savedState = localStorage.getItem('quizState');
    if (savedState) {
        const state = JSON.parse(savedState);
        selectedWeek = state.selectedWeek || ''; // Load preferred week
        currentMode = state.currentMode || 'Learning'; // Load preferred mode
    }
    // Reset progress variables regardless on load for simplicity
    currentQuestionIndex = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    originalFilteredQuestions = [];
    currentQuestions = [];
}

// --- Theme Handling ---
function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark'); // Apply/remove class based on theme [11]
    localStorage.setItem('quizTheme', theme); // Save preference [4][14]
    if (themeToggle) { // Update icon if button exists
         themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    }
}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme); // Apply the new theme [2][11][13]
}


// --- Core Quiz Logic ---
function startQuiz() {
    if (selectedWeek === 'all') {
        originalFilteredQuestions = allQuestions.filter(q => typeof q.week === 'number');
    } else {
        const weekValue = isNaN(parseInt(selectedWeek)) ? selectedWeek : parseInt(selectedWeek);
        originalFilteredQuestions = allQuestions.filter(q => q.week === weekValue);
    }

    currentQuestions = shuffleArray(originalFilteredQuestions);

    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;

    completionArea.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    nextButton.classList.add('hidden');
    repetitionProgress.textContent = '';

    if (currentQuestions.length > 0) {
        displayQuestion();
    } else {
        questionText.textContent = "No questions found for this selection.";
        optionsContainer.innerHTML = "";
    }
    // saveState(); // Save state less frequently, e.g., on unload or next question
}

function displayQuestion() {
    isAnswered = false;
    feedbackArea.textContent = '';
    nextButton.classList.add('hidden'); // Always hide initially

    questionContainer.classList.add('fade-out');

    setTimeout(() => {
        let questionToShow;
        let questionOriginalIndex = -1;

        if (currentMode === 'Repetition' && incorrectQueue.length > 0 && totalErrorsInRepetition > 0) {
            const originalIndex = incorrectQueue[currentQuestionIndex % incorrectQueue.length];
            questionToShow = originalFilteredQuestions[originalIndex];
            questionOriginalIndex = originalIndex;
            displayRepetitionProgress();
        } else {
             if (currentQuestionIndex >= currentQuestions.length) {
                 showCompletion();
                 return;
            }
            questionToShow = currentQuestions[currentQuestionIndex];
            questionOriginalIndex = originalFilteredQuestions.findIndex(q => q.question === questionToShow.question);
            repetitionProgress.textContent = '';
        }

        if (!questionToShow) {
             showCompletion();
             return;
        }

        questionText.textContent = questionToShow.question;
        optionsContainer.innerHTML = "";

        const shuffledOptions = shuffleArray(questionToShow.options);

        shuffledOptions.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.classList.add('option-button');
            button.addEventListener('click', () => handleOptionClick(optionText, button, questionToShow.correctAnswer, questionOriginalIndex));
            optionsContainer.appendChild(button);
        });

        questionContainer.classList.remove('fade-out');

    }, 400);
}

// *** MODIFIED FUNCTION ***
function handleOptionClick(selectedOptionText, button, correctAnswer, originalIndex) {
    if (isAnswered) return;
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
        // Show next button in Learning Mode
        nextButton.classList.remove('hidden');
    } else { // Repetition Mode
        handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex);
        // **REMOVED**: setTimeout(handleNextQuestion, 1000);
        // **ADDED**: Show next button regardless of correct/incorrect in Repetition Mode [6][7][10]
        nextButton.classList.remove('hidden');
    }

    // saveState(); // Consider saving state here or on nextQuestion/unload
}

// No changes needed
function handleLearningModeAnswer(isCorrect, selectedButton) {
     if (isCorrect) {
        // Already marked as correct by the generic highlighting
        score++;
    } else {
        selectedButton.classList.add('incorrect'); // Only mark the selected button as incorrect
    }
}

// Modified to use originalIndex for the queue
function handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex) {
    if (totalErrorsInRepetition === 0) { // First pass
        if (!isCorrect) {
            if (!incorrectQueue.includes(originalIndex)) {
                 incorrectQueue.push(originalIndex);
            }
            // Apply incorrect styling immediately on first pass if desired
            const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
            if (selectedButton) selectedButton.classList.add('incorrect');

        } else {
             // Apply correct styling immediately on first pass if desired
             const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
             if (selectedButton && !selectedButton.classList.contains('correct')){
                // The correct button is already marked green, but ensure the selected one is too if correct
                selectedButton.classList.add('correct');
             }
        }
    } else { // Retry phase
        if (isCorrect) {
            const indexToRemove = originalIndex;
            incorrectQueue = incorrectQueue.filter(idx => idx !== indexToRemove);
             // Apply correct styling
             const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
             if (selectedButton && !selectedButton.classList.contains('correct')) selectedButton.classList.add('correct');
        } else {
            // Apply shake effect and incorrect styling
             const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
             if(selectedButton) {
                 selectedButton.classList.add('incorrect');
                 // Optionally remove 'incorrect' after animation if you only want shake
                 // setTimeout(() => selectedButton.classList.remove('incorrect'), 500);
             }
        }
    }
}

// No changes needed
function handleNextQuestion() {
    if (currentMode === 'Repetition' && totalErrorsInRepetition > 0) {
        if (incorrectQueue.length === 0) {
            showCompletion();
        } else {
             displayQuestion();
        }
    } else {
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            if (currentMode === 'Repetition' && incorrectQueue.length > 0) {
                totalErrorsInRepetition = incorrectQueue.length;
                currentQuestionIndex = 0;
                displayQuestion();
            } else {
                showCompletion();
            }
        }
    }
    // saveState(); // Consider saving state here
}

// No changes needed
function displayRepetitionProgress() {
    if (currentMode === 'Repetition' && totalErrorsInRepetition > 0) {
        repetitionProgress.textContent = `Remaining retries: ${incorrectQueue.length} / ${totalErrorsInRepetition}`;
    } else {
        repetitionProgress.textContent = '';
    }
}

// No changes needed (except perhaps message refinement)
function showCompletion() {
    questionContainer.classList.add('hidden');
    completionArea.classList.remove('hidden');
    let weekText = '';
    if (selectedWeek === 'all') weekText = 'All Weeks';
    else if (selectedWeek === 'other') weekText = 'Other';
    else weekText = `Week ${selectedWeek}`;

    let message = '';
    if (currentMode === 'Learning') {
        message = `You finished the ${weekText} questions!`;
    } else {
         if (totalErrorsInRepetition === 0 && incorrectQueue.length === 0 && currentQuestionIndex >= currentQuestions.length) {
              message = `Excellent! You've mastered all questions for ${weekText}!`;
         } else if (currentMode === 'Repetition' && incorrectQueue.length === 0 && totalErrorsInRepetition > 0) {
             message = `Excellent! You've mastered all questions for ${weekText}!`; // Message after finishing retry queue
         }
          else { // Should only happen if Repetition mode finishes with 0 errors initially
             message = `Excellent! You've mastered all questions for ${weekText}!`;
         }
    }
    completionMessage.textContent = message;
    localStorage.removeItem('quizState'); // Clear progress on completion
}

// No changes needed
function handleWeekChange(event) {
    selectedWeek = event.target.value;
    restartQuiz();
}

// No changes needed
function switchMode(newMode) {
    if (currentMode !== newMode) {
        currentMode = newMode;
        updateModeButtons();
        restartQuiz();
    }
}

// No changes needed
function updateModeButtons() {
    if (modeLearnButton && modeRepeatButton) {
        modeLearnButton.classList.toggle('active', currentMode === 'Learning');
        modeRepeatButton.classList.toggle('active', currentMode === 'Repetition');
    }
}

// No changes needed
function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;
    originalFilteredQuestions = [];
    currentQuestions = [];
    // Keep selectedWeek and currentMode, but clear progress from localStorage
    // loadState() might reset week/mode if called here, so maybe just clear relevant parts
    localStorage.removeItem('quizState');
    // Manually save current week/mode after clearing progress
     saveState(); // Save the current selectedWeek and currentMode without progress vars

    startQuiz();
}


// --- Global Event Listener for Saving State ---
window.addEventListener('beforeunload', saveState);


// --- Start the application ---
// Removed DOMContentLoaded wrapper as 'defer' handles execution timing
initializeQuiz();
