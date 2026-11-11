/*
 * YTM Ward - Production Engine
 * Fix: "Whole Word" Matching (No more partial match false positives)
 */

const GITHUB_URL = 'https://raw.githubusercontent.com/xoundbyte/soul-over-ai/main/dist/artists.json'; 

let blockList = [];
let trackList = [];
let blockRegexes = [];
let lastCheckedKey = "";
let lastProcessedSong = ""; 

console.log("[YTM Ward] Engine Started. Created by Spirit Flame (spiritflame@tutamail.com)");

function waitForElement(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) return resolve(document.querySelector(selector));
        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });
}

function simulateClick(element) {
    ['mousedown', 'mouseup', 'click'].forEach(eventType => {
        element.dispatchEvent(new MouseEvent(eventType, {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    });
}

async function updateBlockList() {
    const localData = await chrome.storage.local.get(['blockedArtists', 'blockedKeywords', 'blockedTracks']);
    const localArtists = localData.blockedArtists || [];
    const localKeywords = localData.blockedKeywords || []; 
    const localTracks = localData.blockedTracks || []; 
    
    let remoteArtists = [];
    try {
        const response = await fetch(GITHUB_URL); 
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) remoteArtists = data;
            else if (data.artists && Array.isArray(data.artists)) remoteArtists = data.artists;
            else remoteArtists = Object.values(data).flat();
        }
    } catch (e) { }

    const remoteNames = remoteArtists
        .map(a => typeof a === 'string' ? a : (a && typeof a.name === 'string' && a.removed !== true ? a.name : null))
        .filter(Boolean);
    const rawList = [...localArtists, ...localKeywords, ...remoteNames];

    trackList = localTracks
        .map(t => typeof t === 'string'
            ? { title: t.trim().toLowerCase(), artist: null }
            : { title: String((t && t.title) || '').trim().toLowerCase(),
                artist: (t && typeof t.artist === 'string') ? primaryArtist(t.artist) : null })
        .filter(t => t.title.length > 0);
    
    blockList = [...new Set(rawList)]
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(s => s.toLowerCase()) // Keep lowercase for case-insensitive matching
        .sort(); 

    blockRegexes = blockList.map(term => {
        const safeTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return { term, regex: new RegExp(`(?<![\\p{L}\\p{N}_])${safeTerm}(?![\\p{L}\\p{N}_])`, 'iu') };
    });
    lastCheckedKey = "";

    console.log(`[YTM Ward] Engine Loaded ${blockList.length} terms.`);
}

function primaryArtist(byline) {
    return byline.split('•')[0].trim().toLowerCase();
}

function skipTrack() {
    const nextBtn = document.querySelector("ytmusic-player-bar .next-button");
    if (nextBtn) simulateClick(nextBtn);

    setTimeout(() => {
        const video = document.querySelector("video");
        if (video && !video.ended) video.currentTime = video.duration || 99999;
    }, 500);
}

function performDownvoteAndSkip() {
    const dislikeWrapper = document.querySelector(".middle-controls-buttons .dislike") || 
                           document.querySelector("ytmusic-player-bar .dislike");

    if (!dislikeWrapper) { skipTrack(); return; }

    const actualBtn = dislikeWrapper.querySelector("button") || dislikeWrapper;
    const isPressed = dislikeWrapper.getAttribute("aria-pressed") === "true" || 
                      actualBtn.getAttribute("aria-pressed") === "true";

    if (!isPressed) simulateClick(actualBtn);
    else { skipTrack(); return; }

    let attempts = 0;
    const poll = setInterval(() => {
        attempts++;
        const success = dislikeWrapper.getAttribute("aria-pressed") === "true" || 
                        actualBtn.getAttribute("aria-pressed") === "true";
        
        if (success || attempts >= 20) { 
            clearInterval(poll);
            if (success) setTimeout(() => { skipTrack(); }, 2000); 
            else skipTrack();
        }
    }, 100);
}

function getSongInfo() {
    const titleEl = document.querySelector("ytmusic-player-bar .title");
    const bylineEl = document.querySelector("ytmusic-player-bar .byline");
    if (!titleEl || !bylineEl) return null;
    return { title: titleEl.textContent.trim(), artist: bylineEl.textContent.trim() };
}

function checkAndSkip() {
    const song = getSongInfo();
    if (!song) return;
    if (song.title === lastProcessedSong) return;
    const songKey = song.artist + "\n" + song.title;
    if (songKey === lastCheckedKey) return;
    lastCheckedKey = songKey;

    const songTitle = song.title.trim().toLowerCase();
    const songArtist = primaryArtist(song.artist);
    const trackHit = trackList.find(t => t.title === songTitle && (t.artist === null || t.artist === songArtist));
    if (trackHit) {
        lastProcessedSong = song.title;
        console.log(`[YTM Ward] 🛑 BLOCKED: song "${song.title}"`);
        performDownvoteAndSkip();
        return;
    }

    // Combine Artist and Title for checking
    const checkString = (song.artist + " " + song.title).toLowerCase();

    // MATCHING LOGIC: Whole Word Regex
    // whole-word match that also works for accented, non-Latin and punctuation-ending names
    const hit = blockRegexes.find(r => r.regex.test(checkString));
    const match = hit ? hit.term : null;
    
    if (match) {
        lastProcessedSong = song.title;
        console.log(`[YTM Ward] 🛑 BLOCKED: Found whole word "${match}"`);
        performDownvoteAndSkip();
    }
}

function createButton(text, onClick) {
    const btn = document.createElement("button");
    btn.innerText = text;
    btn.style.cssText = `
        background: rgba(255, 0, 0, 0.2); border: 1px solid #ff4444; color: #ffcccc; 
        border-radius: 4px; margin: 0 5px; padding: 6px 12px; cursor: pointer; 
        font-size: 11px; font-weight: 800; text-transform: uppercase; z-index: 9999;
    `;
    btn.onmouseenter = () => { btn.style.background = "#ff4444"; btn.style.color = "black"; };
    btn.onmouseleave = () => { btn.style.background = "rgba(255, 0, 0, 0.2)"; btn.style.color = "#ffcccc"; };
    btn.onclick = (e) => { e.stopPropagation(); onClick(); };
    return btn;
}

function injectButtons() {
    if (document.getElementById("ytm-ward-controls")) return;

    // TARGET: The "3 Dots" Menu
    const threeDots = document.querySelector("ytmusic-player-bar .middle-controls-buttons ytmusic-menu-renderer") ||
                      document.querySelector("ytmusic-player-bar ytmusic-menu-renderer");

    const targetParent = threeDots ? threeDots.parentNode : document.querySelector("ytmusic-player-bar .middle-controls-buttons");

    if (targetParent) {
        const container = document.createElement("div");
        container.id = "ytm-ward-controls";
        container.style.display = "inline-flex";
        container.style.alignItems = "center";
        
        container.appendChild(createButton("🚫 ARTIST", () => {
            const song = getSongInfo();
            if (song) addToBlockList(song.artist, 'blockedArtists');
        }));
        
        container.appendChild(createButton("🚫 SONG", () => {
            const song = getSongInfo();
            if (song) addToBlockList(song, 'blockedTracks');
        }));

        if (threeDots && threeDots.nextSibling) {
            targetParent.insertBefore(container, threeDots.nextSibling);
        } else {
            targetParent.appendChild(container);
        }
    }
}

async function addToBlockList(term, listName) {
    if (!term) return;
    const targetList = listName || 'blockedArtists';
    
    const localData = await chrome.storage.local.get([targetList]);
    let list = localData[targetList] || [];
    
    const exists = list.some(item => {
        if (typeof term === 'string') return item === term;
        return item.title === term.title;
    });

    if (!exists) {
        list.push(term);
        const update = {};
        update[targetList] = list;
        await chrome.storage.local.set(update);
        await updateBlockList();
        performDownvoteAndSkip();
    }
}

async function init() {
    await updateBlockList();
    const playerBar = await waitForElement("ytmusic-player-bar");
    injectButtons();
    checkAndSkip();

    const observer = new MutationObserver(() => {
        checkAndSkip(); 
        if (!document.getElementById("ytm-ward-controls")) injectButtons();
    });

    observer.observe(playerBar, { subtree: true, childList: true, attributes: true });
    
    const titleNode = document.querySelector("ytmusic-player-bar .title");
    if (titleNode) {
        new MutationObserver(() => checkAndSkip())
            .observe(titleNode, { characterData: true, subtree: true, childList: true });
    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', init); } else { init(); }
chrome.storage.onChanged.addListener((changes, namespace) => { if (namespace === 'local') updateBlockList(); });