document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let targetPercentage = 75;
    let subjects = [];
    let timetable = {
        'Monday': [], 'Tuesday': [], 'Wednesday': [], 'Thursday': [], 'Friday': [], 'Saturday': [], 'Sunday': []
    };
    let todayActions = {}; // { "YYYY-MM-DD": { subjectId: "present|absent|canceled" } }
    
    let currentEditingSubjectId = null;

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // --- DOM Elements ---
    const targetInput = document.getElementById('targetInput');
    const addSubjectForm = document.getElementById('addSubjectForm');
    const subjectNameInput = document.getElementById('subjectNameInput');
    
    const tabAllSubjects = document.getElementById('tabAllSubjects');
    const tabTodaySchedule = document.getElementById('tabTodaySchedule');
    const viewAllSubjects = document.getElementById('viewAllSubjects');
    const viewTodaySchedule = document.getElementById('viewTodaySchedule');
    
    const subjectsContainer = document.getElementById('subjectsContainer');
    const emptyState = document.getElementById('emptyState');
    const todayClassesContainer = document.getElementById('todayClassesContainer');
    const emptyTodayState = document.getElementById('emptyTodayState');
    
    const template = document.getElementById('subjectCardTemplate');
    const compActionTemplate = document.getElementById('componentActionTemplate');
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

    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importInput = document.getElementById('importInput');

    // Modals
    const timetableModal = document.getElementById('timetableModal');
    const timetableModalInner = document.getElementById('timetableModalInner');
    const editTimetableBtn = document.getElementById('editTimetableBtn');
    const closeTimetableModalBtn = document.getElementById('closeTimetableModalBtn');
    const saveTimetableBtn = document.getElementById('saveTimetableBtn');
    const timetableModalContent = document.getElementById('timetableModalContent');

    const componentsModal = document.getElementById('componentsModal');
    const componentsModalInner = document.getElementById('componentsModalInner');
    const closeComponentsModalBtn = document.getElementById('closeComponentsModalBtn');
    const saveComponentsBtn = document.getElementById('saveComponentsBtn');
    const addComponentBtn = document.getElementById('addComponentBtn');
    const componentsList = document.getElementById('componentsList');
    const componentsSubjectName = document.getElementById('componentsSubjectName');

    const todayDayDisplay = document.getElementById('todayDayDisplay');
    const todayDateDisplay = document.getElementById('todayDateDisplay');

    // --- Initialization ---
    function init() {
        loadData();
        targetInput.value = targetPercentage;
        setupDateDisplays();
        render();

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

        tabAllSubjects.addEventListener('click', () => switchTab('all'));
        tabTodaySchedule.addEventListener('click', () => switchTab('today'));

        editTimetableBtn.addEventListener('click', openTimetableModal);
        closeTimetableModalBtn.addEventListener('click', () => closeModal(timetableModal, timetableModalInner));
        saveTimetableBtn.addEventListener('click', saveTimetable);

        closeComponentsModalBtn.addEventListener('click', () => closeModal(componentsModal, componentsModalInner));
        saveComponentsBtn.addEventListener('click', saveComponents);
        addComponentBtn.addEventListener('click', addNewComponentRow);
    }

    function setupDateDisplays() {
        const now = new Date();
        todayDayDisplay.textContent = daysOfWeek[now.getDay()];
        todayDateDisplay.textContent = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // --- Data Persistence & Migration ---
    function loadData() {
        const storedTarget = localStorage.getItem('attendanceTarget');
        if (storedTarget) targetPercentage = parseInt(storedTarget, 10);

        const storedSubjects = localStorage.getItem('attendanceSubjects');
        if (storedSubjects) {
            try {
                const parsed = JSON.parse(storedSubjects);
                subjects = parsed.map(sub => {
                    // Migration: Ensure components array exists
                    if (!sub.components) {
                        sub.components = [
                            { id: 'c_' + Date.now(), name: 'Lecture', weight: 1.0, attended: Math.max(0, sub.attended || 0), total: Math.max(0, sub.total || 0) }
                        ];
                        // Convert history
                        if (sub.history) {
                            sub.history.forEach(h => {
                                h.componentId = sub.components[0].id;
                                h.weight = 1.0;
                            });
                        }
                    } else {
                        // Sanitize
                        sub.components.forEach(c => {
                            c.attended = Math.max(0, parseFloat(c.attended) || 0);
                            c.total = Math.max(0, parseFloat(c.total) || 0);
                            if (c.attended > c.total) c.attended = c.total;
                        });
                    }
                    if (!sub.history) sub.history = [];
                    return sub;
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

    // --- Core Math Logic ---
    function getSubjectStats(subject) {
        let wAttended = 0, wTotal = 0;
        let breakdown = [];
        subject.components.forEach(c => {
            if (c.weight > 0 && c.total > 0) {
                breakdown.push(`${c.name.substring(0,3)}: ${c.attended}/${c.total}`);
            }
            wAttended += (c.attended * c.weight);
            wTotal += (c.total * c.weight);
        });
        const pct = wTotal > 0 ? (wAttended / wTotal) * 100 : 0;
        return { wAttended, wTotal, pct, breakdownStr: breakdown.join(' | ') || 'No classes yet' };
    }

    function getStatusClass(pct, total) {
        if (total === 0) return { bg: 'bg-slate-100', text: 'text-slate-600', progress: 'bg-slate-300', label: 'No Data' };
        if (pct >= targetPercentage) return { bg: 'bg-emerald-100', text: 'text-emerald-700', progress: 'bg-emerald-500', label: 'Safe' };
        return { bg: 'bg-rose-100', text: 'text-rose-700', progress: 'bg-rose-500', label: 'Critical' };
    }

    function calculateAdvice(stats, target) {
        if (stats.wTotal === 0) return { message: `Start marking attendance to track stats.` };
        
        if (stats.pct >= target) {
            const maxBunksUnits = (100 * stats.wAttended - target * stats.wTotal) / target;
            const bunkFloor = Math.floor(maxBunksUnits); // in standard 1.0 weight units
            if (bunkFloor > 0) {
                return { message: `Safely miss <strong class="text-emerald-700">${bunkFloor}</strong> standard unit${bunkFloor !== 1 ? 's' : ''} (Weight 1.0).` };
            } else {
                return { message: `On track! Don't miss the next class.` };
            }
        } else {
            const reqUnits = (target * stats.wTotal - 100 * stats.wAttended) / (100 - target);
            const reqCeil = Math.ceil(reqUnits);
            return { message: `Attend the next <strong class="text-rose-700">${reqCeil}</strong> standard unit${reqCeil !== 1 ? 's' : ''} to hit target.` };
        }
    }

    // --- Actions ---
    function addSubject(name) {
        subjects.push({
            id: Date.now().toString(),
            name: name,
            components: [
                { id: 'c_' + Date.now() + '_L', name: 'Lecture', weight: 1.0, attended: 0, total: 0 },
                { id: 'c_' + Date.now() + '_P', name: 'Lab', weight: 2.0, attended: 0, total: 0 }
            ],
            history: []
        });
        saveData();
        render();
    }

    function deleteSubject(id) {
        subjects = subjects.filter(sub => sub.id !== id);
        for (const day in timetable) timetable[day] = timetable[day].filter(subId => subId !== id);
        saveData();
        render();
    }

    function markAttendance(subjectId, compId, isPresent, isTodaySchedule = false) {
        const subject = subjects.find(s => s.id === subjectId);
        if (!subject) return;
        const comp = subject.components.find(c => c.id === compId);
        if (!comp) return;

        comp.total += 1;
        if (isPresent) comp.attended += 1;

        subject.history.push({
            type: isPresent ? 'present' : 'absent',
            componentId: comp.id,
            compName: comp.name,
            timestamp: Date.now()
        });
        if (subject.history.length > 5) subject.history.shift();

        if (isTodaySchedule) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (!todayActions[todayStr]) todayActions[todayStr] = {};
            todayActions[todayStr][subjectId] = isPresent ? `present|${comp.name}` : `absent|${comp.name}`;
        }

        saveData();
        render();
    }

    function markCanceled(subjectId) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (!todayActions[todayStr]) todayActions[todayStr] = {};
        todayActions[todayStr][subjectId] = 'canceled';
        saveData();
        renderTodaySchedule();
    }

    function undoLastAction(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject && subject.history && subject.history.length > 0) {
            const lastAction = subject.history.pop();
            const comp = subject.components.find(c => c.id === lastAction.componentId);
            
            if (comp) {
                if (lastAction.type === 'present' && comp.attended > 0 && comp.total > 0) {
                    comp.attended -= 1;
                    comp.total -= 1;
                } else if (lastAction.type === 'absent' && comp.total > comp.attended) {
                    comp.total -= 1;
                }
            }
            saveData();
            render();
        }
    }

    // --- Export / Import ---
    function exportData() {
        const data = { targetPercentage, subjects, timetable, todayActions, timestamp: new Date().toISOString() };
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
                        localStorage.setItem('attendanceSubjects', JSON.stringify(parsed.subjects));
                        localStorage.setItem('attendanceTarget', parsed.targetPercentage);
                        if (parsed.timetable) localStorage.setItem('attendanceTimetable', JSON.stringify(parsed.timetable));
                        if (parsed.todayActions) localStorage.setItem('attendanceTodayActions', JSON.stringify(parsed.todayActions));
                        loadData(); // Will handle migration automatically
                        targetInput.value = targetPercentage;
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
            tabAllSubjects.classList.replace('text-slate-400', 'text-indigo-600');
            tabAllSubjects.classList.replace('border-transparent', 'border-indigo-600');
            tabTodaySchedule.classList.replace('text-indigo-600', 'text-slate-400');
            tabTodaySchedule.classList.replace('border-indigo-600', 'border-transparent');
            viewAllSubjects.classList.remove('hidden');
            viewTodaySchedule.classList.add('hidden');
        } else {
            tabTodaySchedule.classList.replace('text-slate-400', 'text-indigo-600');
            tabTodaySchedule.classList.replace('border-transparent', 'border-indigo-600');
            tabAllSubjects.classList.replace('text-indigo-600', 'text-slate-400');
            tabAllSubjects.classList.replace('border-indigo-600', 'border-transparent');
            viewTodaySchedule.classList.remove('hidden');
            viewAllSubjects.classList.add('hidden');
            renderTodaySchedule();
        }
    }

    function openModal(modalEl, innerEl) {
        modalEl.classList.remove('hidden');
        // Trigger reflow
        void modalEl.offsetWidth;
        modalEl.classList.remove('opacity-0');
        innerEl.classList.remove('scale-95');
    }

    function closeModal(modalEl, innerEl) {
        modalEl.classList.add('opacity-0');
        innerEl.classList.add('scale-95');
        setTimeout(() => modalEl.classList.add('hidden'), 300);
    }

    // --- Renderers ---
    function renderAnalytics() {
        if (subjects.length === 0) {
            analyticsContainer.classList.add('hidden');
            return;
        }
        analyticsContainer.classList.remove('hidden');
        let sumWAttended = 0, sumWTotal = 0, safeCount = 0, criticalCount = 0;

        subjects.forEach(sub => {
            const stats = getSubjectStats(sub);
            sumWAttended += stats.wAttended;
            sumWTotal += stats.wTotal;
            if (stats.wTotal > 0) {
                if (stats.pct >= targetPercentage) safeCount++;
                else criticalCount++;
            }
        });

        // Use 1 decimal for units if not whole number
        overallAttended.textContent = Number.isInteger(sumWAttended) ? sumWAttended : sumWAttended.toFixed(1);
        overallTotal.textContent = Number.isInteger(sumWTotal) ? sumWTotal : sumWTotal.toFixed(1);
        safeSubjectsCount.textContent = safeCount;
        criticalSubjectsCount.textContent = criticalCount;
        analyticsTargetMarkerText.textContent = targetPercentage;
        overallTargetMarker.style.left = `${targetPercentage}%`;

        if (sumWTotal === 0) {
            overallPercentageText.textContent = "0%";
            overallProgressBar.style.width = "0%";
            overallProgressBar.className = "h-full rounded-full smooth-progress bg-slate-300";
        } else {
            const overallPct = (sumWAttended / sumWTotal) * 100;
            overallPercentageText.textContent = `${overallPct.toFixed(1)}%`;
            overallProgressBar.style.width = `${Math.min(overallPct, 100)}%`;
            if (overallPct >= targetPercentage) {
                overallProgressBar.className = "h-full rounded-full smooth-progress bg-emerald-500 shadow-emerald-200 shadow-md";
                overallPercentageText.className = "text-3xl font-black text-emerald-600 tracking-tight";
            } else {
                overallProgressBar.className = "h-full rounded-full smooth-progress bg-rose-500 shadow-rose-200 shadow-md";
                overallPercentageText.className = "text-3xl font-black text-rose-600 tracking-tight";
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
            const stats = getSubjectStats(subject);
            const status = getStatusClass(stats.pct, stats.wTotal);

            clone.querySelector('.subject-name').textContent = subject.name;
            clone.querySelector('.component-breakdown').textContent = stats.breakdownStr;
            clone.querySelector('.percentage-text').textContent = stats.wTotal > 0 ? `${stats.pct.toFixed(1)}%` : "0%";
            clone.querySelector('.percentage-text').classList.add(status.text);
            
            const badge = clone.querySelector('.status-badge');
            badge.textContent = status.label;
            badge.className = `status-badge px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider shadow-sm ${status.bg} ${status.text} border border-${status.bg.replace('bg-','').replace('-100','-200')}`;
            
            const pBar = clone.querySelector('.progress-bar');
            // Give 50ms delay for smooth animation on load
            setTimeout(() => { pBar.style.width = `${Math.min(stats.pct, 100)}%`; }, 50);
            pBar.classList.add(status.progress);
            if (stats.wTotal > 0) pBar.classList.add(`shadow-${status.progress.replace('bg-','').replace('-500','-200')}`, 'shadow-sm');
            
            clone.querySelector('.target-marker').style.left = `${targetPercentage}%`;
            
            const adviceEl = clone.querySelector('.advice-message');
            adviceEl.innerHTML = calculateAdvice(stats, targetPercentage).message;
            adviceEl.className = `advice-message text-sm rounded-xl p-3.5 mb-5 font-semibold leading-relaxed border shadow-sm ${status.bg} ${status.text} border-${status.bg.replace('bg-','').replace('-100','-200')}`;

            // Simulator logic
            const simToggle = clone.querySelector('.simulator-toggle');
            const simPanel = clone.querySelector('.simulator-panel');
            const simChevron = clone.querySelector('.simulator-chevron');
            const simAction = clone.querySelector('.simulator-action');
            const simCount = clone.querySelector('.simulator-count');
            const simResult = clone.querySelector('.simulator-result');

            function updateSimulator() {
                const count = parseInt(simCount.value, 10) || 1;
                const weight = 1.0; // standard unit
                const newTotal = stats.wTotal + (count * weight);
                let newAttended = stats.wAttended;
                if (simAction.value === 'attend') newAttended += (count * weight);
                
                const newPct = newTotal > 0 ? (newAttended / newTotal) * 100 : 0;
                simResult.textContent = `${newPct.toFixed(1)}%`;
                simResult.className = `font-black text-lg simulator-result ${newPct >= targetPercentage ? 'text-emerald-600' : 'text-rose-600'}`;
            }

            simToggle.addEventListener('click', () => {
                simPanel.classList.toggle('hidden');
                simChevron.classList.toggle('rotate-180');
                if (!simPanel.classList.contains('hidden')) updateSimulator();
            });
            simAction.addEventListener('change', updateSimulator);
            simCount.addEventListener('input', updateSimulator);

            // Dynamic Action Buttons Setup
            const actionsContainer = clone.querySelector('.component-actions');
            subject.components.forEach(comp => {
                const compClone = compActionTemplate.content.cloneNode(true);
                compClone.querySelector('.comp-label').textContent = `${comp.name} (w:${comp.weight})`;
                compClone.querySelector('.comp-present-btn').addEventListener('click', () => markAttendance(subject.id, comp.id, true));
                compClone.querySelector('.comp-absent-btn').addEventListener('click', () => markAttendance(subject.id, comp.id, false));
                actionsContainer.appendChild(compClone);
            });

            // History Log UI
            const lastActionText = clone.querySelector('.last-action-text');
            const undoBtn = clone.querySelector('.undo-action-btn');
            
            if (subject.history && subject.history.length > 0) {
                const last = subject.history[subject.history.length - 1];
                const timeStr = new Date(last.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                lastActionText.textContent = `Last: ${last.compName} ${last.type === 'present' ? 'Present' : 'Absent'} (${timeStr})`;
                lastActionText.parentElement.classList.add(last.type === 'present' ? 'text-emerald-600' : 'text-rose-600');
                undoBtn.classList.remove('hidden');
            }

            undoBtn.addEventListener('click', () => undoLastAction(subject.id));
            clone.querySelector('.settings-btn').addEventListener('click', () => openComponentsModal(subject.id));
            clone.querySelector('.delete-btn').addEventListener('click', () => {
                if (confirm(`Delete "${subject.name}" completely?`)) deleteSubject(subject.id);
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

            const actionTaken = todaysActionsData[id]; 
            if (!actionTaken) hasPending = true;

            const clone = todayClassTemplate.content.cloneNode(true);
            const container = clone.querySelector('.today-class-item');
            clone.querySelector('.subject-name').textContent = subject.name;
            
            const stats = getSubjectStats(subject);
            const pctText = stats.wTotal > 0 ? stats.pct.toFixed(1) + '%' : '0%';
            clone.querySelector('.subject-stats').textContent = `W.Units: ${stats.wAttended}/${stats.wTotal} (${pctText})`;
            
            const statusInd = clone.querySelector('.status-indicator');
            if (stats.wTotal > 0 && stats.pct < targetPercentage) {
                statusInd.textContent = 'Critical';
                statusInd.classList.add('text-rose-700', 'bg-rose-100');
                container.classList.replace('border-l-indigo-500', 'border-l-rose-500');
            } else {
                statusInd.textContent = 'Safe';
                statusInd.classList.add('text-emerald-700', 'bg-emerald-100');
                container.classList.replace('border-l-indigo-500', 'border-l-emerald-500');
            }

            const actionsDiv = clone.querySelector('.actions-container');
            const statusMsg = clone.querySelector('.status-message');

            if (actionTaken) {
                actionsDiv.classList.add('hidden');
                statusMsg.classList.remove('hidden');
                const [actionStr, compName] = actionTaken.split('|');
                
                if (actionStr === 'present') {
                    statusMsg.textContent = `${compName} Marked Present`;
                    statusMsg.className = "status-message font-extrabold py-2.5 px-5 rounded-xl flex-1 text-center border shadow-sm bg-emerald-50 text-emerald-700 border-emerald-200";
                } else if (actionStr === 'absent') {
                    statusMsg.textContent = `${compName} Marked Absent`;
                    statusMsg.className = "status-message font-extrabold py-2.5 px-5 rounded-xl flex-1 text-center border shadow-sm bg-rose-50 text-rose-700 border-rose-200";
                } else {
                    statusMsg.textContent = "Class Canceled";
                    statusMsg.className = "status-message font-extrabold py-2.5 px-5 rounded-xl flex-1 text-center border shadow-sm bg-slate-50 text-slate-500 border-slate-200";
                }
            } else {
                const select = clone.querySelector('.today-comp-select');
                subject.components.forEach(comp => {
                    const opt = document.createElement('option');
                    opt.value = comp.id;
                    opt.textContent = `${comp.name} (w:${comp.weight})`;
                    select.appendChild(opt);
                });

                clone.querySelector('.today-present-btn').addEventListener('click', () => markAttendance(subject.id, select.value, true, true));
                clone.querySelector('.today-absent-btn').addEventListener('click', () => markAttendance(subject.id, select.value, false, true));
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
            timetableModalContent.innerHTML = '<p class="text-slate-500 text-center py-4 font-medium">Add some subjects first!</p>';
        } else {
            workDays.forEach(day => {
                const dayDiv = document.createElement('div');
                dayDiv.className = "border border-slate-200 rounded-xl p-4 bg-white shadow-sm";
                
                const dayTitle = document.createElement('h4');
                dayTitle.className = "font-bold text-slate-800 mb-3 border-b border-slate-100 pb-2";
                dayTitle.textContent = day;
                dayDiv.appendChild(dayTitle);

                const grid = document.createElement('div');
                grid.className = "grid grid-cols-2 gap-2";

                subjects.forEach(sub => {
                    const label = document.createElement('label');
                    label.className = "flex items-center gap-2 cursor-pointer p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-200";
                    
                    const cb = document.createElement('input');
                    cb.type = "checkbox";
                    cb.className = "w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500";
                    cb.dataset.day = day;
                    cb.dataset.id = sub.id;
                    if (timetable[day] && timetable[day].includes(sub.id)) cb.checked = true;

                    const span = document.createElement('span');
                    span.className = "text-sm text-slate-700 font-medium truncate";
                    span.textContent = sub.name;

                    label.appendChild(cb);
                    label.appendChild(span);
                    grid.appendChild(label);
                });
                dayDiv.appendChild(grid);
                timetableModalContent.appendChild(dayDiv);
            });
        }
        openModal(timetableModal, timetableModalInner);
    }

    function saveTimetable() {
        const checkboxes = timetableModalContent.querySelectorAll('input[type="checkbox"]');
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].forEach(d => timetable[d] = []);
        checkboxes.forEach(cb => { if (cb.checked) timetable[cb.dataset.day].push(cb.dataset.id); });
        saveData();
        closeModal(timetableModal, timetableModalInner);
        renderTodaySchedule();
    }

    // --- Edit Components Modal Logic ---
    function openComponentsModal(subjectId) {
        currentEditingSubjectId = subjectId;
        const subject = subjects.find(s => s.id === subjectId);
        if (!subject) return;

        componentsSubjectName.textContent = subject.name;
        componentsList.innerHTML = '';
        
        subject.components.forEach(comp => {
            componentsList.appendChild(createComponentRow(comp));
        });
        openModal(componentsModal, componentsModalInner);
    }

    function createComponentRow(comp = { id: 'c_' + Date.now(), name: '', weight: 1.0, attended: 0, total: 0 }) {
        const div = document.createElement('div');
        div.className = "comp-row flex gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm";
        div.dataset.id = comp.id;
        div.dataset.attended = comp.attended;
        div.dataset.total = comp.total;
        
        div.innerHTML = `
            <input type="text" placeholder="Name (e.g. Lab)" value="${comp.name}" class="comp-name flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
            <input type="number" step="0.5" min="0" placeholder="Weight" value="${comp.weight}" class="comp-weight w-20 bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center">
            <button class="comp-remove-btn text-slate-400 hover:text-rose-600 transition-colors p-2 rounded-lg hover:bg-rose-50"><i class="fas fa-trash"></i></button>
        `;

        div.querySelector('.comp-remove-btn').addEventListener('click', () => {
            div.remove();
        });
        return div;
    }

    function addNewComponentRow() {
        componentsList.appendChild(createComponentRow());
    }

    function saveComponents() {
        const subject = subjects.find(s => s.id === currentEditingSubjectId);
        if (!subject) return;

        const rows = componentsList.querySelectorAll('.comp-row');
        const newComponents = [];

        rows.forEach(row => {
            const name = row.querySelector('.comp-name').value.trim() || 'Session';
            const weight = parseFloat(row.querySelector('.comp-weight').value) || 0;
            const id = row.dataset.id;
            const attended = parseFloat(row.dataset.attended);
            const total = parseFloat(row.dataset.total);
            newComponents.push({ id, name, weight, attended, total });
        });

        if (newComponents.length === 0) {
            alert("Subject must have at least one component.");
            return;
        }

        subject.components = newComponents;
        saveData();
        closeModal(componentsModal, componentsModalInner);
        render();
    }

    // Run
    init();
});
