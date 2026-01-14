let blockedArtists = [];
let blockedKeywords = [];
let blockedTracks = [];
let aiBlocklist = []; // NEW: The external AI list

// 1. Load settings
const loadSettings = () => {
  chrome.storage.local.get(['blockedArtists', 'blockedKeywords', 'blockedTracks', 'aiBlocklist'], (result) => {
    blockedArtists = result.blockedArtists || [];
    blockedKeywords = result.blockedKeywords || [];
    blockedTracks = result.blockedTracks || [];
    aiBlocklist = result.aiBlocklist || []; // Load AI list
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

// --- SMART MATCHING LOGIC ---
const shouldSkip = (artistLine, songTitle) => {
  const cleanTitle = songTitle.toLowerCase().trim();
  const cleanArtistLine = artistLine.toLowerCase();

  // A. Check Specific Tracks
  const isTrackBlocked = blockedTracks.some(trackObj => {
    const storedTitle = (trackObj.title || trackObj).toLowerCase();
    const storedArtist = (trackObj.artist || "").toLowerCase();
    if (storedTitle !== cleanTitle) return false;
    if (storedArtist && !cleanArtistLine.includes(storedArtist)) return false;
    return true;
  });
  if (isTrackBlocked) return true;

  // B. Check Keywords
  const isKeywordBlocked = blockedKeywords.some(keyword => 
    cleanTitle.includes(keyword.toLowerCase())
  );
  if (isKeywordBlocked) return true;

  // C. Check Artists (Manual + AI List)
  const primaryText = cleanArtistLine.split('•')[0];
  const currentArtists = primaryText.split(/\s*&|\s*,|\s+feat\.|\s+ft\.|\s*\/\s*/g)
    .map(a => a.trim())
    .filter(a => a.length > 0);

  // Combine your manual list with the AI list for checking
  const allBlockedArtists = [...blockedArtists, ...aiBlocklist];

  const isArtistBlocked = allBlockedArtists.some(blocked => {
    const cleanBlocked = blocked.toLowerCase().trim();
    return currentArtists.includes(cleanBlocked);
  });

  return isArtistBlocked;
};

const checkAndSkip = () => {
  const titleEl = document.querySelector('ytmusic-player-bar .title');
  const artistEl = document.querySelector('ytmusic-player-bar .byline'); 

  if (!titleEl || !artistEl) return;

  const title = titleEl.textContent;
  const artistText = artistEl.textContent;

  if (shouldSkip(artistText, title)) {
    console.log(`Skipping blocked content: ${title}`);
    const nextButton = document.querySelector('.next-button');
    if (nextButton) nextButton.click();
  }
};

// ... (Keep the Button Injection code exactly the same as before) ...
// (I will omit the injection code here to save space, but DO NOT delete it from your file)
// Insert the injectBlockButton, observer, and startObserver functions here.

// --- RE-ADD BUTTON INJECTION CODE BELOW THIS LINE IF COPY-PASTING ---
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