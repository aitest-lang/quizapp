// --- DOM Elements ---
const weekSelect = document.getElementById('week-select');
const modeLearnButton = document.getElementById('mode-learn');
const modeRepeatButton = document.getElementById('mode-repeat');
const restartButton = document.getElementById('restart-button');
const themeToggle = document.getElementById('theme-toggle');
const questionContainer = document.getElementById('question-container');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackArea = document.getElementById('feedback-area'); // Optional, can style buttons directly
const repetitionProgress = document.getElementById('repetition-progress');
const nextButton = document.getElementById('next-button');
const completionArea = document.getElementById('completion-area');
const completionMessage = document.getElementById('completion-message');

// --- State Variables ---
let currentQuestions = [];
let currentQuestionIndex = 0;
let selectedWeek = '';
let currentMode = 'Learning'; // 'Learning' or 'Repetition'
let score = 0; // For potential future use or just tracking correct answers
let incorrectQueue = []; // Stores indices of incorrect questions for Repetition mode
let totalErrorsInRepetition = 0; // To show progress like X/Y
let isAnswered = false; // Prevents multiple answers per question

// --- Initialization ---
function initializeQuiz() {
    loadState(); // Load saved state first
    populateWeeks();
    setupEventListeners();
    applyTheme(localStorage.getItem('quizTheme') || 'light'); // Apply saved or default theme

    // Set initial state based on loaded values or defaults
    weekSelect.value = selectedWeek || getUniqueWeeks()[0]; // Default to first week if nothing saved
    selectedWeek = weekSelect.value; // Ensure selectedWeek is set
    updateModeButtons();
    startQuiz(); // Start with the loaded/default settings
}

function populateWeeks() {
    const weeks = getUniqueWeeks(); // Assumes getUniqueWeeks() is in questions.js [1]
    weeks.forEach(week => {
        const option = document.createElement('option');
        option.value = week;
        option.textContent = week === 'other' ? 'Other' : `Week ${week}`;
        weekSelect.appendChild(option);
    });
    // Ensure the loaded week is selected if available
    if (selectedWeek && weeks.includes(selectedWeek)) {
        weekSelect.value = selectedWeek;
    } else if (weeks.length > 0) {
        selectedWeek = weeks[0]; // Default to the first week
        weekSelect.value = selectedWeek;
    }
}

function setupEventListeners() {
    weekSelect.addEventListener('change', handleWeekChange);
    modeLearnButton.addEventListener('click', () => switchMode('Learning'));
    modeRepeatButton.addEventListener('click', () => switchMode('Repetition'));
    restartButton.addEventListener('click', restartQuiz);
    nextButton.addEventListener('click', handleNextQuestion);
    themeToggle.addEventListener('click', toggleTheme);
}

// --- State Management (localStorage) ---
function saveState() {
    const state = {
        selectedWeek,
        currentMode,
        currentQuestionIndex,
        incorrectQueue,
        totalErrorsInRepetition,
        // score // Optional
    };
    localStorage.setItem('quizState', JSON.stringify(state));
}

function loadState() {
    const savedState = localStorage.getItem('quizState');
    if (savedState) {
        const state = JSON.parse(savedState);
        selectedWeek = state.selectedWeek || '';
        currentMode = state.currentMode || 'Learning';
        // Only load index/queue if the week matches, otherwise reset
        if (state.selectedWeek === weekSelect.value) {
            currentQuestionIndex = state.currentQuestionIndex || 0;
            incorrectQueue = state.incorrectQueue || [];
            totalErrorsInRepetition = state.totalErrorsInRepetition || 0;
        } else {
             // Reset progress if week is different
             currentQuestionIndex = 0;
             incorrectQueue = [];
             totalErrorsInRepetition = 0;
        }
        // score = state.score || 0; // Optional
    } else {
        // Default values if no saved state
        selectedWeek = weekSelect.value || getUniqueWeeks()[0];
        currentMode = 'Learning';
        currentQuestionIndex = 0;
        incorrectQueue = [];
        totalErrorsInRepetition = 0;
    }
}

// --- Theme Handling ---
function applyTheme(theme) {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('quizTheme', theme);
    // Update icon based on theme (optional)
    themeToggle.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';

}

function toggleTheme() {
    const currentTheme = document.body.classList.contains('dark-theme') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}


// --- Core Quiz Logic ---
function startQuiz() {
    // Filter questions based on selected week
    const weekValue = isNaN(parseInt(selectedWeek)) ? selectedWeek : parseInt(selectedWeek);
    currentQuestions = allQuestions.filter(q => q.week === weekValue); [1]

    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;

    completionArea.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    nextButton.classList.add('hidden');
    repetitionProgress.textContent = ''; // Clear progress text

    if (currentQuestions.length > 0) {
        displayQuestion();
    } else {
        questionText.textContent = "No questions found for this selection.";
        optionsContainer.innerHTML = "";
    }
    saveState(); // Save the initial state for the new quiz
}

function displayQuestion() {
    isAnswered = false;
    feedbackArea.textContent = ''; // Clear previous feedback
    nextButton.classList.add('hidden'); // Hide next button initially

    // Smooth transition
    questionContainer.classList.add('fade-out');

    setTimeout(() => {
        let questionToShow;
        if (currentMode === 'Repetition' && incorrectQueue.length > 0 && totalErrorsInRepetition > 0) {
            // Retry phase: get question from incorrectQueue
            const incorrectIndex = incorrectQueue[currentQuestionIndex % incorrectQueue.length]; // Cycle through queue
            questionToShow = currentQuestions[incorrectIndex];
            displayRepetitionProgress();
        } else {
            // Learning mode or first pass of Repetition mode
            questionToShow = currentQuestions[currentQuestionIndex];
            repetitionProgress.textContent = ''; // No progress needed here
        }

        if (!questionToShow) {
            // Should not happen if logic is correct, but handle gracefully
             showCompletion();
             return;
        }

        questionText.textContent = questionToShow.question;
        optionsContainer.innerHTML = ""; // Clear previous options

        // --- Shuffle options (optional but recommended) ---
        const options = [...questionToShow.options]; // Create a copy
        // Simple Fisher-Yates shuffle:
        for (let i = options.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [options[i], options[j]] = [options[j], options[i]];
        }
        // --- End Shuffle ---

        options.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.classList.add('option-button');
            button.addEventListener('click', () => handleOptionClick(optionText, button, questionToShow.correctAnswer));
            optionsContainer.appendChild(button);
        });

        // Fade in the new question
        questionContainer.classList.remove('fade-out');

    }, 400); // Match timeout with CSS transition duration
}

function handleOptionClick(selectedOptionText, button, correctAnswer) {
    if (isAnswered) return; // Prevent multiple clicks
    isAnswered = true;

    const isCorrect = selectedOptionText === correctAnswer;

    // Disable all buttons
    Array.from(optionsContainer.children).forEach(btn => {
        btn.disabled = true;
         // Highlight correct answer regardless for learning purposes
        if (btn.textContent === correctAnswer) {
             btn.classList.add('correct'); // Always show correct in green
        }
    });

    if (currentMode === 'Learning') {
        handleLearningModeAnswer(isCorrect, button, correctAnswer);
        nextButton.classList.remove('hidden'); // Show next button after answer
    } else { // Repetition Mode
        handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer);
        // Automatically move to next question in Repetition mode after a short delay
        setTimeout(handleNextQuestion, 1000); // Adjust delay as needed
    }

    saveState(); // Save progress after each answer
}

function handleLearningModeAnswer(isCorrect, selectedButton, correctAnswer) {
     if (isCorrect) {
        // Already marked as correct by the generic highlighting
        // feedbackArea.textContent = 'Correct!'; // Optional text feedback
        selectedButton.classList.add('correct'); // Ensure selected is marked (redundant if highlighting all correct)
        score++;
    } else {
        selectedButton.classList.add('incorrect'); // Mark selected incorrect button
        // feedbackArea.textContent = `Incorrect. Correct answer: ${correctAnswer}`; // Optional text feedback
    }
}

function handleRepetitionModeAnswer(isCorrect, selectedOptionText, correctAnswer) {
    // In Repetition mode, only track incorrect answers during the first pass
    // Or handle removal during retry phase
    if (totalErrorsInRepetition === 0) { // First pass
        if (!isCorrect) {
            if (!incorrectQueue.includes(currentQuestionIndex)) { // Avoid duplicates if somehow possible
                 incorrectQueue.push(currentQuestionIndex);
            }
        }
    } else { // Retry phase
        if (isCorrect) {
            // Remove the *correctly answered* question's original index from the queue
            const originalIndexToRemove = incorrectQueue[currentQuestionIndex % incorrectQueue.length];
            incorrectQueue = incorrectQueue.filter(index => index !== originalIndexToRemove);
            // Adjust index if removal affects the current position in the cycling queue (tricky!)
            // Simpler approach: Don't adjust index now, just let it cycle. The queue length change handles progress.
        } else {
             // Add shake effect to the selected wrong button during retry for visual feedback
             const selectedButton = Array.from(optionsContainer.children).find(btn => btn.textContent === selectedOptionText);
             if(selectedButton) {
                 selectedButton.classList.add('incorrect'); // Briefly show it's wrong
                 // Optional: Remove 'incorrect' class after animation if desired
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
            // No index increment needed here as we use modulo on the queue length
            // Just need to trigger redisplay which happens in displayQuestion
             displayQuestion(); // Display next question from the remaining queue
        }
    } else {
        // Learning Mode or First Pass Repetition Mode Logic
        currentQuestionIndex++;
        if (currentQuestionIndex < currentQuestions.length) {
            displayQuestion();
        } else {
            // End of Learning mode or first pass of Repetition mode
            if (currentMode === 'Repetition' && incorrectQueue.length > 0) {
                // Start the retry phase
                totalErrorsInRepetition = incorrectQueue.length;
                currentQuestionIndex = 0; // Reset index for cycling through the queue
                displayQuestion();
            } else {
                showCompletion(); // Quiz finished
            }
        }
    }
     saveState(); // Save state when moving to next question or phase
}

function displayRepetitionProgress() {
    if (currentMode === 'Repetition' && totalErrorsInRepetition > 0) {
        repetitionProgress.textContent = `Remaining retries: ${incorrectQueue.length} / ${totalErrorsInRepetition}`;
    } else {
        repetitionProgress.textContent = '';
    }
}

function showCompletion() {
    questionContainer.classList.add('hidden');
    completionArea.classList.remove('hidden');
    let message = '';
    if (currentMode === 'Learning') {
        // Simple completion message for learning mode
        message = `You finished the ${selectedWeek === 'other' ? 'Other' : 'Week ' + selectedWeek} questions!`;
    } else { // Repetition Mode
         if (totalErrorsInRepetition === 0 && incorrectQueue.length === 0) {
             message = `Excellent! You've mastered all questions for ${selectedWeek === 'other' ? 'Other' : 'Week ' + selectedWeek}!`;
             // Trigger confetti animation here if implemented
         } else {
              message = `You completed the first pass for ${selectedWeek === 'other' ? 'Other' : 'Week ' + selectedWeek}. Now retrying ${totalErrorsInRepetition} incorrect questions.`;
              // This message might be briefly shown before the retry phase starts,
              // or handled directly within handleNextQuestion logic. Let's assume completion means fully done.
               message = `Excellent! You've mastered all questions for ${selectedWeek === 'other' ? 'Other' : 'Week ' + selectedWeek}!`;
               // Trigger confetti animation
         }
    }
    completionMessage.textContent = message;
    // Clear saved progress for this week upon successful completion
    localStorage.removeItem('quizState'); // Or selectively clear parts related to progress
}

function handleWeekChange(event) {
    selectedWeek = event.target.value;
    // Reset progress and start quiz for the new week
    restartQuiz(); // Restarting clears state and starts fresh for the new week
}

function switchMode(newMode) {
    if (currentMode !== newMode) {
        currentMode = newMode;
        updateModeButtons();
        restartQuiz(); // Switching mode restarts the quiz for the current week
    }
}

function updateModeButtons() {
    if (currentMode === 'Learning') {
        modeLearnButton.classList.add('active');
        modeRepeatButton.classList.remove('active');
    } else {
        modeLearnButton.classList.remove('active');
        modeRepeatButton.classList.add('active');
    }
}

function restartQuiz() {
    // Clear relevant state but keep selected week and mode
    currentQuestionIndex = 0;
    score = 0;
    incorrectQueue = [];
    totalErrorsInRepetition = 0;
    isAnswered = false;
    localStorage.removeItem('quizState'); // Clear saved progress on manual restart
    startQuiz(); // Restart with current settings
}


// --- Start the application ---
initializeQuiz();
