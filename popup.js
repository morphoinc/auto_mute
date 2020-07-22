'use strict';
const useAutoMute_checkbox = document.getElementById("useAutoMute");
const camera_selector = document.getElementById("select_camera");
const mar_thresh_range = document.getElementById("range_mar_thresh");
const displayDebugInfoImage_checkbox = document.getElementById("displayDebugInfoImage");
const image = document.getElementById('debug_image');
const speech_lang_selector = document.getElementById("select_speech_lang");
const speechRrecognized = document.getElementById("speechRrecognized");
const speechRrecognizedResults = document.getElementById("speechRrecognizedResults");
const displayDebugInfoSpeech_checkbox = document.getElementById("displayDebugInfoSpeech");

let autoMuteByImage = null;
let autoMuteBySpeech = null;

function setAutoMuteFlag(useAutoMute, engine) {
    if (useAutoMute) {
        if (engine==="engineImageSpeech") {
            autoMuteByImage = true;
            autoMuteBySpeech = true;
        }
        else if (engine==="engineImage") {
            autoMuteByImage = true;
            autoMuteBySpeech = false;
        }
        else if (engine==="engineSpeech") {
            autoMuteByImage = false;
            autoMuteBySpeech = true;
        }
        else {
            console.error("Unsupported engine:", engine);
        }
    }
    else {
        autoMuteByImage = false;
        autoMuteBySpeech = false;
    }
}

// find available camera devices
navigator.mediaDevices.enumerateDevices()
.then(function(devices) {
    const videoDevices = devices.filter(function(element) {
        return element.kind == 'videoinput';
    });
    setCandidateDevices(videoDevices);
    chrome.storage.sync.get(["deviceId"], function(data) {
        camera_selector.value = data.deviceId;
    });
})
.catch(function(err) {
    console.log(err.name + ": " + err.message);
});

// set selector of camera devices
function setCandidateDevices(videoDevices) {
    videoDevices.forEach(function(device, index) {
        let option = document.createElement('option');
        option.setAttribute('value', device.deviceId);
        let label = device.label !== "" ? device.label : ("camera " + index);
        option.innerHTML = label;
        camera_selector.appendChild(option);
    });
}


// set DOM attributes using storage value, when popup page is opened
chrome.storage.sync.get(["useAutoMute", "engine", "displayDebugInfoImage", "displayDebugInfoSpeech", "mar_thresh", "speech_lang"], function(data) {
    useAutoMute_checkbox.checked = data.useAutoMute;
    const engine = data.engine;
    $('input[name=engine]').val([engine]);
    displayDebugInfoImage_checkbox.checked = data.displayDebugInfoImage;
    displayDebugInfoSpeech_checkbox.checked = data.displayDebugInfoSpeech;
    mar_thresh_range.value = data.mar_thresh;
    speech_lang_selector.value = data.speech_lang;
    clearDebugInfoImage();
    clearDebugInfoSpeech();
    setAutoMuteFlag(useAutoMute_checkbox.checked, engine);
    if (engine==="engineImageSpeech") {
        $("#imageSettings").collapse('show');
        $("#speechSettings").collapse('show');
    }
    else if (engine==="engineImage") {
        $("#imageSettings").collapse('show');
        $("#speechSettings").collapse('hide');
    }
    else if (engine==="engineSpeech") {
        $("#imageSettings").collapse('hide');
        $("#speechSettings").collapse('show');
    }
    else {
        console.error("Unsupported engine:", engine);
    }

    if (useAutoMute_checkbox.checked) {
        $("#settings").collapse('show');
    }
    else {
        $("#settings").collapse('hide');
    }
});


// change storage value & call content script when the checkbox status is changed.
function sendMessageMeetTab(message) {
    chrome.tabs.query({url: "https://meet.google.com/*"}, function(tabs){
        if (tabs.length == 1){
            chrome.tabs.sendMessage(tabs[0].id, message, function(){
            });
        }
        else {
            console.error("Unexpected meet tabs:", tabs.length, tabs)
        }
    });
}


function clearDebugInfoImage() {
    image.src = "";
}

function clearDebugInfoSpeech() {
    speechRrecognized.innerText = "";
    speechRrecognizedResults.innerText = "";
}

$(function() {
    $('#useAutoMute').change(function() {
        const useAutoMute_checked = $(this).prop('checked');
        setAutoMuteFlag(useAutoMute_checked, $('input[name=engine]:checked').val());
        clearDebugInfoImage();
        clearDebugInfoSpeech();
        chrome.storage.sync.set({'useAutoMute': useAutoMute_checked}, function () {
        });
        sendMessageMeetTab({action: "useAutoMute_changed", useAutoMute: useAutoMute_checked});
    });
});

$(function(){
    $('input[name="engine"]:radio').change(function() {
        const engine_val = $(this).val();
        setAutoMuteFlag(useAutoMute_checkbox.checked, engine_val);
        clearDebugInfoImage();
        clearDebugInfoSpeech();
        chrome.storage.sync.set({'engine': engine_val}, function () {
        });
        sendMessageMeetTab({action: "engine_changed", engine: engine_val});
    });
});


$(function() {
    $('#range_mar_thresh').change(function() {
        mar_thresh_range.value = $(this).val();
        chrome.storage.sync.set({'mar_thresh': mar_thresh_range.value}, function () {
        });
        sendMessageMeetTab({action: "mar_thresh_changed", mar_thresh: mar_thresh_range.value});
    });
});

$(function() {
    $('#select_camera').change(function() {
        const deviceId = $(this).val();
        chrome.storage.sync.set({'deviceId': deviceId}, function () {
        });
        sendMessageMeetTab({action: "deviceId_changed", deviceId: deviceId});
    });
});

$(function() {
    $('#displayDebugInfoImage').change(function() {
        displayDebugInfoImage_checkbox.checked = $(this).prop('checked');
        clearDebugInfoImage();
        chrome.storage.sync.set({'displayDebugInfoImage': displayDebugInfoImage_checkbox.checked}, function () {
        });
        sendMessageMeetTab({action: "displayDebugInfoImage_changed", displayDebugInfoImage: displayDebugInfoImage_checkbox.checked});
    });
});

$(function() {
    $('#select_speech_lang').change(function() {
        speech_lang_selector.value = $(this).val();
        chrome.storage.sync.set({'speech_lang': speech_lang_selector.value}, function () {
        });
        sendMessageMeetTab({action: "speech_lang_changed", speech_lang: speech_lang_selector.value})
    });
});

$(function() {
    $('#displayDebugInfoSpeech').change(function() {
        displayDebugInfoSpeech_checkbox.checked = $(this).prop('checked');
        clearDebugInfoSpeech();
        chrome.storage.sync.set({'displayDebugInfoSpeech': displayDebugInfoSpeech_checkbox.checked}, function () {
        });
        sendMessageMeetTab({action: "displayDebugInfoSpeech_changed", displayDebugInfoSpeech: displayDebugInfoSpeech_checkbox.checked});
    });
});


chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    if (message.action=="sendDebugInfoSpeech") {
        if (displayDebugInfoSpeech_checkbox.checked && autoMuteBySpeech){
            if (message.recognized) {
                speechRrecognized.style.color = "red";
                speechRrecognized.innerText = "Voice Recognized";
                speechRrecognizedResults.style.color = "black";
                speechRrecognizedResults.innerText = message.recognizedWord;
            }
            else {
                speechRrecognized.style.color = "black";
                speechRrecognized.innerText = "No voice";
                speechRrecognizedResults.style.color = "black";
                speechRrecognizedResults.innerText = "";
            }
        }
        sendResponse();
    }
})


/* check popup opened at auto_mute_by_image.js */
// reference: https://stackoverflow.com/questions/15798516/is-there-an-event-for-when-a-chrome-extension-popup-is-closed
const port = chrome.runtime.connect({name: "popup_opened"});
port.postMessage({message: "opened"});


const bc_auto_mute = new BroadcastChannel('canvas_bus');
bc_auto_mute.onmessage = function(e) {
    if (displayDebugInfoImage_checkbox.checked && autoMuteByImage){
        const url = URL.createObjectURL(e.data);
        image.src = url;
    }
};
