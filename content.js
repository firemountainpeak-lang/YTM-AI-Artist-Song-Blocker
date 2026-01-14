let blockedArtists = [];
let blockedKeywords = [];
let blockedTracks = [];
let aiBlocklist = []; 

const loadSettings = () => {
  chrome.storage.local.get(['blockedArtists', 'blockedKeywords', 'blockedTracks', 'aiBlocklist'], (result) => {
    blockedArtists = result.blockedArtists || [];
    blockedKeywords = result.blockedKeywords || [];
    blockedTracks = result.blockedTracks || [];
    aiBlocklist = result.aiBlocklist || [];
    checkAndSkip(); 
  });
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.blockedArtists) blockedArtists = changes.blockedArtists.newValue;
    if (changes.blockedKeywords) blockedKeywords = changes.blockedKeywords.newValue;
    if (changes.blockedTracks) blockedTracks = changes.blockedTracks.newValue;
    if (changes.aiBlocklist) aiBlocklist = changes.aiBlocklist.newValue;
    checkAndSkip();
  }
});

const shouldSkip = (artistLine, songTitle) => {
  const cleanTitle = songTitle.toLowerCase().trim();
  const cleanArtistLine = artistLine.toLowerCase();

  // 1. Check Specific Tracks (Exact Match)
  const isTrackBlocked = blockedTracks.some(trackObj => {
    const storedTitle = (trackObj.title || trackObj).toLowerCase();
    const storedArtist = (trackObj.artist || "").toLowerCase();
    return storedTitle === cleanTitle && (!storedArtist || cleanArtistLine.includes(storedArtist));
  });
  if (isTrackBlocked) return true;

  // 2. Check Keywords (Partial Match)
  const isKeywordBlocked = blockedKeywords.some(keyword => cleanTitle.includes(keyword.toLowerCase()));
  if (isKeywordBlocked) return true;

  // 3. Check Manual Artists (Split Strategy)
  const primaryText = cleanArtistLine.split('•')[0];
  const currentArtists = primaryText.split(/\s*&|\s*,|\s+feat\.|\s+ft\.|\s*\/\s*|\s+x\s+/g)
    .map(a => a.trim())
    .filter(a => a.length > 0);

  const isManualBlocked = blockedArtists.some(blocked => {
    return currentArtists.includes(blocked.toLowerCase().trim());
  });
  if (isManualBlocked) return true;

  // 4. Check AI Blocklist (AGGRESSIVE SUBSTRING MATCH)
  const isAiBlocked = aiBlocklist.some(aiArtist => {
    const cleanAi = aiArtist.toLowerCase().trim();
    if (cleanAi.length > 3) {
      return cleanArtistLine.includes(cleanAi);
    } else {
      return currentArtists.includes(cleanAi);
    }
  });

  if (isAiBlocked) {
    console.log(`Skipping AI Slop: ${artistLine}`);
    return true;
  }

  return false;
};

const checkAndSkip = () => {
  const titleEl = document.querySelector('ytmusic-player-bar .title');
  const artistEl = document.querySelector('ytmusic-player-bar .byline'); 

  if (!titleEl || !artistEl) return;

  const title = titleEl.textContent;
  const artistText = artistEl.textContent;

  if (shouldSkip(artistText, title)) {
    const nextButton = document.querySelector('.next-button');
    if (nextButton) nextButton.click();
  }
};

const createBtn = (id, text, onClick) => {
  const btn = document.createElement('button');
  btn.id = id;
  btn.innerText = text;
  btn.style.cssText = `background: transparent; color: #aaa; border: 1px solid #aaa; border-radius: 16px; margin: 0 4px; padding: 5px 10px; cursor: pointer; font-weight: bold; font-size: 12px;`;
  btn.onmouseover = () => { btn.style.color = 'white'; btn.style.borderColor = 'white'; };
  btn.onmouseout = () => { btn.style.color = '#aaa'; btn.style.borderColor = '#aaa'; };
  btn.onclick = onClick;
  return btn;
};

const injectBlockButton = () => {
  const rightControls = document.querySelector('ytmusic-player-bar .right-controls-buttons');
  if (rightControls) {
    if (!document.getElementById('ytm-block-artist-btn')) {
      const btnArtist = createBtn('ytm-block-artist-btn', '🚫 Artist', () => {
        const artistEl = document.querySelector('ytmusic-player-bar .byline');
        if (artistEl) {
          const rawText = artistEl.textContent.trim();
          const artistToBlock = rawText.split('•')[0].trim();
          if (artistToBlock && !blockedArtists.includes(artistToBlock)) {
            const newList = [...blockedArtists, artistToBlock];
            chrome.storage.local.set({ blockedArtists: newList }, () => {
              alert(`Blocked Artist: ${artistToBlock}`);
              checkAndSkip(); 
            });
          }
        }
      });
      rightControls.prepend(btnArtist);
    }
    if (!document.getElementById('ytm-block-song-btn')) {
      const btnSong = createBtn('ytm-block-song-btn', '🚫 Song', () => {
        const titleEl = document.querySelector('ytmusic-player-bar .title');
        const artistEl = document.querySelector('ytmusic-player-bar .byline');
        if (titleEl && artistEl) {
          const songTitle = titleEl.textContent.trim();
          const rawArtist = artistEl.textContent.trim().split('•')[0].trim();
          const exists = blockedTracks.some(t => (t.title || t) === songTitle && (t.artist || "") === rawArtist);
          if (!exists) {
            const newEntry = { title: songTitle, artist: rawArtist };
            const newList = [...blockedTracks, newEntry];
            chrome.storage.local.set({ blockedTracks: newList }, () => {
              alert(`Blocked Song: "${songTitle}" by ${rawArtist}`);
              checkAndSkip(); 
            });
          }
        }
      });
      rightControls.prepend(btnSong);
    }
  }
};

const observer = new MutationObserver(() => { checkAndSkip(); injectBlockButton(); });
const startObserver = () => {
  const playerBar = document.querySelector('ytmusic-player-bar');
  if (playerBar) {
    observer.observe(playerBar, { childList: true, subtree: true, characterData: true });
    injectBlockButton();
    loadSettings();
  } else { setTimeout(startObserver, 1000); }
};
startObserver();