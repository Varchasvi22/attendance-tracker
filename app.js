document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let targetPercentage = 75;
    let subjects = [];
    let timetable = {
        'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [], 'Saturday': [], 'Sunday': []
    };
    let todayActions = {}; // { "YYYY-MM-DD": { subjectId: "present|absent|canceled" } }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // --- DOM Elements ---
    const targetInput = document.getElementById('targetInput');
    const addSubjectForm = document.getElementById('addSubjectForm');
    const subjectNameInput = document.getElementById('subjectNameInput');
    
    // Views
    const tabAllSubjects = document.getElementById('tabAllSubjects');
    const tabTodaySchedule = document.getElementById('tabTodaySchedule');
    const viewAllSubjects = document.getElementById('viewAllSubjects');
    const viewTodaySchedule = document.getElementById('viewTodaySchedule');
    
    // Containers
    const subjectsContainer = document.getElementById('subjectsContainer');
    const emptyState = document.getElementById('emptyState');
    const todayClassesContainer = document.getElementById('todayClassesContainer');
    const emptyTodayState = document.getElementById('emptyTodayState');
    const template = document.getElementById('subjectCardTemplate');
    const todayClassTemplate = document.getElementById('todayClassTemplate');
    
    // Analytics
    const analyticsContainer = document.getElementById('analyticsContainer');
    const overallPercentageText = document.getElementById('overallPercentageText');
    const overallAttended = document.getElementById('overallAttended');
    const overallTotal = document.getElementById('overallTotal');
    const safeSubjectsCount = document.getElementById('safeSubjectsCount');
    const criticalSubjectsCount = document.getElementById('criticalSubjectsCount');
    const overallProgressBar = document.getElementById('overallProgressBar');
    const overallTargetMarker = document.getElementById('overallTargetMarker');
    const analyticsTargetMarkerText = document.getElementById('analyticsTargetMarkerText');

    // Export/Import Elements
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importInput = document.getElementById('importInput');

    // Timetable Modal Elements
    const editTimetableBtn = document.getElementById('editTimetableBtn');
    const timetableModal = document.getElementById('timetableModal');
    const closeTimetableModalBtn = document.getElementById('closeTimetableModalBtn');
    const saveTimetableBtn = document.getElementById('saveTimetableBtn');
    const timetableModalContent = document.getElementById('timetableModalContent');

    const todayDayDisplay = document.getElementById('todayDayDisplay');
    const todayDateDisplay = document.getElementById('todayDateDisplay');

    // --- Initialization ---
    function init() {
        loadData();
        targetInput.value = targetPercentage;
        
        setupDateDisplays();
        render();

        // Global Event Listeners
        targetInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val < 1) val = 1;
            if (val > 100) val = 100;
            targetPercentage = val;
            saveData();
            render();
        });

        addSubjectForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = subjectNameInput.value.trim();
            if (name) {
                addSubject(name);
                subjectNameInput.value = '';
            }
        });

        exportBtn.addEventListener('click', exportData);
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', importData);

        // View Tabs
        tabAllSubjects.addEventListener('click', () => switchTab('all'));
        tabTodaySchedule.addEventListener('click', () => switchTab('today'));

        // Timetable Modal
        editTimetableBtn.addEventListener('click', openTimetableModal);
        closeTimetableModalBtn.addEventListener('click', () => timetableModal.classList.add('hidden'));
        saveTimetableBtn.addEventListener('click', saveTimetable);
    }

    function setupDateDisplays() {
        const now = new Date();
        const dayName = daysOfWeek[now.getDay()];
        todayDayDisplay.textContent = dayName;
        todayDateDisplay.textContent = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // --- Data Persistence ---
    function loadData() {
        const storedTarget = localStorage.getItem('attendanceTarget');
        if (storedTarget) targetPercentage = parseInt(storedTarget, 10);

        const storedSubjects = localStorage.getItem('attendanceSubjects');
        if (storedSubjects) {
            try {
                subjects = JSON.parse(storedSubjects);
                subjects.forEach(sub => {
                    if (sub.attended < 0) sub.attended = 0;
                    if (sub.total < 0) sub.total = 0;
                    if (sub.attended > sub.total) sub.attended = sub.total;
                    if (!sub.history) sub.history = []; // Initialize history array
                });
            } catch (e) { subjects = []; }
        }

        const storedTimetable = localStorage.getItem('attendanceTimetable');
        if (storedTimetable) {
            try { timetable = JSON.parse(storedTimetable); } catch (e) {}
        }

        const storedTodayActions = localStorage.getItem('attendanceTodayActions');
        if (storedTodayActions) {
            try { todayActions = JSON.parse(storedTodayActions); } catch (e) {}
        }
    }

    function saveData() {
        localStorage.setItem('attendanceTarget', targetPercentage.toString());
        localStorage.setItem('attendanceSubjects', JSON.stringify(subjects));
        localStorage.setItem('attendanceTimetable', JSON.stringify(timetable));
        localStorage.setItem('attendanceTodayActions', JSON.stringify(todayActions));
    }

    // --- Core Actions ---
    function addSubject(name) {
        subjects.push({
            id: Date.now().toString(),
            name: name,
            attended: 0,
            total: 0,
            history: []
        });
        saveData();
        render();
    }

    function deleteSubject(id) {
        subjects = subjects.filter(sub => sub.id !== id);
        // Clean up timetable
        for (const day in timetable) {
            timetable[day] = timetable[day].filter(subId => subId !== id);
        }
        saveData();
        render();
    }

    function resetSubject(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.attended = 0;
            subject.total = 0;
            subject.history = [];
            saveData();
            render();
        }
    }

    function recordAction(subject, type) {
        subject.history.push({
            type: type, // 'present' or 'absent'
            timestamp: Date.now()
        });
        // Keep only last 5
        if (subject.history.length > 5) {
            subject.history.shift();
        }
    }

    function markPresent(id, isTodaySchedule = false) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.attended += 1;
            subject.total += 1;
            recordAction(subject, 'present');
            
            if (isTodaySchedule) {
                const todayStr = new Date().toISOString().split('T')[0];
                if (!todayActions[todayStr]) todayActions[todayStr] = {};
                todayActions[todayStr][id] = 'present';
            }
            saveData();
            render();
        }
    }

    function markAbsent(id, isTodaySchedule = false) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.total += 1;
            recordAction(subject, 'absent');
            
            if (isTodaySchedule) {
                const todayStr = new Date().toISOString().split('T')[0];
                if (!todayActions[todayStr]) todayActions[todayStr] = {};
                todayActions[todayStr][id] = 'absent';
            }
            saveData();
            render();
        }
    }
    
    function markCanceled(id) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!todayActions[todayStr]) todayActions[todayStr] = {};
        todayActions[todayStr][id] = 'canceled';
        saveData();
        renderTodaySchedule();
    }

    function undoLastAction(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject && subject.history && subject.history.length > 0) {
            const lastAction = subject.history.pop();
            if (lastAction.type === 'present' && subject.attended > 0 && subject.total > 0) {
                subject.attended -= 1;
                subject.total -= 1;
            } else if (lastAction.type === 'absent' && subject.total > subject.attended) {
                subject.total -= 1;
            }
            saveData();
            render();
        }
    }

    // --- Export / Import ---
    function exportData() {
        const data = {
            targetPercentage, subjects, timetable, todayActions,
            timestamp: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const parsed = JSON.parse(event.target.result);
                if (parsed && typeof parsed.targetPercentage === 'number' && Array.isArray(parsed.subjects)) {
                    if (confirm("Restore data? This will overwrite your current attendance records.")) {
                        targetPercentage = parsed.targetPercentage;
                        targetInput.value = targetPercentage;
                        subjects = parsed.subjects.map(sub => ({
                            id: sub.id || Date.now().toString() + Math.random(),
                            name: sub.name || "Unknown Subject",
                            attended: Math.max(0, parseInt(sub.attended) || 0),
                            total: Math.max(0, parseInt(sub.total) || 0),
                            history: Array.isArray(sub.history) ? sub.history : []
                        }));
                        subjects.forEach(sub => { if (sub.attended > sub.total) sub.attended = sub.total; });
                        timetable = parsed.timetable || { 'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [], 'Saturday': [], 'Sunday': [] };
                        todayActions = parsed.todayActions || {};
                        saveData();
                        render();
                    }
                } else alert("Invalid backup format.");
            } catch (err) { alert("Error reading backup file."); }
            importInput.value = "";
        };
        reader.readAsText(file);
    }

    // --- UI Helpers ---
    function switchTab(tab) {
        if (tab === 'all') {
            tabAllSubjects.classList.replace('text-gray-500', 'text-indigo-600');
            tabAllSubjects.classList.replace('border-transparent', 'border-indigo-600');
            tabTodaySchedule.classList.replace('text-indigo-600', 'text-gray-500');
            tabTodaySchedule.classList.replace('border-indigo-600', 'border-transparent');
            viewAllSubjects.classList.remove('hidden');
            viewTodaySchedule.classList.add('hidden');
        } else {
            tabTodaySchedule.classList.replace('text-gray-500', 'text-indigo-600');
            tabTodaySchedule.classList.replace('border-transparent', 'border-indigo-600');
            tabAllSubjects.classList.replace('text-indigo-600', 'text-gray-500');
            tabAllSubjects.classList.replace('border-indigo-600', 'border-transparent');
            viewTodaySchedule.classList.remove('hidden');
            viewAllSubjects.classList.add('hidden');
            renderTodaySchedule();
        }
    }

    // --- Math & Advice Logic ---
    function getStatusClass(percentage, total) {
        if (total === 0) return { bg: 'bg-gray-100', text: 'text-gray-600', progress: 'bg-gray-400', label: 'No Data' };
        if (percentage >= targetPercentage) return { bg: 'bg-emerald-100', text: 'text-emerald-700', progress: 'bg-emerald-500', label: 'Safe' };
        return { bg: 'bg-rose-100', text: 'text-rose-700', progress: 'bg-rose-500', label: 'Warning' };
    }

    function calculateAdvice(attended, total, target) {
        if (total === 0) return { message: `Attend classes to see your status.` };
        const currentPct = (attended / total) * 100;
        if (currentPct >= target) {
            const maxBunks = Math.floor((100 * attended - target * total) / target);
            return { message: maxBunks > 0 ? `Safely bunk <strong class="text-emerald-700">${maxBunks}</strong> more class${maxBunks > 1 ? 'es' : ''}.` : `On track! Don't miss the next class.` };
        } else {
            const required = Math.ceil((target * total - 100 * attended) / (100 - target));
            return { message: `Attend the next <strong class="text-rose-700">${required}</strong> class${required > 1 ? 'es' : ''} to hit target.` };
        }
    }

    // --- Renderers ---
    function renderAnalytics() {
        if (subjects.length === 0) {
            analyticsContainer.classList.add('hidden');
            return;
        }
        analyticsContainer.classList.remove('hidden');
        let sumAttended = 0, sumTotal = 0, safeCount = 0, criticalCount = 0;

        subjects.forEach(sub => {
            sumAttended += sub.attended;
            sumTotal += sub.total;
            if (sub.total > 0) {
                if ((sub.attended / sub.total) * 100 >= targetPercentage) safeCount++;
                else criticalCount++;
            }
        });

        overallAttended.textContent = sumAttended;
        overallTotal.textContent = sumTotal;
        safeSubjectsCount.textContent = safeCount;
        criticalSubjectsCount.textContent = criticalCount;
        analyticsTargetMarkerText.textContent = targetPercentage;
        overallTargetMarker.style.left = `${targetPercentage}%`;

        if (sumTotal === 0) {
            overallPercentageText.textContent = "0%";
            overallProgressBar.style.width = "0%";
            overallProgressBar.className = "h-full rounded-full transition-all duration-500 ease-out bg-gray-400";
        } else {
            const overallPct = (sumAttended / sumTotal) * 100;
            overallPercentageText.textContent = `${overallPct.toFixed(1)}%`;
            overallProgressBar.style.width = `${Math.min(overallPct, 100)}%`;
            if (overallPct >= targetPercentage) {
                overallProgressBar.className = "h-full rounded-full transition-all duration-500 ease-out bg-emerald-500";
                overallPercentageText.className = "text-2xl font-black text-emerald-600";
            } else {
                overallProgressBar.className = "h-full rounded-full transition-all duration-500 ease-out bg-rose-500";
                overallPercentageText.className = "text-2xl font-black text-rose-600";
            }
        }
    }

    function renderSubjectCards() {
        subjectsContainer.innerHTML = '';
        if (subjects.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');
        
        subjects.forEach(subject => {
            const clone = template.content.cloneNode(true);
            const pct = subject.total > 0 ? (subject.attended / subject.total) * 100 : 0;
            const status = getStatusClass(pct, subject.total);

            clone.querySelector('.subject-name').textContent = subject.name;
            clone.querySelector('.attended-count').textContent = subject.attended;
            clone.querySelector('.total-count').textContent = subject.total;
            clone.querySelector('.percentage-text').textContent = subject.total > 0 ? `${pct.toFixed(1)}%` : "0%";
            clone.querySelector('.percentage-text').classList.add(status.text);
            
            const badge = clone.querySelector('.status-badge');
            badge.textContent = status.label;
            badge.className = `status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${status.bg} ${status.text}`;
            
            const pBar = clone.querySelector('.progress-bar');
            pBar.style.width = `${Math.min(pct, 100)}%`;
            pBar.classList.add(status.progress);
            
            clone.querySelector('.target-marker').style.left = `${targetPercentage}%`;
            
            const adviceEl = clone.querySelector('.advice-message');
            adviceEl.innerHTML = calculateAdvice(subject.attended, subject.total, targetPercentage).message;
            adviceEl.className = `advice-message text-sm rounded-xl p-3 mb-4 font-medium leading-relaxed border bg-opacity-50 ${status.bg} ${status.text} border-${status.bg.replace('bg-', '')}`;

            // Simulator logic
            const simToggle = clone.querySelector('.simulator-toggle');
            const simPanel = clone.querySelector('.simulator-panel');
            const simChevron = clone.querySelector('.simulator-chevron');
            const simAction = clone.querySelector('.simulator-action');
            const simCount = clone.querySelector('.simulator-count');
            const simResult = clone.querySelector('.simulator-result');

            function updateSimulator() {
                const count = parseInt(simCount.value, 10) || 1;
                const newTotal = subject.total + count;
                let newAttended = subject.attended;
                if (simAction.value === 'attend') newAttended += count;
                const newPct = newTotal > 0 ? (newAttended / newTotal) * 100 : 0;
                simResult.textContent = `${newPct.toFixed(1)}%`;
                simResult.className = `font-bold text-lg simulator-result ${newPct >= targetPercentage ? 'text-emerald-600' : 'text-rose-600'}`;
            }

            simToggle.addEventListener('click', () => {
                simPanel.classList.toggle('hidden');
                simChevron.classList.toggle('rotate-180');
                if (!simPanel.classList.contains('hidden')) updateSimulator();
            });
            simAction.addEventListener('change', updateSimulator);
            simCount.addEventListener('input', updateSimulator);

            // History Log UI
            const lastActionText = clone.querySelector('.last-action-text');
            const undoBtn = clone.querySelector('.undo-action-btn');
            
            if (subject.history && subject.history.length > 0) {
                const last = subject.history[subject.history.length - 1];
                const timeStr = new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                lastActionText.textContent = `Last: ${last.type === 'present' ? 'Present' : 'Absent'} (${timeStr})`;
                lastActionText.classList.add(last.type === 'present' ? 'text-emerald-600' : 'text-rose-600');
                undoBtn.classList.remove('hidden');
            } else {
                lastActionText.textContent = "No recent actions";
            }

            // Buttons
            clone.querySelector('.present-btn').addEventListener('click', () => markPresent(subject.id));
            clone.querySelector('.absent-btn').addEventListener('click', () => markAbsent(subject.id));
            undoBtn.addEventListener('click', () => undoLastAction(subject.id));
            
            clone.querySelector('.reset-btn').addEventListener('click', () => resetSubject(subject.id));
            clone.querySelector('.delete-btn').addEventListener('click', () => {
                if (confirm(`Delete "${subject.name}"?`)) deleteSubject(subject.id);
            });

            subjectsContainer.appendChild(clone);
        });
    }

    function renderTodaySchedule() {
        todayClassesContainer.innerHTML = '';
        const dayName = daysOfWeek[new Date().getDay()];
        const todaySubjectsIds = timetable[dayName] || [];
        const todayStr = new Date().toISOString().split('T')[0];
        const todaysActionsData = todayActions[todayStr] || {};

        if (todaySubjectsIds.length === 0) {
            emptyTodayState.classList.remove('hidden');
            return;
        }
        
        let hasPending = false;

        todaySubjectsIds.forEach(id => {
            const subject = subjects.find(sub => sub.id === id);
            if (!subject) return;

            const actionTaken = todaysActionsData[id]; // 'present', 'absent', 'canceled' or undefined
            if (!actionTaken) hasPending = true;

            const clone = todayClassTemplate.content.cloneNode(true);
            const container = clone.querySelector('.today-class-item');
            clone.querySelector('.subject-name').textContent = subject.name;
            
            const pct = subject.total > 0 ? ((subject.attended / subject.total) * 100).toFixed(1) + '%' : '0%';
            clone.querySelector('.subject-stats').textContent = `${subject.attended}/${subject.total} (${pct})`;
            
            const statusInd = clone.querySelector('.status-indicator');
            if (subject.total > 0 && (subject.attended / subject.total) * 100 < targetPercentage) {
                statusInd.textContent = 'Critical';
                statusInd.classList.add('text-rose-500');
                container.classList.replace('border-l-indigo-500', 'border-l-rose-500');
            } else {
                statusInd.textContent = 'Safe';
                statusInd.classList.add('text-emerald-500');
                container.classList.replace('border-l-indigo-500', 'border-l-emerald-500');
            }

            const actionsDiv = clone.querySelector('.actions-container');
            const statusMsg = clone.querySelector('.status-message');

            if (actionTaken) {
                actionsDiv.classList.add('hidden');
                statusMsg.classList.remove('hidden');
                if (actionTaken === 'present') {
                    statusMsg.textContent = "Marked Present";
                    statusMsg.className = "status-message font-bold py-2 px-4 rounded-lg flex-1 text-center border bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (actionTaken === 'absent') {
                    statusMsg.textContent = "Marked Absent";
                    statusMsg.className = "status-message font-bold py-2 px-4 rounded-lg flex-1 text-center border bg-rose-50 text-rose-700 border-rose-200";
                } else {
                    statusMsg.textContent = "Class Canceled";
                    statusMsg.className = "status-message font-bold py-2 px-4 rounded-lg flex-1 text-center border bg-gray-50 text-gray-500 border-gray-200";
                }
            } else {
                clone.querySelector('.today-present-btn').addEventListener('click', () => markPresent(subject.id, true));
                clone.querySelector('.today-absent-btn').addEventListener('click', () => markAbsent(subject.id, true));
                clone.querySelector('.today-cancel-btn').addEventListener('click', () => markCanceled(subject.id));
            }

            todayClassesContainer.appendChild(clone);
        });

        if (!hasPending && todaySubjectsIds.length > 0) {
            emptyTodayState.classList.add('hidden');
        } else if (todaySubjectsIds.length === 0) {
            emptyTodayState.classList.remove('hidden');
        } else {
            emptyTodayState.classList.add('hidden');
        }
    }

    function render() {
        renderAnalytics();
        renderSubjectCards();
        if (!viewTodaySchedule.classList.contains('hidden')) {
            renderTodaySchedule();
        }
    }

    // --- Timetable Modal Logic ---
    function openTimetableModal() {
        timetableModalContent.innerHTML = '';
        const workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
        
        if (subjects.length === 0) {
            timetableModalContent.innerHTML = '<p class="text-gray-500 text-center py-4">Add some subjects first!</p>';
        } else {
            workDays.forEach(day => {
                const dayDiv = document.createElement('div');
                dayDiv.className = "border border-gray-200 rounded-xl p-4 bg-white";
                
                const dayTitle = document.createElement('h4');
                dayTitle.className = "font-bold text-gray-800 mb-3 border-b pb-2";
                dayTitle.textContent = day;
                dayDiv.appendChild(dayTitle);

                const grid = document.createElement('div');
                grid.className = "grid grid-cols-2 gap-2";

                subjects.forEach(sub => {
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-2 cursor-pointer p-2 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200";
                    
                    const cb = document.createElement('input');
                    cb.type = "checkbox";
                    cb.className = "w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500";
                    cb.dataset.day = day;
                    cb.dataset.id = sub.id;
                    if (timetable[day] && timetable[day].includes(sub.id)) {
                        cb.checked = true;
                    }

                    const span = document.createElement('span');
                    span.className = "text-sm text-gray-700 font-medium truncate";
                    span.textContent = sub.name;

                    label.appendChild(cb);
                    label.appendChild(span);
                    grid.appendChild(label);
                });

                dayDiv.appendChild(grid);
                timetableModalContent.appendChild(dayDiv);
            });
        }
        timetableModal.classList.remove('hidden');
    }

    function saveTimetable() {
        const checkboxes = timetableModalContent.querySelectorAll('input[type="checkbox"]');
        
        // Clear current workdays (keep Sat/Sun intact in state, though we only edit Mon-Fri)
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(d => timetable[d] = []);

        checkboxes.forEach(cb => {
            if (cb.checked) {
                timetable[cb.dataset.day].push(cb.dataset.id);
            }
        });
        
        saveData();
        timetableModal.classList.add('hidden');
        renderTodaySchedule();
    }

    // Run
    init();
});
