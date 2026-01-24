/*
 * YTM Ward - Production Engine
 * Fix: Button Placement (Moved next to 3-Dots)
 */

const GITHUB_URL = 'https://raw.githubusercontent.com/xoundbyte/soul-over-ai/main/dist/artists.json'; 

let blockList = []; 
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
            // UNIVERSAL PARSER
            if (Array.isArray(data)) remoteArtists = data;
            else if (data.artists && Array.isArray(data.artists)) remoteArtists = data.artists;
            else remoteArtists = Object.values(data).flat();
        }
    } catch (e) { }

    // FLATTEN EVERYTHING
    const trackTitles = localTracks.map(t => (typeof t === 'object' && t.title) ? t.title : t);
    const rawList = [...localArtists, ...localKeywords, ...trackTitles, ...remoteArtists];
    
    blockList = [...new Set(rawList)]
        .filter(item => typeof item === 'string' && item.trim().length > 0)
        .map(s => s.toLowerCase())
        .sort(); 
        
    console.log(`[YTM Ward] Engine Loaded ${blockList.length} terms.`);
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

    const checkString = (song.artist + " " + song.title).toLowerCase();
    const match = blockList.find(term => checkString.includes(term));
    
    if (match) {
        lastProcessedSong = song.title;
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

    // Fallback: The container itself if we can't find the dots
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
            // Pass the whole song object
            if (song) addToBlockList(song, 'blockedTracks');
        }));

        // INSERTION: Place AFTER the 3 dots if found, otherwise append to container
        if (threeDots && threeDots.nextSibling) {
            targetParent.insertBefore(container, threeDots.nextSibling);
        } else {
            targetParent.appendChild(container);
        }
        
        console.log("[YTM Ward] 🔴 RED BUTTONS INJECTED (Center) 🔴");
    }
}

async function addToBlockList(term, listName) {
    if (!term) return;
    const targetList = listName || 'blockedArtists';
    
    const localData = await chrome.storage.local.get([targetList]);
    let list = localData[targetList] || [];
    
    // Check duplication (Handles strings & objects)
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