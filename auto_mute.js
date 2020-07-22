let useAutoMute = null;
let engine = null;
let autoMuteByImage = null;
let autoMuteBySpeech = null;
let displayDebugInfoImage = null;
let displayDebugInfoSpeech = null;
let popupOpend = false;
let deviceId = null;

// FACE_SIZE must be divisible by 32, common sizes are 128, 160, 224, 320, 416, 512, 608,
// the smaller the faster, but less precise in detecting smaller faces
const FACE_SIZE = 224;
const FACE_THRESH = 0.5; // confidence threshold
let mar_thresh = 0.4; // MAR: Mouth Aspect Ratio
const INTERVAL_TIME = 200; // [ms]
const MARGIN_TIME = 1000; // [ms]
const COUNT_INIT = Math.floor(MARGIN_TIME/INTERVAL_TIME);
const LOCAL_STATE = {
    COUNT_ZERO: 0,
    COUNT_MAX: 1,
    COUNT_DOWN: 2
};
const USE_TINY_MODEL = true;
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 180;
const VIDEO_WIDTH = 640;
const VIDEO_HEIGHT = 360;
let localState = LOCAL_STATE.COUNT_MAX;

const video = document.createElement("video");
video.setAttribute("id", "realVideo");
video.setAttribute("style", "display:none");
video.width = VIDEO_WIDTH;
video.height = VIDEO_HEIGHT;
video.autoplay = true;
document.documentElement.appendChild(video);

const canvas = document.createElement("canvas");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;
const ctx = canvas.getContext('2d');
ctx.scale(-1, 1);
ctx.translate(-canvas.width, 0);

const bc_auto_mute = new BroadcastChannel('canvas_bus');

/*! face-api.js | MIT License | https://github.com/justadudewhohacks/face-api.js/blob/master/LICENSE */
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri('/models'),
]).then(startFaceAPI);

SpeechRecognition = webkitSpeechRecognition || SpeechRecognition;
const recognition = new SpeechRecognition();

/***********************/
/*      Utilities      */
/***********************/

function getDistance (a, b) {
    return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function getMar (mouth) {
    // MAR: Mouth Aspect Ratio
    const A = getDistance(mouth[13], mouth[19]); // #62, #68
    const B = getDistance(mouth[14], mouth[18]); // #63, #67
    const C = getDistance(mouth[15], mouth[17]); // #64, #66
    const D = getDistance(mouth[12], mouth[16]); // #61, #65
    const mar = (A + B + C) / D;
    return mar;
}

function drawMouth (ctx, mouth, mar, mar_thresh) {
    ctx.lineWidth = 2;
    if (mar > mar_thresh) {
        ctx.strokeStyle = "#ffffff";
    } else {
        ctx.strokeStyle = "#ff0000";
    }
    ctx.beginPath();
    ctx.moveTo(mouth[12]._x, mouth[12]._y); // #61
    ctx.lineTo(mouth[13]._x, mouth[13]._y); // #62
    ctx.lineTo(mouth[14]._x, mouth[14]._y); // #63
    ctx.lineTo(mouth[15]._x, mouth[15]._y); // #64
    ctx.lineTo(mouth[16]._x, mouth[16]._y); // #65
    ctx.lineTo(mouth[17]._x, mouth[17]._y); // #66
    ctx.lineTo(mouth[18]._x, mouth[18]._y); // #67
    ctx.lineTo(mouth[19]._x, mouth[19]._y); // #68
    ctx.closePath();
    ctx.stroke();
}

function drawResult(ctx, message) {
    // flip before draw text
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    ctx.font = "18pt sans-serif";
    ctx.lineWidth = 2;
    if ("mar" in message) {
        if (message.mar > message.mar_thresh){
            const text = 'Mouth opened';
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(text, 10, 25);
            ctx.fillStyle = "#000000";
            ctx.fillText(text, 10, 25);
        } else {
            const text = 'Mouth closed';
            ctx.strokeStyle = "#ffffff";
            ctx.strokeText(text, 10, 25);
            ctx.fillStyle = "#ff0000";
            ctx.fillText(text, 10, 25);
        }
    }
    else {
        const text = 'No Face';
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(text, 10, 25);
        ctx.fillStyle = "#ff0000";
        ctx.fillText(text, 10, 25);
    }
    ctx.restore();
}

async function startFaceAPI() {
    // startStream();
}

function stopStream() {
    let stream = video.srcObject;
    if (stream) {
        stream.getVideoTracks().forEach(function(track) {
            track.stop();
        });
        stream = null;
    }
}

function startStream() {
    stopStream();

    let constraint;
    if (deviceId) {
        constraint = {audio: false, video: {width: VIDEO_WIDTH, height: VIDEO_HEIGHT, deviceId: deviceId}};
    }
    else {
        constraint = {audio: false, video: {width: VIDEO_WIDTH, height: VIDEO_HEIGHT}};
    }
    navigator.mediaDevices.getUserMedia(constraint)
    .then( (stream) => {
        video.srcObject = stream;
        if (!deviceId) {
            // use random camera
            deviceId = stream.getVideoTracks()[0].getSettings().deviceId;
            chrome.storage.sync.set({'deviceId': deviceId}, function () {
            });
        }
    })
}

function setEachEngineFlag() {
    let prv_autoMuteByImage = autoMuteByImage;
    let prv_autoMuteBySpeech = autoMuteBySpeech;
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

    if (autoMuteByImage !== prv_autoMuteByImage) {
        if (autoMuteByImage) {
            startStream();
        }
        else {
            stopStream();
        }
    }
    if (autoMuteBySpeech !== prv_autoMuteBySpeech) {
        if (autoMuteBySpeech) {
            recognition.stop();
            restartSpeechRecognition();
        }
        else {
            recognition.stop();
        }
    }

    chrome.tabs.query( {active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: 'get_isMuted'}, function(isMuted){
            changeIcon(isMuted, useAutoMute);
        });
    });
}

/* auto-mute on/off botton */
// set initial state to global variable
chrome.storage.sync.get(["useAutoMute", "engine", "displayDebugInfoImage", "displayDebugInfoSpeech", "mar_thresh", "deviceId", "speech_lang"], function(data) {
    useAutoMute = data.useAutoMute;
    engine = data.engine;
    displayDebugInfoImage = data.displayDebugInfoImage;
    displayDebugInfoSpeech = data.displayDebugInfoSpeech;
    mar_thresh = data.mar_thresh;
    deviceId = data.deviceId;
    initializeSpeechRecognition(data.speech_lang);
    setEachEngineFlag();
    autoMuteMain();
});

// set state to global variable when settings are changed at popup
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse){
    if (message.action == "useAutoMute_changed"){
        useAutoMute = message.useAutoMute;
        setEachEngineFlag();
        sendResponse();
    }
    else if (message.action == "engine_changed"){
        engine = message.engine;
        setEachEngineFlag();
        sendResponse();
    }
    else if (message.action == "displayDebugInfoImage_changed"){
        displayDebugInfoImage = message.displayDebugInfoImage;
        sendResponse();
    }
    else if (message.action == "displayDebugInfoSpeech_changed"){
        displayDebugInfoSpeech = message.displayDebugInfoSpeech;
        sendResponse();
    }
    else if (message.action == "mar_thresh_changed"){
        mar_thresh = message.mar_thresh;
        sendResponse();
    }
    else if (message.action == "speech_lang_changed"){
        recognition.lang = message.speech_lang;
        if (autoMuteBySpeech) {
            recognition.stop();
            restartSpeechRecognition();
        }
        sendResponse();
    }
    else if (message.action == "deviceId_changed"){
        deviceId = message.deviceId;
        startStream();
        sendResponse();
    }
    else if (message.action == "change_icon"){
        const isMuted = message.isMuted;
        changeIcon(isMuted, useAutoMute);
        sendResponse();
    }
});


function sendDebugInfoImage(message) {
    if (popupOpend && autoMuteByImage && displayDebugInfoImage) {
        // send canvas to popup
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, canvas.width, canvas.height);
        if ("mar" in message){
            drawMouth(ctx, message.mouth, message.mar, message.mar_thresh);
        }
        drawResult(ctx, message);
        // reference of BroadcastChannel API for canvas: https://hacks.mozilla.org/2015/02/broadcastchannel-api-in-firefox-38/
        canvas.toBlob(function(blob) {
            bc_auto_mute.postMessage(blob);
        });
    }
}


function sendDebugInfoSpeech(message) {
    if (popupOpend && autoMuteBySpeech && displayDebugInfoSpeech) {
        chrome.runtime.sendMessage(message, function (){
        });
    }
}


function sendMicrophoneON() {
    chrome.tabs.query( {active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: 'microphone_on'}, function(){
        });
    });
    chrome.browserAction.setIcon({
        path: {
            "16": "images/auto_unmute16.png",
            "32": "images/auto_unmute32.png"
        }
    });
}

function sendMicrophoneOFF() {
    chrome.tabs.query( {active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: 'microphone_off'}, function(){
        });
    });
    chrome.browserAction.setIcon({
        path: {
            "16": "images/auto_mute16.png",
            "32": "images/auto_mute32.png"
        }
    });
}

function getIsMuted() {
    chrome.tabs.query( {active: true, currentWindow: true}, function(tabs){
        chrome.tabs.sendMessage(tabs[0].id, {action: 'get_isMuted'}, function(isMuted){
            if (isMuted==="mute") {
                localState = LOCAL_STATE.COUNT_ZERO; // set localState mic off
            }
            else if (isMuted==="unmute") {
                localState = LOCAL_STATE.COUNT_MAX; // set localState mic on
            }
            else {
            }
        });
    });
}

chrome.runtime.onConnect.addListener(function(port) {
    if(port.name == "popup_opened"){
        port.onMessage.addListener(function(message) {
            popupOpend = true;
        });
        port.onDisconnect.addListener(function(p){
            popupOpend = false;
        });
    }
});

function changeIcon(isMuted, useAutoMute) {
    if (isMuted==="mute") {
        if (useAutoMute) {
            chrome.browserAction.setIcon({
                path: {
                    "16": "images/auto_mute16.png",
                    "32": "images/auto_mute32.png"
                }
            });
        }
        else {
            chrome.browserAction.setIcon({
                path: {
                    "16": "images/hard_mute16.png",
                    "32": "images/hard_mute32.png"
                }
            });
        }
    }
    else if (isMuted==="unmute") {
        if (useAutoMute) {
            chrome.browserAction.setIcon({
                path: {
                    "16": "images/auto_unmute16.png",
                    "32": "images/auto_unmute32.png"
                }
            });
        }
        else {
            chrome.browserAction.setIcon({
                path: {
                    "16": "images/hard_unmute16.png",
                    "32": "images/hard_unmute32.png"
                }
            });
        }
    }
    else {
        chrome.browserAction.setIcon({
            path: {
                "16": "images/auto_off16.png",
                "32": "images/auto_off32.png"
            }
        });
    }
}

/***********************/
/*    Main Function    */
/***********************/
let message_speech = {action: "sendDebugInfoSpeech", sound: false, recognized: false, recognizedWord: ""};
let on_speech = false;
let on_audio = false;
let on_sound = false;
let on_result = false;
let on_recognizedFinal = false;

function restartSpeechRecognition() {
    if (!autoMuteBySpeech) {
        return;
    }
    setTimeout(function() {
        try {
            recognition.start();
        }
        catch {
            recognition.stop();
            restartSpeechRecognition();
        }
    }, 100);
}

// reference: https://blog.rocky-manobi.com/entry/2018/12/10/052436
function initializeSpeechRecognition(init_speech_lang) {
    recognition.lang = init_speech_lang;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        // console.log('=== on start ===');
        on_recognizedFinal = false;
        message_speech["recognizedWord"] = "";
    };
    recognition.onend = () => {
        // console.log('=== on end ===');
        on_result = false;
    };
    recognition.onerror = event => {
        // console.log('on error:', event.error);
        if (event.error === "no-speech") {
            recognition.stop();
            restartSpeechRecognition();
        }
    };
    recognition.onresult = event => {
        on_result = true;
        message_speech["recognized"] = true;
        // console.log(event.results[0][0].transcript);
        message_speech["recognizedWord"] = event.results[0][0].transcript;
        if (event.results[0].isFinal) {
            on_recognizedFinal = true;
            // console.log('on result restrat:');
            recognition.stop();
            restartSpeechRecognition();
        }
    };
    recognition.onspeechstart = event => {
        on_speech = true;
        // console.log('on speech start');
    };
    recognition.onspeechend = event => {
        on_speech = false;
        on_result = false;
        message_speech["recognized"] = false;
        // console.log('on speech end');
    };
    recognition.onaudiostart = event => {
        on_audio = true;
        // console.log('on audio start');
    };
    recognition.onaudioend = event => {
        on_audio = false;
        on_result = false;
        message_speech["recognized"] = false;
        // console.log('on audio end');
    };
    recognition.onsoundstart = event => {
        on_sound = true;
        message_speech["sound"] = true;
        // console.log('on sound start');
    };
    recognition.onsoundend = event => {
        on_sound = false;
        message_speech["sound"] = false;
        on_result = false;
        message_speech["recognized"] = false;
        // console.log('on sound end');
        setTimeout(() => {
            if (!on_recognizedFinal) {
                recognition.stop();
                restartSpeechRecognition();
            }
        }, 100);
    };
}

function autoMuteMain() {
    let prv_useAutoMute = false;
    let cnt = COUNT_INIT;
    let mar = 0;
    const displaySize = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };
    let message_image = {action: "sendDebugInfoImage"};

    // Loop following process every INTERVAL_TIME
    setInterval(async () => {
        if ((!prv_useAutoMute) && (useAutoMute)) {
            // when turn on auto-mute, set proper localState.
            // this function (chrome.tabs.query) work asynchronously.
            // reference: https://stackoverflow.com/questions/17748101/chrome-extensions-make-chrome-tabs-query-synchronous
            // assume that setting localState is finished before "switch (localState)".
            getIsMuted();
        }
        prv_useAutoMute = useAutoMute;
        if (!useAutoMute) {
            return;
        }

        if (autoMuteByImage) {
            message_image = {action: "sendDebugInfoImage"};
            // Get a face and landmarks from the webcam video image
            const detection = await faceapi.detectSingleFace(
                video,
                new faceapi.TinyFaceDetectorOptions({ inputSize: FACE_SIZE, scoreThreshold: FACE_THRESH})
            ).withFaceLandmarks(USE_TINY_MODEL);

            // Mouth detection and drawing
            if (typeof detection !== 'undefined') {
                // Face is detected
                const resizedDetection = faceapi.resizeResults(detection, displaySize);
                const mouth = resizedDetection.landmarks.getMouth();
                mar = getMar(mouth);
                message_image["mouth"] = mouth;
                message_image["mar"] = mar;
                message_image["mar_thresh"] = mar_thresh;
            } else {
                // Regarded as mouth is closed, if face is not detected
                mar = 0;
            }
        }
        else {
            mar = 0;
        }


        // State Machine
        let speeking_now = (mar > mar_thresh) || (on_result);
        // console.log("speeking_now:", speeking_now, "image:", (mar > mar_thresh), "Speech:", on_result, "localState:", localState);

        switch (localState) {
            case LOCAL_STATE.COUNT_ZERO :
                if (speeking_now) {
                    cnt = COUNT_INIT;
                    localState = LOCAL_STATE.COUNT_MAX;
                    // mute -> unmute
                    sendMicrophoneON();
                } else {
                    localState = LOCAL_STATE.COUNT_ZERO;
                }
                break;
            case LOCAL_STATE.COUNT_MAX :
                if (speeking_now) {
                    localState = LOCAL_STATE.COUNT_MAX;
                } else {
                    localState = LOCAL_STATE.COUNT_DOWN;
                }
                break;
            case LOCAL_STATE.COUNT_DOWN :
                if (speeking_now) {
                    cnt = COUNT_INIT;
                    localState = LOCAL_STATE.COUNT_MAX;
                } else {
                    if (cnt <= 0) {
                        localState = LOCAL_STATE.COUNT_ZERO;
                        // unmute -> mute
                        sendMicrophoneOFF();
                    } else {
                        cnt = cnt - 1;
                        localState = LOCAL_STATE.COUNT_DOWN;
                    }
                }
                break;
        }

        if (autoMuteByImage) {
            message_image["localState"] = localState;
            sendDebugInfoImage(message_image);
        }
        if (autoMuteBySpeech) {
            sendDebugInfoSpeech(message_speech);
        }

    }, INTERVAL_TIME);
}
