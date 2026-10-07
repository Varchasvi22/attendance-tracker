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
            // How many classes can be safely bunked?
            // (attended) / (total + x) >= target / 100
            // 100 * attended >= target * (total + x)
            // (100 * attended - target * total) / target >= x
            const maxBunks = Math.floor((100 * attended - target * total) / target);
            
            return {
                status: 'safe',
                message: maxBunks > 0 
                    ? `You can safely bunk <strong class="text-emerald-700">${maxBunks}</strong> more class${maxBunks > 1 ? 'es' : ''}.` 
                    : `On track! Don't miss the next class.`
            };
        } else {
            // How many consecutive classes need to be attended?
            // (attended + y) / (total + y) >= target / 100
            // 100 * attended + 100 * y >= target * total + target * y
            // y * (100 - target) >= target * total - 100 * attended
            // y >= (target * total - 100 * attended) / (100 - target)
            const required = Math.ceil((target * total - 100 * attended) / (100 - target));
            
            return {
                status: 'danger',
                message: `You must attend the next <strong class="text-rose-700">${required}</strong> class${required > 1 ? 'es' : ''} to hit the target.`
            };
        }
    }

    // --- Rendering ---
    function render() {
        subjectsContainer.innerHTML = '';

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
                if (subject.total > 0) {
                    percentage = (subject.attended / subject.total) * 100;
                }
                
                const isSafe = percentage >= targetPercentage;
                const statusBadge = clone.querySelector('.status-badge');
                const progressBar = clone.querySelector('.progress-bar');
                const adviceEl = clone.querySelector('.advice-message');
                const percentageText = clone.querySelector('.percentage-text');
                
                // Update UI based on safe/danger status
                percentageText.textContent = `${percentage.toFixed(1)}%`;
                progressBar.style.width = `${Math.min(percentage, 100)}%`;
                
                // Target Marker
                const targetMarker = clone.querySelector('.target-marker');
                targetMarker.style.left = `${targetPercentage}%`;

                const advice = calculateAdvice(subject.attended, subject.total, targetPercentage);
                adviceEl.innerHTML = advice.message;
                
                if (subject.total === 0) {
                    statusBadge.textContent = 'No Data';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gray-100 text-gray-600';
                    progressBar.classList.add('bg-gray-400');
                    percentageText.classList.add('text-gray-400');
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-gray-50 text-gray-600 border border-gray-100';
                } else if (isSafe) {
                    statusBadge.textContent = 'Safe';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700';
                    progressBar.classList.add('bg-emerald-500');
                    percentageText.classList.add('text-emerald-600');
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-emerald-50 text-emerald-800 border border-emerald-100';
                } else {
                    statusBadge.textContent = 'Warning';
                    statusBadge.className = 'status-badge px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-100 text-rose-700';
                    progressBar.classList.add('bg-rose-500');
                    percentageText.classList.add('text-rose-600');
                    adviceEl.className = 'advice-message text-sm rounded-xl p-3 mb-6 font-medium leading-relaxed bg-rose-50 text-rose-800 border border-rose-100';
                }

                // Event Listeners for buttons
                clone.querySelector('.present-btn').addEventListener('click', () => markPresent(subject.id));
                clone.querySelector('.absent-btn').addEventListener('click', () => markAbsent(subject.id));
                clone.querySelector('.reset-btn').addEventListener('click', () => resetSubject(subject.id));
                clone.querySelector('.delete-btn').addEventListener('click', () => {
                    if (confirm(`Are you sure you want to delete "${subject.name}"?`)) {
                        deleteSubject(subject.id);
                    }
                });

                subjectsContainer.appendChild(clone);
            });
        }
    }

    // Run
    init();
});
