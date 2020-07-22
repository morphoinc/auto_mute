let micButton = null;

/* Microphone button settings */
/*! Vitamin Meeeeet | MIT License | https://github.com/hasegawayosuke/vitamin-meeeeet/blob/master/LICENSE */
/*! Google Meet Push to Talk | MIT License | https://github.com/jcw-os/google-meet-ptt/blob/master/LICENSE */
const target_node = document.querySelector('div.kFwPee');
const mute_observer = new MutationObserver(records => {
    document.querySelectorAll('[data-tooltip]').forEach((element) => {
        if (element.dataset.tooltip && (element.dataset.tooltip.includes('⌘+D') || element.dataset.tooltip.toUpperCase().includes('CTRL+D'))) {
            if (micButton !== element) {
                micButton = element;
                const isMuted = getIsMuted();
                chrome.runtime.sendMessage({action: "change_icon", isMuted: isMuted}, function (){
                });
                listenForMicButtonClick();
            }
        }
    });
})
if (target_node) {
    mute_observer.observe(target_node, {
        childList: true,
        subtree: true
    })
}
else {
    console.log("Can't find target node!");
}

/*! Google-Meet-Mute-Toggler | MIT License | https://github.com/jasonketola/Google-Meet-Mute-Toggler/blob/master/LICENSE */
// Determine if the OS being used is macOS or something else. If macOS send metakey+d, otherwise send ctrl+d
let OSName = "other";
if (navigator.appVersion.indexOf("Mac")!=-1) OSName="MacOS";
function pressCtrlD() {
    if (OSName == "MacOS") {
        document.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                metaKey: true,
                keyCode: 68,
                code: "KeyD"
            })
        );
    } else {
        document.dispatchEvent(
            new KeyboardEvent("keydown", {
                bubbles: true,
                cancelable: true,
                ctrlKey: true,
                keyCode: 68,
                code: "KeyD"
            })
        );
    }
}

// change browser action icon when MicButton clicked
function listenForMicButtonClick() {
    micButton.addEventListener('click', (e) => {
        const isMuted = getIsMuted();
        chrome.runtime.sendMessage({action: "change_icon", isMuted: isMuted}, function (){
        });
    });
}

// change browser action icon when ctrl-D is pressed
window.addEventListener("keydown", function(event) {
    if (OSName == "MacOS") {
        if (event.key === "d" && event.metaKey) {
            const isMuted = getIsMuted();
            chrome.runtime.sendMessage({action: "change_icon", isMuted: isMuted}, function (){
            });
        }
    }
    else {
        if (event.key === "d" && event.ctrlKey) {
            const isMuted = getIsMuted();
            chrome.runtime.sendMessage({action: "change_icon", isMuted: isMuted}, function (){
            });
        }
    }
});

function getIsMuted() {
    let isMuted;
    if (micButton) {
        if (micButton.dataset.isMuted === 'true') {
            isMuted = "mute";
        }
        else if (micButton.dataset.isMuted === 'false') {
            isMuted = "unmute";
        }
    }
    else {
        isMuted = "unknown";
    }
    return isMuted;
}


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    if (message.action == "microphone_on"){
        if (micButton){
            if (micButton.dataset.isMuted === 'true') {
                pressCtrlD();
            }
        }
        else {
            // When microphone button element (micButton) is NOT found, just toggle microphone.
            pressCtrlD();
        }
        sendResponse();
    }
    else if (message.action == "microphone_off"){
        if (micButton){
            if (micButton.dataset.isMuted === 'false') {
                pressCtrlD();
            }
        }
        else {
            // When microphone button element (micButton) is NOT found, just toggle microphone.
            pressCtrlD();
        }
        sendResponse();
    }
    else if (message.action == "get_isMuted"){
        const isMuted = getIsMuted();
        sendResponse(isMuted);
    }
});


/* Load auto-mute engine */
function injectAutoMuteByImage() {
    ifr = document.createElement('iframe');
    ifr.setAttribute('allow', 'microphone; camera');
    ifr.style.display = 'none';
    ifr.src = chrome.runtime.getURL('auto_mute.html');
    document.body.appendChild(ifr);
}
injectAutoMuteByImage();
