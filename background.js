'use strict';

chrome.runtime.onInstalled.addListener(function() {
    chrome.storage.sync.set({"useAutoMute": true}, function() {
    });
    chrome.storage.sync.set({"engine": "engineImageSpeech"}, function() {
    });
    chrome.storage.sync.set({"displayDebugInfoImage": true}, function() {
    });
    chrome.storage.sync.set({"displayDebugInfoSpeech": true}, function() {
    });
    chrome.storage.sync.set({"mar_thresh": 0.4}, function() {
    });
    chrome.storage.sync.set({"speech_lang": 'ja'}, function() {
    });
    chrome.storage.sync.set({"deviceId": null}, function() {
    });
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo){
    chrome.tabs.query({url: "https://meet.google.com/*"}, function(tabs){
        if (tabs.length == 0){
            chrome.browserAction.setIcon({
                path: {
                    "16": "images/auto_off16.png",
                    "32": "images/auto_off32.png"
                }
            });
            chrome.browserAction.setPopup({
                popup: ''
            });
        }
    });
});
