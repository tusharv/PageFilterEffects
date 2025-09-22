// Background script for Page Filter Effects
// Handles messages from content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'openPopup') {
		// Open the extension popup
		chrome.action.openPopup();
		sendResponse({ success: true });
	}
	return true;
});
