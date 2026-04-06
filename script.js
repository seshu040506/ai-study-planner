/**
 * AI-Based Study Planner - Main Script
 * A smart study scheduling system with rule-based AI logic
 */

// ======================= CONSTANTS =======================
const STORAGE_KEYS = {
    SUBJECTS: 'studyPlanner_subjects',
    SCHEDULE: 'studyPlanner_schedule',
    PROGRESS: 'studyPlanner_progress',
    THEME: 'studyPlanner_theme'
};

const DIFFICULTY_WEIGHTS = {
    easy: 1,
    medium: 1.5,
    hard: 2
};

const PRIORITY_WEIGHTS = {
    low: 1,
    medium: 1.5,
    high: 2.5
};

const MIN_HOURS_PER_SUBJECT = 1;
const MAX_HOURS_PER_DAY = 8;
const DEFAULT_HOURS_PER_WEEK = 10;

// ======================= STATE MANAGEMENT =======================
let appState = {
    subjects: [],
    schedule: {},
    progress: {},
    currentDateIndex: 0,
    theme: localStorage.getItem(STORAGE_KEYS.THEME) || 'light'
};

// ======================= INITIALIZATION =======================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadDataFromStorage();
    applyTheme(appState.theme);
});

/**
 * Initialize the application
 */
function initializeApp() {
    console.log('Initializing Study Planner App...');
    
    // Set minimum exam date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('examDate').setAttribute('min', today);
    
    // Initialize localStorage data if not exists
    if (!localStorage.getItem(STORAGE_KEYS.SUBJECTS)) {
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.PROGRESS)) {
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({}));
    }
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => navigateSection(e.target.dataset.section));
    });

    // Form
    document.getElementById('addSubjectForm').addEventListener('submit', handleAddSubject);
    document.getElementById('searchSubject').addEventListener('input', handleSearchSubject);

    // Plan Generation
    document.getElementById('generatePlanBtn').addEventListener('click', handleGeneratePlan);

    // Schedule Navigation
    document.getElementById('prevDay').addEventListener('click', () => navigateDay(-1));
    document.getElementById('nextDay').addEventListener('click', () => navigateDay(1));

    // Theme Toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Reset Button
    document.getElementById('resetBtn').addEventListener('click', handleReset);
}

// ======================= THEME MANAGEMENT =======================
/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
    const newTheme = appState.theme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    appState.theme = newTheme;
    localStorage.setItem(STORAGE_KEYS.THEME, newTheme);
}

/**
 * Apply the selected theme
 */
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('themeToggle');
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ======================= NAVIGATION =======================
/**
 * Navigate between sections
 */
function navigateSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
    
    // Remove active from all nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    
    // Show selected section
    document.getElementById(sectionId).classList.add('active');
    
    // Mark nav button as active
    document.querySelector(`[data-section="${sectionId}"]`).classList.add('active');
    
    // Update view based on section
    if (sectionId === 'daily-schedule') {
        appState.currentDateIndex = 0;
        displayDailySchedule();
    } else if (sectionId === 'progress') {
        displayProgress();
    }
}

// ======================= SUBJECT MANAGEMENT =======================
/**
 * Handle adding a new subject
 */
function handleAddSubject(e) {
    e.preventDefault();

    const subject = {
        id: Date.now(),
        name: document.getElementById('subjectName').value.trim(),
        difficulty: document.getElementById('difficulty').value,
        priority: document.getElementById('priority').value,
        examDate: document.getElementById('examDate').value,
        hoursPerWeek: parseInt(document.getElementById('hoursPerWeek').value) || DEFAULT_HOURS_PER_WEEK,
        createdAt: new Date().toISOString()
    };

    // Validation
    if (!subject.name) {
        showToast('Please enter a subject name', 'error');
        return;
    }

    // Add to state and save
    appState.subjects.push(subject);
    saveSubjectsToStorage();

    // Reset form and update UI
    e.target.reset();
    displaySubjects();
    showToast(`✅ Subject "${subject.name}" added successfully!`, 'success');
}

/**
 * Display all subjects in the list
 */
function displaySubjects(searchTerm = '') {
    const subjectsList = document.getElementById('subjectsList');
    
    if (appState.subjects.length === 0) {
        subjectsList.innerHTML = '<div class="empty-state"><p>No subjects added yet. Add your first subject to get started!</p></div>';
        return;
    }

    // Filter subjects based on search term
    const filteredSubjects = appState.subjects.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filteredSubjects.length === 0) {
        subjectsList.innerHTML = '<div class="empty-state"><p>No subjects match your search.</p></div>';
        return;
    }

    subjectsList.innerHTML = filteredSubjects.map(subject => {
        const daysLeft = calculateDaysLeft(subject.examDate);
        const urgency = getUrgency(daysLeft);
        
        return `
            <div class="card">
                <div class="card-header">
                    <div>
                        <h3 class="card-title">${escapeHtml(subject.name)}</h3>
                        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                            <span class="card-badge badge-${subject.difficulty}">${capitalize(subject.difficulty)}</span>
                            <span class="card-badge badge-${subject.priority}">${capitalize(subject.priority)} Priority</span>
                            <span class="card-badge ${urgency.className}">${urgency.label}</span>
                        </div>
                    </div>
                </div>
                <div class="subject-info">
                    <div class="info-item">
                        <div class="info-label">Exam Date</div>
                        ${formatDate(subject.examDate)}
                    </div>
                    <div class="info-item">
                        <div class="info-label">Days Left</div>
                        <strong>${daysLeft} days</strong>
                    </div>
                    <div class="info-item">
                        <div class="info-label">Hours/Week</div>
                        ${subject.hoursPerWeek} hours
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn btn-secondary btn-sm" onclick="editSubject(${subject.id})">✏️ Edit</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteSubject(${subject.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Handle search subjects
 */
function handleSearchSubject(e) {
    displaySubjects(e.target.value);
}

/**
 * Delete a subject
 */
function deleteSubject(id) {
    if (confirm('Are you sure you want to delete this subject?')) {
        const subject = appState.subjects.find(s => s.id === id);
        appState.subjects = appState.subjects.filter(s => s.id !== id);
        saveSubjectsToStorage();
        displaySubjects();
        showToast(`✅ Subject "${subject.name}" deleted`, 'success');
    }
}

/**
 * Edit a subject (placeholder - can be extended)
 */
function editSubject(id) {
    showToast('Edit feature: Select subject and modify values manually', 'info');
}

// ======================= SMART SCHEDULE GENERATION =======================
/**
 * Handle generating a study plan using AI-like logic
 */
function handleGeneratePlan() {
    if (appState.subjects.length === 0) {
        showAlert('No subjects to plan!', 'planError');
        showToast('Add subjects first to generate a study plan', 'error');
        return;
    }

    const plan = generateSmartSchedule();
    
    if (!plan) {
        showAlert('Cannot generate plan. Please check your subjects.', 'planError');
        return;
    }

    appState.schedule = plan;
    saveScheduleToStorage();

    // Display summary
    displayPlanSummary(plan);
    displayAISuggestions(plan);
    
    showAlert('', 'planGenerated');
    showToast('🧠 Intelligent study plan generated!', 'success');
    appState.currentDateIndex = 0;
}

/**
 * Generate an intelligent study schedule based on:
 * - Days remaining
 * - Difficulty level
 * - Priority
 * - Time available
 */
function generateSmartSchedule() {
    if (appState.subjects.length === 0) return null;

    const schedule = {};
    const now = new Date();
    
    // Calculate exam window
    let minDate = now;
    let maxDate = now;
    let totalDays = 0;

    appState.subjects.forEach(subject => {
        const examDate = new Date(subject.examDate);
        if (examDate < minDate) minDate = examDate;
        if (examDate > maxDate) maxDate = examDate;
    });

    totalDays = Math.ceil((maxDate - now) / (1000 * 60 * 60 * 24));

    if (totalDays <= 0) {
        alert('⚠️ All exam dates are in the past! Please update exam dates.');
        return null;
    }

    // Initialize schedule for each day
    const currentDate = new Date(now);
    for (let i = 0; i <= totalDays; i++) {
        const dateStr = currentDate.toISOString().split('T')[0];
        schedule[dateStr] = [];
        currentDate.setDate(currentDate.getDate() + 1);
    }

    // Calculate study hours for each subject
    const subjectHours = appState.subjects.map(subject => {
        const daysUntilExam = calculateDaysLeft(subject.examDate);
        
        // Smart calculation based on:
        // 1. Difficulty weight
        // 2. Priority weight
        // 3. Days remaining (inverse relationship)
        const baseHours = subject.hoursPerWeek;
        const difficultyMultiplier = DIFFICULTY_WEIGHTS[subject.difficulty];
        const priorityMultiplier = PRIORITY_WEIGHTS[subject.priority];
        const urgencyMultiplier = daysUntilExam < 5 ? 2 : daysUntilExam < 10 ? 1.5 : 1;
        
        const totalHours = baseHours * difficultyMultiplier * priorityMultiplier * urgencyMultiplier;

        return {
            ...subject,
            calculatedHours: totalHours,
            daysUntilExam,
            urgencyMultiplier
        };
    });

    // Sort by urgency (exams sooner) and priority
    subjectHours.sort((a, b) => {
        if (a.daysUntilExam !== b.daysUntilExam) {
            return a.daysUntilExam - b.daysUntilExam;
        }
        return PRIORITY_WEIGHTS[b.priority] - PRIORITY_WEIGHTS[a.priority];
    });

    // Distribute hours across days
    const scheduleMap = new Map();

    subjectHours.forEach(subject => {
        const examDate = new Date(subject.examDate);
        const startDate = new Date(now);
        let hoursToAllocate = subject.calculatedHours;
        let daysProcessed = 0;

        // Allocate study hours day by day until exam date
        const currentDay = new Date(startDate);
        
        while (hoursToAllocate > 0 && currentDay <= examDate) {
            const dateStr = currentDay.toISOString().split('T')[0];
            
            if (schedule[dateStr] === undefined) {
                currentDay.setDate(currentDay.getDate() + 1);
                continue;
            }

            // Calculate how many hours to allocate today
            const dailyHours = Math.min(hoursToAllocate, MAX_HOURS_PER_DAY);
            const dailyLoad = schedule[dateStr].reduce((sum, task) => sum + task.hours, 0);

            // Don't overload a day
            if (dailyLoad < MAX_HOURS_PER_DAY) {
                const availableHours = Math.min(MAX_HOURS_PER_DAY - dailyLoad, dailyHours);
                
                if (availableHours >= MIN_HOURS_PER_SUBJECT) {
                    schedule[dateStr].push({
                        subjectId: subject.id,
                        subjectName: subject.name,
                        hours: availableHours,
                        difficulty: subject.difficulty,
                        priority: subject.priority,
                        examDate: subject.examDate
                    });
                    hoursToAllocate -= availableHours;
                }
            }

            currentDay.setDate(currentDay.getDate() + 1);
            daysProcessed++;

            if (daysProcessed > 365) break; // Safety check
        }
    });

    return schedule;
}

/**
 * Display plan summary statistics
 */
function displayPlanSummary(plan) {
    const dates = Object.keys(plan).sort();
    const totalTasks = dates.reduce((sum, date) => sum + plan[date].length, 0);
    const totalHours = dates.reduce((sum, date) => 
        sum + plan[date].reduce((daySum, task) => daySum + task.hours, 0), 0
    );
    const workingDays = dates.filter(date => plan[date].length > 0).length;

    document.getElementById('totalSubjects').textContent = appState.subjects.length;
    document.getElementById('daysAvailable').textContent = dates.length;
    document.getElementById('totalHours').textContent = totalHours.toFixed(1);
    document.getElementById('dailyAverage').textContent = 
        (workingDays > 0 ? (totalHours / workingDays).toFixed(1) : 0) + 'h';

    document.getElementById('planSummary').style.display = 'block';
}

/**
 * Display AI suggestions based on plan analysis
 */
function displayAISuggestions(plan) {
    const suggestions = generateAISuggestions(plan);
    const suggestionsList = document.getElementById('suggestionsList');

    suggestionsList.innerHTML = suggestions.map(suggestion => 
        `<div class="suggestion-item">${suggestion}</div>`
    ).join('');

    document.getElementById('aiSuggestions').style.display = 'block';
}

/**
 * Generate intelligent suggestions based on the study plan
 */
function generateAISuggestions(plan) {
    const suggestions = [];
    const dates = Object.keys(plan).sort();
    
    // Analyze plan and generate suggestions
    const totalHours = dates.reduce((sum, date) => 
        sum + plan[date].reduce((daySum, task) => daySum + task.hours, 0), 0
    );
    const avgHoursPerDay = totalHours / dates.length;

    if (avgHoursPerDay > 6) {
        suggestions.push('💪 Your study plan is intensive. Make sure to take regular breaks and rest well.');
    } else if (avgHoursPerDay < 2) {
        suggestions.push('⏰ Consider allocating more study hours to prepare adequately for your exams.');
    }

    // Check for subjects with upcoming exams
    const urgentSubjects = appState.subjects.filter(s => calculateDaysLeft(s.examDate) < 7);
    if (urgentSubjects.length > 0) {
        suggestions.push(`⚠️ Focus on ${urgentSubjects.map(s => s.name).join(', ')} - exams are coming up soon!`);
    }

    // Check for balanced distribution
    const subjectsWithoutSchedule = appState.subjects.filter(subject => {
        return !dates.some(date => plan[date].some(task => task.subjectId === subject.id));
    });

    if (subjectsWithoutSchedule.length > 0) {
        suggestions.push(`📚 Add study sessions for: ${subjectsWithoutSchedule.map(s => s.name).join(', ')}`);
    }

    // Difficulty-based suggestions
    const hardSubjects = appState.subjects.filter(s => s.difficulty === 'hard');
    if (hardSubjects.length > 0) {
        suggestions.push(`⭐ Allocate extra time to difficult subjects: ${hardSubjects.map(s => s.name).join(', ')}`);
    }

    // High priority subjects
    const highPriority = appState.subjects.filter(s => s.priority === 'high');
    if (highPriority.length > 0) {
        suggestions.push(`🎯 High priority: ${highPriority.map(s => s.name).join(', ')} - Give these your best effort!`);
    }

    // Weekend study
    const weekendStudyHours = dates
        .filter(date => {
            const dayOfWeek = new Date(date).getDay();
            return dayOfWeek === 0 || dayOfWeek === 6;
        })
        .reduce((sum, date) => sum + plan[date].reduce((daySum, task) => daySum + task.hours, 0), 0);

    if (weekendStudyHours < totalHours * 0.2) {
        suggestions.push('📅 Consider including some weekend study sessions for better coverage.');
    }

    if (suggestions.length === 0) {
        suggestions.push('✅ Your study plan looks well-balanced! Stick to the schedule and you\'ll do great!');
    }

    return suggestions;
}

// ======================= SCHEDULE DISPLAY =======================
/**
 * Display daily schedule
 */
function displayDailySchedule() {
    const scheduleContainer = document.getElementById('scheduleContainer');
    const dates = Object.keys(appState.schedule).sort();

    if (dates.length === 0) {
        scheduleContainer.innerHTML = '<div class="empty-state"><p>No schedule generated yet. Go to "Generate Plan" section first.</p></div>';
        return;
    }

    // Get current date to display
    const today = new Date();
    const currentDate = new Date(today);
    currentDate.setDate(today.getDate() + appState.currentDateIndex);
    const dateStr = currentDate.toISOString().split('T')[0];

    // Update date display
    document.getElementById('dateDisplay').textContent = formatDateFull(dateStr);

    const tasks = appState.schedule[dateStr] || [];

    // Update navigation buttons
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    document.getElementById('prevDay').disabled = currentDate <= firstDate;
    document.getElementById('nextDay').disabled = currentDate >= lastDate;

    if (tasks.length === 0) {
        scheduleContainer.innerHTML = '<div class="empty-state"><p>No study sessions scheduled for this day. Take a break! 🎉</p></div>';
        return;
    }

    // Display tasks
    const dailyTotal = tasks.reduce((sum, task) => sum + task.hours, 0);
    const urgeentTasks = tasks.filter(task => new Date(task.examDate) - currentDate <= 7 * 24 * 60 * 60 * 1000);

    scheduleContainer.innerHTML = `
        <div class="daily-tasks">
            <h3 style="margin-bottom: 16px; color: var(--text-primary);">
                📚 Study Tasks - ${tasks.length} session(s) • ${dailyTotal}h total
            </h3>
            ${tasks.map((task, index) => {
                const isCompleted = isTaskCompleted(dateStr, index);
                const isUrgent = new Date(task.examDate) - currentDate <= 5 * 24 * 60 * 60 * 1000;
                
                return `
                    <div class="task-item ${isCompleted ? 'completed' : ''} ${isUrgent ? 'urgent' : ''}">
                        <div class="task-header">
                            <span class="task-checkbox" onclick="toggleTaskCompletion('${dateStr}', ${index})" style="cursor: pointer;">
                                ${isCompleted ? '✅' : '⭕'}
                            </span>
                            <span class="task-subject">${escapeHtml(task.subjectName)}</span>
                            <span class="task-time">⏱️ ${task.hours}h</span>
                            <span class="card-badge badge-${task.difficulty}">${capitalize(task.difficulty)}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;

    // Display urgent tasks warning
    if (urgeentTasks.length > 0) {
        const urgentHtml = urgeentTasks.map(task => 
            `<div class="urgent-item">⚠️ <strong>${escapeHtml(task.subjectName)}</strong> - Exam on ${formatDate(task.examDate)}</div>`
        ).join('');
        document.getElementById('urgentList').innerHTML = urgentHtml;
        document.getElementById('urgentTasks').style.display = 'block';
    } else {
        document.getElementById('urgentTasks').style.display = 'none';
    }
}

/**
 * Navigate between days
 */
function navigateDay(direction) {
    appState.currentDateIndex += direction;
    displayDailySchedule();
}

/**
 * Toggle task completion
 */
function toggleTaskCompletion(date, taskIndex) {
    const key = `${date}_${taskIndex}`;
    let progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS)) || {};

    if (progress[key]) {
        delete progress[key];
        showToast('Task marked as incomplete', 'info');
    } else {
        progress[key] = {
            completed: true,
            completedAt: new Date().toISOString()
        };
        showToast('✅ Great job! Task marked as completed!', 'success');
    }

    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    displayDailySchedule();
    displayProgress();
}

/**
 * Check if a task is completed
 */
function isTaskCompleted(date, taskIndex) {
    const key = `${date}_${taskIndex}`;
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS)) || {};
    return !!progress[key];
}

// ======================= PROGRESS TRACKING =======================
/**
 * Display progress tracker
 */
function displayProgress() {
    const dates = Object.keys(appState.schedule).sort();
    const progress = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROGRESS)) || {};
    
    if (dates.length === 0) {
        document.getElementById('progressOverall').style.display = 'none';
        document.getElementById('progressList').innerHTML = '<div class="empty-state"><p>No subjects to track yet. Add subjects first.</p></div>';
        return;
    }

    // Calculate overall progress
    let totalTasks = 0;
    let completedTasks = 0;

    dates.forEach(date => {
        appState.schedule[date].forEach((task, index) => {
            totalTasks++;
            const key = `${date}_${index}`;
            if (progress[key]) {
                completedTasks++;
            }
        });
    });

    const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Display overall progress
    document.getElementById('overallProgressFill').style.width = overallProgress + '%';
    document.getElementById('overallProgressText').textContent = Math.round(overallProgress) + '%';
    document.getElementById('motivationalMessage').textContent = getMotivationalMessage(overallProgress);
    document.getElementById('progressOverall').style.display = 'block';

    // Display per-subject progress
    const subjectProgress = [];
    appState.subjects.forEach(subject => {
        let subjectTasks = 0;
        let subjectCompleted = 0;

        dates.forEach(date => {
            appState.schedule[date].forEach((task, index) => {
                if (task.subjectId === subject.id) {
                    subjectTasks++;
                    const key = `${date}_${index}`;
                    if (progress[key]) {
                        subjectCompleted++;
                    }
                }
            });
        });

        if (subjectTasks > 0) {
            const percentage = (subjectCompleted / subjectTasks) * 100;
            subjectProgress.push({
                ...subject,
                completed: subjectCompleted,
                total: subjectTasks,
                percentage: percentage
            });
        }
    });

    // Display progress items
    if (subjectProgress.length === 0) {
        document.getElementById('progressList').innerHTML = '<div class="empty-state"><p>No study sessions scheduled yet.</p></div>';
    } else {
        document.getElementById('progressList').innerHTML = subjectProgress.map(item => `
            <div class="progress-item">
                <div class="progress-item-header">
                    <div class="progress-item-title">${escapeHtml(item.name)}</div>
                    <div class="progress-item-status">${item.completed}/${item.total} sessions</div>
                </div>
                <div class="progress-bar-container">
                    <div class="progress-fill" style="width: ${item.percentage}%"></div>
                    <span class="progress-text">${Math.round(item.percentage)}%</span>
                </div>
            </div>
        `).join('');
    }

    // Display completed subjects
    const completedSubjects = subjectProgress.filter(item => item.completed === item.total);
    if (completedSubjects.length > 0) {
        document.getElementById('completedList').innerHTML = completedSubjects.map(item => `
            <div class="completed-item">
                <div class="completed-item-title">✅ ${escapeHtml(item.name)}</div>
                <div class="completed-date">All ${item.total} sessions completed! Exam: ${formatDate(item.examDate)}</div>
            </div>
        `).join('');
        document.getElementById('completedSubjects').style.display = 'block';
    } else {
        document.getElementById('completedSubjects').style.display = 'none';
    }
}

/**
 * Get motivational message based on progress
 */
function getMotivationalMessage(progress) {
    if (progress === 0) return '🚀 Start strong! Complete your first session today!';
    if (progress < 25) return '💪 Great start! Keep the momentum going!';
    if (progress < 50) return '🔥 You\'re on fire! Keep it up!';
    if (progress < 75) return '⭐ You\'re crushing it! Almost there!';
    if (progress < 100) return '🎯 Just a bit more! You\'ve got this!';
    return '🏆 Congratulations! You\'ve completed all sessions!';
}

// ======================= UTILITY FUNCTIONS =======================
/**
 * Calculate days left until exam date
 */
function calculateDaysLeft(examDate) {
    const exam = new Date(examDate);
    const now = new Date();
    const diffTime = exam - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(diffDays, 0);
}

/**
 * Get urgency label and class
 */
function getUrgency(daysLeft) {
    if (daysLeft <= 3) return { label: 'URGENT', className: 'card-badge' };
    if (daysLeft <= 7) return { label: 'SOON', className: 'card-badge' };
    if (daysLeft <= 14) return { label: 'UPCOMING', className: 'card-badge' };
    return { label: 'PLANNED', className: 'card-badge' };
}

/**
 * Format date to readable format
 */
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Format date with day name
 */
function formatDateFull(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Capitalize string
 */
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * Show alert in specific section
 */
function showAlert(message, elementId) {
    const element = document.getElementById(elementId);
    if (message) {
        element.textContent = message;
        element.style.display = 'block';
    } else {
        element.style.display = 'none';
    }
}

// ======================= STORAGE MANAGEMENT =======================
/**
 * Save subjects to localStorage
 */
function saveSubjectsToStorage() {
    localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(appState.subjects));
}

/**
 * Save schedule to localStorage
 */
function saveScheduleToStorage() {
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(appState.schedule));
}

/**
 * Load data from localStorage
 */
function loadDataFromStorage() {
    // Load subjects
    const subjectsData = localStorage.getItem(STORAGE_KEYS.SUBJECTS);
    if (subjectsData) {
        appState.subjects = JSON.parse(subjectsData);
        displaySubjects();
    }

    // Load schedule
    const scheduleData = localStorage.getItem(STORAGE_KEYS.SCHEDULE);
    if (scheduleData) {
        appState.schedule = JSON.parse(scheduleData);
    }

    // Load progress (used by display functions)
}

/**
 * Reset the entire planner
 */
function handleReset() {
    if (confirm('⚠️ Are you sure you want to reset everything? This cannot be undone!')) {
        // Clear all data
        appState.subjects = [];
        appState.schedule = {};
        appState.progress = {};
        appState.currentDateIndex = 0;

        // Clear localStorage
        localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify([]));
        localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify({}));
        localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify({}));

        // Reset UI
        document.getElementById('addSubjectForm').reset();
        document.getElementById('searchSubject').value = '';
        displaySubjects();
        document.getElementById('planSummary').style.display = 'none';
        document.getElementById('aiSuggestions').style.display = 'none';
        document.getElementById('planGenerated').style.display = 'none';
        document.getElementById('planError').style.display = 'none';
        document.getElementById('progressOverall').style.display = 'none';
        document.getElementById('urgentTasks').style.display = 'none';
        document.getElementById('completedSubjects').style.display = 'none';

        navigateSection('add-subject');
        showToast('🔄 Study Planner has been reset!', 'info');
    }
}

console.log('✅ Study Planner App loaded successfully!');
