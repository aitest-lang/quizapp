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
// Fisher-Yates Shuffle Algorithm [3]
function shuffleArray(array) {
    let currentIndex = array.length, randomIndex;
    const newArray = [...array]; // Create a copy to avoid modifying the original directly

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {
        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [newArray[currentIndex], newArray[randomIndex]] = [
            newArray[randomIndex], newArray[currentIndex]];
    }
    return newArray;
}


// --- Initialization ---
function initializeQuiz() {
    loadState();
    populateWeeks(); // Populate before setting value
    setupEventListeners();
    applyTheme(localStorage.getItem('quizTheme') || 'light');

    // Set initial state (ensure selectedWeek exists in the populated options)
    const validWeeks = Array.from(weekSelect.options).map(opt => opt.value);
    if (selectedWeek && validWeeks.includes(selectedWeek)) {
        weekSelect.value = selectedWeek;
    } else {
        selectedWeek = validWeeks.length > 0 ? validWeeks[0] : ''; // Default to first available option
        weekSelect.value = selectedWeek;
    }

    updateModeButtons();
    startQuiz();
}

function populateWeeks() {
    const weeks = getUniqueWeeks(); // From questions.js [1]
    weekSelect.innerHTML = ''; // Clear existing options

    // Add "All Weeks" option
    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.textContent = 'All Weeks';
    weekSelect.appendChild(allOption);

    // Add individual week options
    weeks.forEach(week => {
        // Skip 'other' if you don't want it selectable individually,
        // or handle it like a normal week if you do. Let's assume we include it.
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week === 'other' ? 'Other' : `Week ${week}`;
        weekSelect.appendChild(option);
    });
}

function setupEventListeners() {
    weekSelect.addEventListener('change', handleWeekChange);
    modeLearnButton.addEventListener('click', () => switchMode('Learning'));
    modeRepeatButton.addEventListener('click', () => switchMode('Repetition'));
    restartButton.addEventListener('click', restartQuiz);
    nextButton.addEventListener('click', handleNextQuestion);
    themeToggle.addEventListener('click', toggleTheme);
}

// --- State Management (localStorage - Keep saveState/loadState as before) ---
// --- Theme Handling (Keep applyTheme/toggleTheme as before) ---

function saveState() {
    const state = {
        selectedWeek,
        currentMode,
        currentQuestionIndex,
        incorrectQueue,
        totalErrorsInRepetition,
        // Need to save the original order if quiz is in progress
        originalFilteredQuestions: originalFilteredQuestions.map(q => q.question) // Save identifiers, not full objects
    };
    localStorage.setItem('quizState', JSON.stringify(state));
}

function loadState() {
    const savedState = localStorage.getItem('quizState');
    if (savedState) {
        const state = JSON.parse(savedState);
        selectedWeek = state.selectedWeek || '';
        currentMode = state.currentMode || 'Learning';

        // Attempt to restore progress *only if* the week/mode match
        // and the original questions seem consistent. This is complex with shuffling.
        // For simplicity, we might often just restart if the page reloads.
        // Let's try a basic restore:
        if (state.selectedWeek && state.originalFilteredQuestions) {
            // Refilter based on saved week to check consistency
            let potentialOriginals;
            if (state.selectedWeek === 'all') {
                potentialOriginals = allQuestions.filter(q => typeof q.week === 'number');
            } else {
                 const weekValue = isNaN(parseInt(state.selectedWeek)) ? state.selectedWeek : parseInt(state.selectedWeek);
                 potentialOriginals = allQuestions.filter(q => q.week === weekValue);
            }

            // Very basic check: compare question count
            if (potentialOriginals.length === state.originalFilteredQuestions.length) {
                // We could do a deeper check comparing question text if needed
                originalFilteredQuestions = potentialOriginals; // Assume it's the same set
                currentQuestionIndex = state.currentQuestionIndex || 0;
                incorrectQueue = state.incorrectQueue || [];
                totalErrorsInRepetition = state.totalErrorsInRepetition || 0;
                // Re-shuffle the loaded original questions to maintain consistency for the session
                currentQuestions = shuffleArray(originalFilteredQuestions);
                // Adjust currentQuestionIndex if needed (if we saved index relative to shuffled) - complex!
                // Safest bet: Often just restart the quiz on load unless state persistence is critical & robustly handled.
                // For this example, let's favor restarting for simplicity on load if progress was saved.
                console.log("Attempting to load state, but restarting quiz for consistency due to shuffling.");
                 currentQuestionIndex = 0;
                 incorrectQueue = [];
                 totalErrorsInRepetition = 0;

            } else {
                // Mismatch, reset progress
                 currentQuestionIndex = 0;
                 incorrectQueue = [];
                 totalErrorsInRepetition = 0;
            }
        } else {
             // No saved progress, reset
             currentQuestionIndex = 0;
             incorrectQueue = [];
             totalErrorsInRepetition = 0;
        }

    } else {
        // Default values if no saved state
        currentQuestionIndex = 0;
        incorrectQueue = [];
        totalErrorsInRepetition = 0;
    }
     // selectedWeek and currentMode will be set/updated during initializeQuiz flow
}

// --- Core Quiz Logic ---
function startQuiz() {
    // 1. Filter questions based on selected week/mode
    if (selectedWeek === 'all') {
        originalFilteredQuestions = allQuestions.filter(q => typeof q.week === 'number'); // Combine all numeric weeks
    } else {
        const weekValue = isNaN(parseInt(selectedWeek)) ? selectedWeek : parseInt(selectedWeek);
        originalFilteredQuestions = allQuestions.filter(q => q.week === weekValue);
    }

    // 2. Shuffle the filtered questions for display order [3][4]
    currentQuestions = shuffleArray(originalFilteredQuestions);

    // 3. Reset state variables
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
    // Don't save state here, save after first interaction or on unload/page hide
}

function displayQuestion() {
    isAnswered = false;
    feedbackArea.textContent = '';
    nextButton.classList.add('hidden');

    questionContainer.classList.add('fade-out');

    setTimeout(() => {
        let questionToShow;
        let questionOriginalIndex = -1; // Track index in the *unshuffled* list

        if (currentMode === 'Repetition' && incorrectQueue.length > 0 && totalErrorsInRepetition > 0) {
            // Retry phase: get ORIGINAL index from queue
            const originalIndex = incorrectQueue[currentQuestionIndex % incorrectQueue.length];
            questionToShow = originalFilteredQuestions[originalIndex];
            questionOriginalIndex = originalIndex; // Store for repetition handling
            displayRepetitionProgress();
        } else {
            // Learning mode or first pass of Repetition mode
            if (currentQuestionIndex >= currentQuestions.length) {
                 // Safety check for end of quiz
                 showCompletion();
                 return;
            }
            questionToShow = currentQuestions[currentQuestionIndex];
            // Find its original index for potential addition to incorrectQueue
            questionOriginalIndex = originalFilteredQuestions.findIndex(q => q.question === questionToShow.question);
            repetitionProgress.textContent = '';
        }

        if (!questionToShow) {
             showCompletion();
             return;
        }

        questionText.textContent = questionToShow.question;
        optionsContainer.innerHTML = "";

        // --- Shuffle options --- [3][4]
        const shuffledOptions = shuffleArray(questionToShow.options);
        // --- End Shuffle ---

        shuffledOptions.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.classList.add('option-button');
             // Pass the original index along with the click handler
            button.addEventListener('click', () => handleOptionClick(optionText, button, questionToShow.correctAnswer, questionOriginalIndex));
            optionsContainer.appendChild(button);
        });

        questionContainer.classList.remove('fade-out');

    }, 400); // Match CSS transition
}

// Modified to accept the original index
function handleOptionClick(selectedOptionText, button, correctAnswer, originalIndex) {
    if (isAnswered) return;
    isAnswered = true;

    const isCorrect = selectedOptionText === correctAnswer;

    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
        if (btn.textContent === correctAnswer) {
            btn.classList.add('correct');
        }
    });

    if (currentMode === 'Learning') {
        handleLearningModeAnswer(isCorrect, button); // No need for originalIndex here
        nextButton.classList.remove('hidden');
    } else { // Repetition Mode
        handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex); // Pass originalIndex
        setTimeout(handleNextQuestion, 1000);
    }

    // Consider saving state less frequently, e.g., on page unload or every few questions
    // saveState();
}

// Learning mode feedback (no changes needed here)
function handleLearningModeAnswer(isCorrect, selectedButton) {
     if (isCorrect) {
        selectedButton.classList.add('correct');
        score++;
    } else {
        selectedButton.classList.add('incorrect');
    }
}

// Modified to use originalIndex for the queue
function handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer, originalIndex) {
    if (totalErrorsInRepetition === 0) { // First pass
        if (!isCorrect) {
            if (!incorrectQueue.includes(originalIndex)) { // Use originalIndex
                 incorrectQueue.push(originalIndex);
            }
        }
    } else { // Retry phase
        if (isCorrect) {
            // Remove the *correctly answered* question's original index from the queue
            const indexToRemove = originalIndex; // We already have the original index
            incorrectQueue = incorrectQueue.filter(idx => idx !== indexToRemove);
            // No need to adjust currentQuestionIndex here, the modulo logic handles the shrinking queue
        } else {
             // Add shake effect
             const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
             if(selectedButton) {
                 selectedButton.classList.add('incorrect');
                 setTimeout(() => selectedButton.classList.remove('incorrect'), 500);
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
            // We don't increment index here; displayQuestion uses modulo
            // The effective "next" question is handled by the shrinking queue and modulo
             displayQuestion();
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
    // Consider saving state less frequently
}

// displayRepetitionProgress (Keep as before)
// showCompletion (Keep as before, maybe adjust messages slightly for "All Weeks")
function showCompletion() {
    questionContainer.classList.add('hidden');
    completionArea.classList.remove('hidden');
    let weekText = '';
    if (selectedWeek === 'all') {
        weekText = 'All Weeks';
    } else if (selectedWeek === 'other') {
        weekText = 'Other';
    } else {
         weekText = `Week ${selectedWeek}`;
    }

    let message = '';
    if (currentMode === 'Learning') {
        message = `You finished the ${weekText} questions!`;
    } else {
         if (totalErrorsInRepetition === 0 && incorrectQueue.length === 0) {
             message = `Excellent! You've mastered all questions for ${weekText}!`;
             // Trigger confetti
         } else {
              // This state should ideally not be reached if logic is correct,
              // as completion implies the queue is empty after retries.
               message = `Quiz complete for ${weekText}.`;
         }
    }
    completionMessage.textContent = message;
    localStorage.removeItem('quizState'); // Clear progress on completion
}


// handleWeekChange (Keep as before)
function handleWeekChange(event) {
    selectedWeek = event.target.value;
    restartQuiz();
}

// switchMode (Keep as before)
function switchMode(newMode) {
    if (currentMode !== newMode) {
        currentMode = newMode;
        updateModeButtons();
        restartQuiz();
    }
}

// updateModeButtons (Keep as before)
// restartQuiz (Keep as before)
function restartQuiz() {
    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;
    originalFilteredQuestions = []; // Clear original list
    currentQuestions = []; // Clear shuffled list
    localStorage.removeItem('quizState'); // Clear saved progress on manual restart
    startQuiz(); // Restart with current settings (selectedWeek, currentMode)
}


// --- Global Event Listener for Saving State ---
// Example: Save state when the user is about to leave the page
window.addEventListener('beforeunload', saveState);


// --- Start the application ---
initializeQuiz();
