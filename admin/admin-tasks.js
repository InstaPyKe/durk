document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    const addTaskForm = document.getElementById('addTaskForm');

    // Decision Handshake Utility
    const triggerGlassDecision = (title, text, onConfirm, onAbort = () => {}) => {
        const modal = document.getElementById('glassDecisionModal');
        if (!modal) return;
        document.getElementById('decisionTitle').innerText = title;
        document.getElementById('decisionText').innerText = text;
        document.getElementById('decisionIcon').innerHTML = `<i class="bi bi-shield-exclamation text-xl"></i>`;
        
        modal.classList.remove('hidden');
        const cleanup = () => {
            modal.classList.add('hidden');
            document.getElementById('decisionConfirm').onclick = null;
            document.getElementById('decisionAbort').onclick = null;
        };
        document.getElementById('decisionAbort').onclick = () => { cleanup(); onAbort(); };
        document.getElementById('decisionConfirm').onclick = () => { cleanup(); onConfirm(); };
    };

    async function fetchTasks() {
        try {
            const res = await fetch('/api/users/admin/tasks', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const tasks = await res.json();
            
            const renderRows = (list, isSpecialized = false) => list.map(task => {
                const questionsHtml = (task.type === 'survey' && Array.isArray(task.questions)) 
                    ? task.questions.filter(q => q !== null).map((q, i) => `
                        <div class="flex items-start gap-2 mt-1.5 opacity-80 border-l border-indigo-500/30 pl-2">
                            <span class="text-[7px] font-black text-indigo-400 bg-indigo-500/10 px-1 rounded">Q${i+1}</span>
                            <span class="text-[9px] text-gray-400 leading-tight">${q.question_text}</span>
                        </div>
                    `).join('') : '';

                return `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition-all">
                    ${isSpecialized ? `
                    <td class="px-8 py-4">
                        <span class="px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">${task.type}</span>
                    </td>` : ''}
                    <td class="px-8 py-4">
                        <div class="flex flex-col">
                            <span class="text-white font-bold tracking-tight">${task.title}</span>
                            <span class="text-[10px] text-gray-500 mt-1 line-clamp-1 italic">${task.description || 'No specific instructions'}</span>
                            ${!isSpecialized ? `<span class="text-[8px] text-gray-600 font-mono truncate max-w-xs mt-1">${task.video_link}</span>` : ''}
                            ${questionsHtml}
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="flex gap-4 text-[9px] font-bold uppercase tracking-tighter">
                            <div class="flex flex-col"><span class="text-gray-600">Yield</span><span class="text-emerald-400">KSh ${task.reward}</span></div>
                            ${!isSpecialized ? `<div class="flex flex-col"><span class="text-gray-600">Hold</span><span class="text-white">${task.duration}s</span></div>` : ''}
                        </div>
                    </td>
                    <td class="px-8 py-4 text-right">
                        <div class="flex gap-2 justify-end">
                            <button onclick='initEditTask(${JSON.stringify(task).replace(/'/g, "&apos;")})' title="Modify Parameters" class="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black transition flex items-center justify-center">
                                <i class="bi bi-pencil-square"></i>
                            </button>
                            <button onclick="deleteTask(${task.id})" title="Purge Node" class="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition flex items-center justify-center">
                                <i class="bi bi-trash3"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
            }).join('') || `<tr><td colspan="4" class="px-8 py-12 text-center text-gray-700 uppercase tracking-widest text-[9px] font-bold">Node queue empty</td></tr>`;

            const youtubeTasks = tasks.filter(t => t.type === 'youtube');
            const tiktokTasks = tasks.filter(t => t.type === 'tiktok');
            const otherTasks = tasks.filter(t => t.type !== 'youtube' && t.type !== 'tiktok' && t.type !== 'game');

            document.getElementById('youtubeTableBody').innerHTML = renderRows(youtubeTasks);
            document.getElementById('tiktokTableBody').innerHTML = renderRows(tiktokTasks);
            document.getElementById('otherTableBody').innerHTML = renderRows(otherTasks, true);

        } catch (err) { console.error("Task Matrix Sync Error", err); }
    }

    async function fetchSurveyCompletions() {
        try {
            const res = await fetch('/api/users/admin/tasks/survey-completions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const completions = await res.json();
            const tableBody = document.getElementById('surveyCompletionTableBody');
            if (!tableBody) return;

            tableBody.innerHTML = completions.map(c => `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition-all">
                    <td class="px-8 py-4">
                        <div class="flex flex-col">
                            <span class="text-white font-bold tracking-tight">${c.username}</span>
                            <span class="text-[9px] text-gray-500 uppercase">Agent Node</span>
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="flex flex-col">
                            <span class="text-blue-400 font-bold">${c.survey_title}</span>
                            <span class="text-[9px] text-gray-500 uppercase tracking-widest">Survey Matrix</span>
                        </div>
                    </td>
                    <td class="px-8 py-4 font-mono font-bold text-white">
                        ${c.status === 'Awaiting Approval' ? `
                            <input type="number" id="survey_reward_${c.id}" value="${c.reward}" class="w-20 bg-white/5 border border-gray-800 rounded-lg px-2 py-1 text-[10px] text-emerald-400 outline-none focus:border-emerald-500">
                        ` : `KSh ${parseFloat(c.reward).toLocaleString()}`}
                    </td>
                    <td class="px-8 py-4 text-gray-500 text-[10px] font-mono">
                        ${new Date(c.timestamp).toLocaleString()}
                    </td>
                    <td class="px-8 py-4 text-right">
                        ${c.status === 'Awaiting Approval' ? `
                            <div class="flex gap-2 justify-end">
                                <button onclick="processSurveyApproval(${c.id}, 'Completed')" class="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-black transition">Approve</button>
                                <button onclick="processSurveyApproval(${c.id}, 'Rejected')" class="px-3 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition">Reject</button>
                            </div>
                        ` : `
                            <span class="px-2 py-1 rounded-md ${c.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} text-[8px] font-black uppercase tracking-widest border">
                                ${c.status === 'Completed' ? 'Verified Signature' : 
                                  c.status === 'Rejected' ? 'Rejected Node' : c.status}
                            </span>
                        `}
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="5" class="px-8 py-12 text-center text-gray-700 uppercase tracking-widest text-[9px] font-bold">No survey data in buffer</td></tr>`;
        } catch (err) { console.error("Survey Ledger Sync Error", err); }
    }

    async function fetchBlogSubmissions() {
        try {
            const res = await fetch('/api/users/admin/blogs', { headers: { 'Authorization': `Bearer ${token}` } });
            const blogs = await res.json();
            const tableBody = document.getElementById('blogSubmissionTableBody');
            if (!tableBody) return;

            tableBody.innerHTML = blogs.map(b => `
                <tr class="border-t border-gray-800/50 hover:bg-white/[0.02] transition-all">
                    <td class="px-8 py-4">
                        <div class="flex flex-col">
                            <span class="text-white font-bold tracking-tight">${b.username}</span>
                            <span class="text-[9px] text-gray-500 uppercase font-mono">${new Date(b.timestamp).toLocaleDateString()}</span>
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        <div class="flex flex-col max-w-xs">
                            <span class="text-amber-500 font-bold truncate">${b.title}</span>
                            <span class="text-[9px] text-gray-400 uppercase tracking-widest">${b.category}</span>
                            <button onclick="alert(\`${b.content.replace(/"/g, "'")}\`)" class="text-[8px] text-emerald-500 uppercase font-black text-left mt-1 hover:underline">Read Payload</button>
                        </div>
                    </td>
                    <td class="px-8 py-4">
                        ${b.status === 'Pending' ? `
                            <input type="number" id="reward_${b.id}" placeholder="Reward" class="w-20 bg-white/5 border border-gray-800 rounded-lg px-2 py-1 text-[10px] text-emerald-400 outline-none focus:border-emerald-500">
                        ` : `<span class="text-gray-500 font-mono italic">Audit Complete</span>`}
                    </td>
                    <td class="px-8 py-4 text-right">
                        ${b.status === 'Pending' ? `
                            <div class="flex gap-2 justify-end">
                                <button onclick="processBlogApproval(${b.id}, 'Approved')" class="px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] font-black uppercase hover:bg-emerald-500 hover:text-black transition">Authorize</button>
                                <button onclick="processBlogApproval(${b.id}, 'Rejected')" class="px-3 py-1 bg-rose-500/10 text-rose-400 rounded-lg text-[10px] font-black uppercase hover:bg-rose-500 hover:text-white transition">Reject</button>
                            </div>
                        ` : `<span class="px-2 py-1 rounded-md ${b.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'} text-[8px] font-black uppercase tracking-widest border">${b.status}</span>`}
                    </td>
                </tr>
            `).join('') || `<tr><td colspan="4" class="px-8 py-12 text-center text-gray-700 uppercase tracking-widest text-[9px] font-bold">No blog submissions in queue</td></tr>`;
        } catch (err) { console.error("Blog Sync Error", err); }
    }

    window.processBlogApproval = async (id, status) => {
        const reward = document.getElementById(`reward_${id}`)?.value || 0;
        if (status === 'Approved' && (!reward || reward <= 0)) return alert("Please set a reward value for approval.");
        if (!confirm(`Execute blog audit: ${status.toUpperCase()}?`)) return;

        try {
            const res = await fetch(`/api/users/admin/blogs/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status, reward })
            });
            const data = await res.json();
            alert(data.message);
            if (res.ok) fetchBlogSubmissions();
        } catch (err) { alert("Handshake failure."); }
    };

    window.processSurveyApproval = async (id, status) => {
        const rewardInput = document.getElementById(`survey_reward_${id}`);
        const reward = rewardInput ? rewardInput.value : 0;
        
        if (status === 'Completed' && (!reward || reward <= 0)) return alert("Please set a reward value for approval.");

        if (!confirm(`Execute audit protocol: ${status.toUpperCase()} sequence ${id}?`)) return;
        try {
            const res = await fetch(`/api/users/admin/tasks/survey-approvals/${id}`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status, reward })
            });
            const data = await res.json();
            if (res.ok) {
                alert(data.message);
                fetchSurveyCompletions();
            } else alert(data.message);
        } catch (err) { alert("Handshake failure."); }
    };

    window.openDeployModal = (type) => {
        addTaskForm.reset();
        document.getElementById('editTaskId').value = '';
        document.getElementById('modalTitle').innerText = `DEPLOY ${type.toUpperCase()} NODE`;
        
        // Fix select synchronization
        taskTypeSelect.value = type;
        
        // Ensure specialized types are temporarily added to select if not present
        if (type === 'spins' || type === 'survey') {
            if (![...taskTypeSelect.options].some(o => o.value === type)) {
                const opt = new Option(type.toUpperCase(), type);
                taskTypeSelect.add(opt);
            }
            taskTypeSelect.value = type;
        }
        
        // Clear all matrix fields
        document.getElementById('surveyFieldGroup')?.querySelectorAll('input').forEach(el => el.value = '');
        
        document.getElementById('addTaskModal').style.display = 'flex';
        updateFormVisibility();
        // Reset preview state
        document.getElementById('videoPreviewContainer').classList.add('hidden');
        document.getElementById('previewIframe').src = "";
    };

    window.initEditTask = (task) => {
        addTaskForm.reset();
        document.getElementById('editTaskId').value = task.id;
        document.getElementById('modalTitle').innerText = `UPDATE NODE: ${task.id}`;
        
        // If editing spins/survey, ensure they are in the select
        if (task.type === 'spins' || task.type === 'survey') {
            if (![...taskTypeSelect.options].some(o => o.value === task.type)) {
                taskTypeSelect.add(new Option(task.type.toUpperCase(), task.type));
            }
        }

        taskTypeSelect.value = task.type;
        addTaskForm.querySelector('input[name="title"]').value = task.title;
        addTaskForm.querySelector('textarea[name="description"]').value = task.description || '';
        addTaskForm.querySelector('input[name="video_link"]').value = task.video_link;
        addTaskForm.querySelector('input[name="duration"]').value = task.duration;
        addTaskForm.querySelector('input[name="reward"]').value = task.reward;

        if (task.type === 'survey') {
            if (task.questions) {
                task.questions.filter(q => q !== null).forEach((q, i) => {
                    const n = i + 1;
                    if (n > 5) return;
                    const text = addTaskForm.querySelector(`[name="q${n}_text"]`);
                    const a = addTaskForm.querySelector(`[name="q${n}_a"]`);
                    const b = addTaskForm.querySelector(`[name="q${n}_b"]`);
                    const c = addTaskForm.querySelector(`[name="q${n}_c"]`);
                    const d = addTaskForm.querySelector(`[name="q${n}_d"]`);
                    if (text) text.value = q.question_text || '';
                    if (a) a.value = q.option_a || '';
                    if (b) b.value = q.option_b || '';
                    if (c) c.value = q.option_c || '';
                    if (d) d.value = q.option_d || '';
                });
            }
        }

        document.getElementById('addTaskModal').style.display = 'flex';
        updateFormVisibility();
        // Reset preview state
        document.getElementById('videoPreviewContainer').classList.add('hidden');
        document.getElementById('previewIframe').src = "";
    };

    // Logic to toggle input fields based on Task Type
    const taskTypeSelect = document.getElementById('taskTypeSelect');
    const urlFieldGroup = document.getElementById('urlFieldGroup');
    const durationFieldGroup = document.getElementById('durationFieldGroup');
    const surveyFieldGroup = document.getElementById('surveyFieldGroup');
    const videoInput = addTaskForm.querySelector('input[name="video_link"]');
    const durationInput = addTaskForm.querySelector('input[name="duration"]');

    // Function to extract YouTube video ID from various URL formats
    function extractYouTubeVideoId(url) {
        if (!url) return null;
        const trimmed = url.trim();
        // Matches IDs from watch?v=, embed/, shorts/, live/, and youtu.be/ formats
        const match = trimmed.match(/(?:[?&]v=|embed\/|shorts\/|live\/|youtu\.be\/|^)([a-zA-Z0-9_-]{11})/);
        if (match && match[1]) {
            return match[1];
        }
        return /^[a-zA-Z0-9_-]{11}$/.test(trimmed) ? trimmed : null;
    }

    // Function to extract TikTok video ID from various URL formats
    function extractTikTokVideoId(url) {
        if (!url) return null;
        const trimmed = url.trim();
        const match = trimmed.match(/(?:video\/|v\/|vm\.tiktok\.com\/)([\d\w_-]{5,30})/);
        if (match && match[1]) return match[1].split('?')[0];
        if (/^[\d\w_-]{10,30}$/.test(trimmed)) return trimmed;
        return null;
    }

    function updateFormVisibility() {
        const type = taskTypeSelect.value;
        const previewContainer = document.getElementById('videoPreviewContainer');
        const previewIframe = document.getElementById('previewIframe');

        if (previewContainer) previewContainer.classList.add('hidden');
        if (previewIframe) previewIframe.src = "";

        if (type === 'survey') {
            if (surveyFieldGroup) surveyFieldGroup.classList.remove('hidden');
            urlFieldGroup.classList.add('hidden');
            durationFieldGroup.classList.add('hidden');
            videoInput.required = false;
            videoInput.value = "N/A";
            durationInput.value = 0;
        } else if (type === 'youtube' || type === 'tiktok') {
            urlFieldGroup.classList.remove('hidden');
            durationFieldGroup.classList.remove('hidden');
            if (surveyFieldGroup) surveyFieldGroup.classList.add('hidden');
            videoInput.required = true;
        } else {
            urlFieldGroup.classList.add('hidden');
            durationFieldGroup.classList.add('hidden');
            if (surveyFieldGroup) surveyFieldGroup.classList.add('hidden');
            videoInput.required = false;
            // Provide empty/default values for non-video tasks
            videoInput.value = "N/A";
            durationInput.value = 0;
        }
    }

    taskTypeSelect.addEventListener('change', updateFormVisibility);

    // Add event listener to videoInput to automatically clean up YouTube URLs
    videoInput.addEventListener('input', () => {
        const currentUrl = videoInput.value.trim();
        const type = taskTypeSelect.value;
        
        if (currentUrl) {
            if (type === 'youtube') {
                const videoId = extractYouTubeVideoId(currentUrl);
                if (videoId) videoInput.value = `https://www.youtube.com/watch?v=${videoId}`;
            } else if (type === 'tiktok') {
                const videoId = extractTikTokVideoId(currentUrl);
                if (videoId) videoInput.value = `https://www.tiktok.com/video/${videoId}`;
            }
        }
        
        // Hide preview if input is manually edited
        document.getElementById('videoPreviewContainer').classList.add('hidden');
        document.getElementById('previewIframe').src = "";
    });

    window.previewVideo = () => {
        const url = videoInput.value.trim();
        const type = taskTypeSelect.value;
        const container = document.getElementById('videoPreviewContainer');
        const iframe = document.getElementById('previewIframe');

        if (!url || url === 'N/A') return alert("Please provide a valid video link first.");
        
        let embedUrl = "";
        if (type === 'youtube') {
            const videoId = extractYouTubeVideoId(url);
            if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1`;
        } else if (type === 'tiktok') {
            const videoId = extractTikTokVideoId(url);
            if (videoId) embedUrl = `https://www.tiktok.com/embed/v2/${videoId}`;
        }

        if (embedUrl) {
            iframe.src = embedUrl;
            container.classList.remove('hidden');
        } else {
            alert("Unable to generate preview. Please check the URL format.");
            container.classList.add('hidden');
        }
    };

    window.verifyVideoLink = async () => {
        const url = videoInput.value.trim();
        if (!url || url === 'N/A') return alert("Please provide a valid video link first.");

        try {
            const res = await fetch('/api/users/admin/tasks/verify-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            
            if (data.active) {
                alert(`✅ PROTOCOL VERIFIED\nTitle: ${data.title}\nStatus: Active`);
            } else {
                alert(`❌ VERIFICATION FAILED\n${data.message}`);
            }
        } catch (err) {
            alert("Security Protocol: Connection failure during verification.");
        }
    };

    addTaskForm.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(addTaskForm);
        let data = Object.fromEntries(formData.entries());

        // Sanitize numeric fields to prevent 22P02 error in backend ledger
        data.duration = parseInt(data.duration) || 0;
        data.reward = parseFloat(data.reward) || 0;

        const taskId = data.taskId;

        // Pack Survey Questions into a structured array for transmission
        if (data.type === 'survey') {
            data.questions = [];
            for (let i = 1; i <= 5; i++) {
                const text = formData.get(`q${i}_text`);
                if (text && text.trim()) {
                    data.questions.push({
                        text: text.trim(),
                        a: formData.get(`q${i}_a`),
                        b: formData.get(`q${i}_b`),
                        c: formData.get(`q${i}_c`),
                        d: formData.get(`q${i}_d`)
                    });
                }
            }
            
            if (data.questions.length === 0) {
                return alert("❌ DEPLOYMENT BLOCKED: A survey must contain at least one question node.");
            }
        }

        // Automatic Security Protocol: Verify YouTube nodes before deployment
        if (data.type === 'youtube' && data.video_link && data.video_link !== 'N/A') {
            try {
                const verifyRes = await fetch('/api/users/admin/tasks/verify-link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ url: data.video_link })
                });
                const verifyData = await verifyRes.json();
                if (!verifyData.active) {
                    return alert(`❌ AUTOMATIC VERIFICATION FAILED\n${verifyData.message}. Deployment aborted.`);
                }
            } catch (err) { 
                return alert("Security Protocol: Connection failure during automatic verification."); 
            }
        }

        const url = taskId ? `/api/users/admin/tasks/${taskId}` : '/api/users/admin/tasks';
        const method = taskId ? 'PATCH' : 'POST';

        try {
            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(data)
            });
            
            if (res.ok) {
                addTaskForm.reset();
                document.getElementById('addTaskModal').style.display = 'none';
                fetchTasks();
            } else {
                alert("Deployment sequence failed.");
            }
        } catch (err) { alert("Network failure."); }
    };

    window.deleteTask = async (id) => {
        triggerGlassDecision(
            'PURGE NODE',
            `⚠️ SECURITY PROTOCOL: Purge task node #${id} from the pipeline? This action cannot be rolled back.`,
            async () => {
                try {
                    const res = await fetch(`/api/users/admin/tasks/${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        if (window.showSystemMessage) window.showSystemMessage("Node purged successfully.", "success");
                        fetchTasks();
                    } else {
                        if (window.showSystemMessage) window.showSystemMessage("Purge sequence failed.", "error");
                    }
                } catch (err) { 
                    if (window.showSystemMessage) window.showSystemMessage("Network portal breach during purge.", "error"); 
                }
            }
        );
    };

    fetchTasks();
    fetchSurveyCompletions();
    fetchBlogSubmissions();
    updateFormVisibility(); // Initial check on load
});