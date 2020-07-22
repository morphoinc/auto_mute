/* set browser action's icon & popup page */
/* meet page opened */
chrome.browserAction.setPopup({
    popup: 'popup.html'
});
chrome.browserAction.setIcon({
    path: {
        "16": "images/auto_unmute16.png",
        "32": "images/auto_unmute32.png"
    }
});

/* meet page closed */
// don't work because browserAction.setIcon is async...
// set at background.js
// window.addEventListener('beforeunload', (event) => {
//     chrome.browserAction.setIcon({
//         path: {
//             "16": "images/auto_off16.png",
//             "32": "images/auto_off32.png"
//         }
//     });
//     chrome.browserAction.setPopup({
//         popup: ''
//     });
// });
