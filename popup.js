/*
 * YTM Ward - Popup Script (Counter Version)
 * Created by Spirit Flame
 */

// DOM Elements
const tabs = document.querySelectorAll('.tab-btn');
const list = document.getElementById('list');
const input = document.getElementById('input');
const addBtn = document.getElementById('add');
const inputArea = document.getElementById('input-area');
const statusLabel = document.getElementById('status');
const btnRefresh = document.getElementById('btn-refresh');
const btnExport = document.getElementById('btn-export');
const btnImport = document.getElementById('btn-import');
const fileInput = document.getElementById('file-input');

let currentTab = 'keywords';

const KEYS = {
    keywords: 'blockedKeywords',
    songs: 'blockedTracks',
    artists: 'blockedArtists'
};

// --- UTILS ---

function showStatus(msg, color = '#666') {
    if (!statusLabel) return;
    statusLabel.style.color = color;
    statusLabel.textContent = msg;
    setTimeout(() => { statusLabel.textContent = 'Ready.'; statusLabel.style.color = '#666'; }, 3000);
}

function getDisplayText(item) {
    if (typeof item === 'string') return item;
    if (item && item.title) return `${item.artist || 'Unknown'} - ${item.title}`;
    return JSON.stringify(item);
}

function safeSort(items) {
    if (!Array.isArray(items)) return [];
    return items.sort((a, b) => {
        const textA = getDisplayText(a).toLowerCase();
        const textB = getDisplayText(b).toLowerCase();
        return textA.localeCompare(textB);
    });
}

// --- RENDERING ---

function render() {
    list.innerHTML = '';
    
    // AI TAB (Counter View)
    if (currentTab === 'ai') {
        inputArea.style.display = 'none';
        fetchAIList(); 
        return;
    }

    // LOCAL TABS (List View)
    inputArea.style.display = 'flex';
    const key = KEYS[currentTab];
    
    chrome.storage.local.get([key], (res) => {
        let items = res[key] || [];
        items = safeSort(items);
        
        list.innerHTML = '';
        if (items.length === 0) {
            list.innerHTML = '<li style="justify-content:center; color:#555;">List is empty.</li>';
            return;
        }

        items.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${getDisplayText(item)}</span><span class="delete-btn">✖</span>`;
            
            li.querySelector('.delete-btn').onclick = () => {
                removeItem(key, item);
            };
            list.appendChild(li);
        });
    });
}

// --- LOGIC ---

function fetchAIList() {
    list.innerHTML = '<li style="justify-content:center; color:#888;">Checking Database...</li>';
    
    const url = 'https://raw.githubusercontent.com/xoundbyte/soul-over-ai/main/dist/artists.json';
    const t = new Date().getTime(); 
    
    fetch(`${url}?t=${t}`)
        .then(r => {
            if(!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.json();
        })
        .then(data => {
            let raw = [];
            if (Array.isArray(data)) raw = data;
            else if (data.artists) raw = data.artists;
            else raw = Object.values(data).flat();

            const count = raw.length;
            
            // NEW SUMMARY VIEW
            list.innerHTML = `
                <li style="display:block; text-align:center; padding-top:60px; border-bottom:none; pointer-events:none;">
                    <div style="font-size:48px; font-weight:800; color:#ff4444; line-height:1;">${count}</div>
                    <div style="font-size:12px; font-weight:bold; color:#aaa; margin-top:5px; text-transform:uppercase; letter-spacing:1px;">AI Artists Blocked</div>
                    <div style="font-size:10px; color:#555; margin-top:20px;">Source: Soul Over AI Database</div>
                </li>
            `;
            
            showStatus('Database Sync Active', '#4caf50');
        })
        .catch(e => {
            list.innerHTML = `<li style="justify-content:center; color:#ff4444;">Connection Failed: ${e.message}</li>`;
        });
}

function addItem() {
    const val = input.value.trim();
    if (!val) return;
    
    const key = KEYS[currentTab];
    chrome.storage.local.get([key], (res) => {
        const items = res[key] || [];
        
        const newItem = (currentTab === 'songs') 
            ? { title: val, artist: "Manual Entry" } 
            : val;

        const exists = items.some(i => getDisplayText(i) === getDisplayText(newItem));
        
        if (!exists) {
            items.push(newItem);
            chrome.storage.local.set({ [key]: items }, () => {
                input.value = '';
                render();
                showStatus('Added.');
            });
        } else {
            showStatus('Duplicate entry.', '#ff4444');
        }
    });
}

function removeItem(key, val) {
    chrome.storage.local.get([key], (res) => {
        let items = res[key] || [];
        items = items.filter(i => getDisplayText(i) !== getDisplayText(val));
        chrome.storage.local.set({ [key]: items }, render);
    });
}

// --- EVENTS ---

tabs.forEach(tab => {
    tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.tab;
        input.value = '';
        input.placeholder = `Add to ${currentTab}...`;
        render();
    };
});

addBtn.onclick = addItem;
input.addEventListener('keypress', e => { if(e.key === 'Enter') addItem(); });

btnRefresh.onclick = () => {
    if(currentTab === 'ai') fetchAIList();
    else render();
};

btnExport.onclick = () => {
    chrome.storage.local.get(null, (data) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], {type : 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ytm-ward-backup.json';
        a.click();
        showStatus('Exported.');
    });
};

btnImport.onclick = () => fileInput.click();
fileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target.result);
            chrome.storage.local.set(data, () => {
                render();
                showStatus('Import Successful.', '#4caf50');
            });
        } catch(err) {
            showStatus('Invalid JSON File.', '#ff4444');
        }
    };
    reader.readAsText(file);
};

// Start
render();