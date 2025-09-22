// Background script for Page Filter Effects
// Handles messages from content script

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === 'openPopup') {
		// Open the extension popup
		chrome.action.openPopup();
		sendResponse({ success: true });
	} else if (request.action === 'updateBadge') {
		// Update extension icon badge
		if (request.isActive) {
			// Show badge when filters are active
			chrome.action.setBadgeText({ text: 'ON' });
			chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' }); // Green
		} else {
			// Hide badge when filters are inactive
			chrome.action.setBadgeText({ text: '' });
		}
		sendResponse({ success: true });
	}
	return true;
});
