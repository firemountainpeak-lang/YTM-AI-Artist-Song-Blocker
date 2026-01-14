document.addEventListener('DOMContentLoaded', () => {
  // Inputs & Lists
  const keywordInput = document.getElementById('keyword-input');
  const trackTitleInput = document.getElementById('track-title-input');
  const trackArtistInput = document.getElementById('track-artist-input');
  const artistInput = document.getElementById('artist-input');
  
  const keywordList = document.getElementById('keyword-list');
  const trackList = document.getElementById('track-list');
  const artistList = document.getElementById('artist-list');
  
  // Tabs
  const tabs = {
    keywords: document.getElementById('tab-keywords'),
    tracks: document.getElementById('tab-tracks'),
    artists: document.getElementById('tab-artists'),
    database: document.getElementById('tab-database')
  };
  
  const views = {
    keywords: document.getElementById('view-keywords'),
    tracks: document.getElementById('view-tracks'),
    artists: document.getElementById('view-artists'),
    database: document.getElementById('view-database')
  };

  // Tab Switching
  Object.keys(tabs).forEach(key => {
    tabs[key].onclick = () => {
      Object.values(tabs).forEach(t => t.classList.remove('active'));
      Object.values(views).forEach(v => v.classList.add('hidden'));
      tabs[key].classList.add('active');
      views[key].classList.remove('hidden');
    };
  });

  // Render Logic
  function render() {
    chrome.storage.local.get(['blockedArtists', 'blockedKeywords', 'blockedTracks', 'aiBlocklist'], (result) => {
      renderSimpleList(artistList, result.blockedArtists || [], 'blockedArtists');
      renderSimpleList(keywordList, result.blockedKeywords || [], 'blockedKeywords');
      renderTrackList(trackList, result.blockedTracks || [], 'blockedTracks');
      
      // Update DB Status
      const aiCount = (result.aiBlocklist || []).length;
      document.getElementById('ai-status').innerText = `Active AI Shield: ${aiCount} artists blocked`;
    });
  }

  function renderSimpleList(element, items, storageKey) {
    element.innerHTML = '';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${item}</span> <span class="remove-btn" data-idx="${index}">&#10006;</span>`;
      li.querySelector('.remove-btn').onclick = () => {
        items.splice(index, 1);
        chrome.storage.local.set({ [storageKey]: items }, render);
      };
      element.appendChild(li);
    });
  }

  function renderTrackList(element, items, storageKey) {
    element.innerHTML = '';
    items.forEach((item, index) => {
      const li = document.createElement('li');
      const title = item.title || item;
      const artist = item.artist ? `by ${item.artist}` : '';
      li.innerHTML = `<div class="item-text"><span>${title}</span><span class="sub-text">${artist}</span></div><span class="remove-btn" data-idx="${index}">&#10006;</span>`;
      li.querySelector('.remove-btn').onclick = () => {
        items.splice(index, 1);
        chrome.storage.local.set({ [storageKey]: items }, render);
      };
      element.appendChild(li);
    });
  }

  // --- ADD BUTTONS ---
  document.getElementById('add-keyword-btn').onclick = () => {
    const val = keywordInput.value.trim();
    if (val) addToList('blockedKeywords', val, () => keywordInput.value = '');
  };

  document.getElementById('add-artist-btn').onclick = () => {
    const val = artistInput.value.trim();
    if (val) addToList('blockedArtists', val, () => artistInput.value = '');
  };

  document.getElementById('add-track-btn').onclick = () => {
    const title = trackTitleInput.value.trim();
    const artist = trackArtistInput.value.trim();
    if (title) {
      chrome.storage.local.get(['blockedTracks'], (result) => {
        const list = result.blockedTracks || [];
        const newEntry = { title: title, artist: artist };
        chrome.storage.local.set({ blockedTracks: [...list, newEntry] }, () => {
          trackTitleInput.value = '';
          trackArtistInput.value = '';
          render();
        });
      });
    }
  };

  function addToList(key, value, callback) {
    chrome.storage.local.get([key], (result) => {
      const list = result[key] || [];
      if (!list.includes(value)) {
        chrome.storage.local.set({ [key]: [...list, value] }, () => {
          if (callback) callback();
          render();
        });
      }
    });
  }

  // --- AI SYNC LOGIC ---
  document.getElementById('sync-ai-btn').onclick = async () => {
    const btn = document.getElementById('sync-ai-btn');
    const status = document.getElementById('ai-status');
    btn.disabled = true;
    btn.innerText = "Fetching...";
    
    try {
      const response = await fetch('https://raw.githubusercontent.com/romiem/soul-over-ai/refs/heads/main/dist/artists.json');
      if (!response.ok) throw new Error('Network error');
      
      const data = await response.json();
      // Extract ONLY the "name" field from the JSON objects
      const aiArtists = data.map(item => item.name).filter(n => n);
      
      chrome.storage.local.set({ aiBlocklist: aiArtists }, () => {
        status.innerText = `Success! ${aiArtists.length} AI artists blocked.`;
        btn.innerText = "🔄 Update AI Blocklist";
        btn.disabled = false;
        render();
      });
    } catch (err) {
      console.error(err);
      status.innerText = "Error fetching list. Check permissions.";
      btn.innerText = "Retry";
      btn.disabled = false;
    }
  };

  // --- EXPORT / IMPORT ---
  document.getElementById('export-btn').onclick = () => {
    chrome.storage.local.get(null, (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ytm-ward-backup.json`;
      a.click();
    });
  };

  document.getElementById('import-btn').onclick = () => document.getElementById('file-input').click();
  
  document.getElementById('file-input').onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (confirm('Overwrite current list?')) {
          chrome.storage.local.set(data, () => { alert('Imported.'); render(); });
        }
      } catch (err) { alert('Invalid JSON.'); }
    };
    reader.readAsText(file);
  };

  render();
});