document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let targetPercentage = 75;
    let subjects = [];

    // --- DOM Elements ---
    const targetInput = document.getElementById('targetInput');
    const addSubjectForm = document.getElementById('addSubjectForm');
    const subjectNameInput = document.getElementById('subjectNameInput');
    const subjectsContainer = document.getElementById('subjectsContainer');
    const emptyState = document.getElementById('emptyState');
    const template = document.getElementById('subjectCardTemplate');
    
    // Analytics Elements
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

    // --- Initialization ---
    function init() {
        loadData();
        targetInput.value = targetPercentage;
        render();

        // Event Listeners for global inputs
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

        // Export/Import listeners
        exportBtn.addEventListener('click', exportData);
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', importData);
    }

    // --- Data Persistence ---
    function loadData() {
        const storedTarget = localStorage.getItem('attendanceTarget');
        if (storedTarget) {
            targetPercentage = parseInt(storedTarget, 10);
        }

        const storedSubjects = localStorage.getItem('attendanceSubjects');
        if (storedSubjects) {
            try {
                subjects = JSON.parse(storedSubjects);
                // Ensure no negative numbers
                subjects.forEach(sub => {
                    if (sub.attended < 0) sub.attended = 0;
                    if (sub.total < 0) sub.total = 0;
                    if (sub.attended > sub.total) sub.attended = sub.total;
                });
            } catch (e) {
                subjects = [];
            }
        }
    }

    function saveData() {
        localStorage.setItem('attendanceTarget', targetPercentage.toString());
        localStorage.setItem('attendanceSubjects', JSON.stringify(subjects));
    }

    // --- Actions ---
    function addSubject(name) {
        const newSubject = {
            id: Date.now().toString(),
            name: name,
            attended: 0,
            total: 0
        };
        subjects.push(newSubject);
        saveData();
        render();
    }

    function deleteSubject(id) {
        subjects = subjects.filter(sub => sub.id !== id);
        saveData();
        render();
    }

    function resetSubject(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.attended = 0;
            subject.total = 0;
            saveData();
            render();
        }
    }

    function markPresent(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.attended += 1;
            subject.total += 1;
            saveData();
            render();
        }
    }

    function markAbsent(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject) {
            subject.total += 1;
            saveData();
            render();
        }
    }

    function undoPresent(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject && subject.attended > 0 && subject.total > 0) {
            subject.attended -= 1;
            subject.total -= 1;
            saveData();
            render();
        }
    }

    function undoAbsent(id) {
        const subject = subjects.find(sub => sub.id === id);
        if (subject && subject.total > subject.attended) {
            subject.total -= 1;
            saveData();
            render();
        }
    }

    // --- Export / Import ---
    function exportData() {
        const data = {
            targetPercentage,
            subjects,
            timestamp: new Date().toISOString()
        };
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_backup_${timestamp}.json`;
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
                    if (confirm("Are you sure you want to restore data? This will overwrite your current attendance records.")) {
                        targetPercentage = parsed.targetPercentage;
                        targetInput.value = targetPercentage;
                        
                        subjects = parsed.subjects.map(sub => ({
                            id: sub.id || Date.now().toString() + Math.random(),
                            name: sub.name || "Unknown Subject",
                            attended: Math.max(0, parseInt(sub.attended) || 0),
                            total: Math.max(0, parseInt(sub.total) || 0)
                        }));
                        
                        // Fix logically impossible states
                        subjects.forEach(sub => {
                            if (sub.attended > sub.total) sub.attended = sub.total;
                        });

                        saveData();
                        render();
                    }
                } else {
                    alert("Invalid backup file format.");
                }
            } catch (error) {
                alert("Error reading backup file.");
            }
            // Reset input so the same file can be selected again
            importInput.value = "";
        };
        reader.readAsText(file);
    }

    // --- Math & Advice Logic ---
    function calculateAdvice(attended, total, target) {
        if (total === 0) {
            return {
                status: 'neutral',
                message: `Attend classes to see your status.`
            };
        }

        const currentPct = (attended / total) * 100;
        
        if (currentPct >= target) {
            const maxBunks = Math.floor((100 * attended - target * total) / target);
            return {
                status: 'safe',
                message: maxBunks > 0 
                    ? `You can safely bunk <strong class="text-emerald-700">${maxBunks}</strong> more class${maxBunks > 1 ? 'es' : ''}.` 
                    : `On track! Don't miss the next class.`
            };
        } else {
            const required = Math.ceil((target * total - 100 * attended) / (100 - target));
            return {
                status: 'danger',
                message: `You must attend the next <strong class="text-rose-700">${required}</strong> class${required > 1 ? 'es' : ''} to hit the target.`
            };
        }
    }

    function renderAnalytics() {
        if (subjects.length === 0) {
            analyticsContainer.classList.add('hidden');
            return;
        }
        
        analyticsContainer.classList.remove('hidden');

        let sumAttended = 0;
        let sumTotal = 0;
        let safeCount = 0;
        let criticalCount = 0;

        subjects.forEach(sub => {
            sumAttended += sub.attended;
            sumTotal += sub.total;
            
            if (sub.total > 0) {
                const pct = (sub.attended / sub.total) * 100;
                if (pct >= targetPercentage) {
                    safeCount++;
                } else {
                    criticalCount++;
                }
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
            // Floor formatting for cleaner display, or toFixed(1)
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

    // --- Rendering ---
    function render() {
        subjectsContainer.innerHTML = '';

        renderAnalytics();

        if (subjects.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            
            subjects.forEach(subject => {
                const clone = template.content.cloneNode(true);
                const card = clone.querySelector('.subject-card');
                
                // Set text content
                clone.querySelector('.subject-name').textContent = subject.name;
                clone.querySelector('.attended-count').textContent = subject.attended;
                clone.querySelector('.total-count').textContent = subject.total;
                
                // Calculate percentage
                let percentage = 0;
                let displayPercentage = "0%";
                
                if (subject.total > 0) {
                    percentage = (subject.attended / subject.total) * 100;
                    displayPercentage = `${percentage.toFixed(1)}%`;
                }
                
                const isSafe = percentage >= targetPercentage;
                const statusBadge = clone.querySelector('.status-badge');
                const progressBar = clone.querySelector('.progress-bar');
                const adviceEl = clone.querySelector('.advice-message');
                const percentageText = clone.querySelector('.percentage-text');
                
                percentageText.textContent = displayPercentage;
                progressBar.style.width = `${Math.min(percentage, 100)}%`;
                
                const targetMarker = clone.querySelector('.target-marker');
                targetMarker.style.left = `${targetPercentage}%`;

                const advice = calculateAdvice(subject.attended, subject.total, targetPercentage);
                adviceEl.innerHTML = advice.message;
                
                if (subject.total === 0) {
                    statusBadge.textContent = 'No Data';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600';
                    progressBar.classList.add('bg-gray-400');
                    percentageText.className = 'text-2xl font-black percentage-text text-gray-400';
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-gray-50 text-gray-600 border border-gray-100';
                } else if (isSafe) {
                    statusBadge.textContent = 'Safe';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700';
                    progressBar.classList.add('bg-emerald-500');
                    percentageText.className = 'text-2xl font-black percentage-text text-emerald-600';
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-100';
                } else {
                    statusBadge.textContent = 'Warning';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-700';
                    progressBar.classList.add('bg-rose-500');
                    percentageText.className = 'text-2xl font-black percentage-text text-rose-600';
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-rose-50 text-rose-800 border border-rose-100';
                }

                // Event Listeners for buttons
                clone.querySelector('.present-btn').addEventListener('click', () => markPresent(subject.id));
                clone.querySelector('.absent-btn').addEventListener('click', () => markAbsent(subject.id));
                
                clone.querySelector('.undo-present-btn').addEventListener('click', () => undoPresent(subject.id));
                clone.querySelector('.undo-absent-btn').addEventListener('click', () => undoAbsent(subject.id));

                clone.querySelector('.reset-btn').addEventListener('click', () => resetSubject(subject.id));
                clone.querySelector('.delete-btn').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete "${subject.name}"?`)) {
                        deleteSubject(subject.id);
                    }
                });

                // Disable undo buttons if nothing to undo
                if (subject.attended === 0) {
                    clone.querySelector('.undo-present-btn').disabled = true;
                    clone.querySelector('.undo-present-btn').classList.add('opacity-50', 'cursor-not-allowed');
                }
                if (subject.total <= subject.attended) {
                    clone.querySelector('.undo-absent-btn').disabled = true;
                    clone.querySelector('.undo-absent-btn').classList.add('opacity-50', 'cursor-not-allowed');
                }

                subjectsContainer.appendChild(clone);
            });
        }
    }

    // Run
    init();
});
