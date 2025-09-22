// Configuration object to eliminate redundant switch statements
const FILTER_CONFIG = {
	blur: { unit: 'px', defaultValue: 0 },
	brightness: { unit: '', defaultValue: 1 },
	contrast: { unit: '', defaultValue: 1 },
	'hue-rotate': { unit: 'deg', defaultValue: 0 },
	saturate: { unit: '%', defaultValue: 100 },
	grayscale: { unit: '', defaultValue: 0 },
	sepia: { unit: '', defaultValue: 0 },
	invert: { unit: '', defaultValue: 0 }
};

// Storage keys for persistence
const STORAGE_KEYS = {
	FILTER_VALUES: 'pageFilterValues',
	CURRENT_URL: 'currentUrl'
};

// Get current domain for domain-specific storage
async function getCurrentDomain() {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab || !tab.url) return null;
		
		const url = new URL(tab.url);
		return url.hostname;
	} catch (error) {
		console.error('Popup: Error getting domain:', error);
		return null;
	}
}

// Get domain-specific storage key
function getDomainStorageKey(domain) {
	return `pageFilterValues_${domain}`;
}

// Fallback storage using localStorage
function getFallbackStorage() {
	try {
		return localStorage;
	} catch (error) {
		console.warn('localStorage not available:', error);
		return null;
	}
}

// Save to fallback storage
function saveToFallbackStorage(key, value) {
	const storage = getFallbackStorage();
	if (storage) {
		try {
			storage.setItem(key, JSON.stringify(value));
			console.log('Popup: Saved to fallback storage:', key, value);
		} catch (error) {
			console.error('Error saving to fallback storage:', error);
		}
	}
}

// Load from fallback storage
function loadFromFallbackStorage(key) {
	const storage = getFallbackStorage();
	if (storage) {
		try {
			const item = storage.getItem(key);
			const result = item ? JSON.parse(item) : null;
			console.log('Popup: Loaded from fallback storage:', key, result);
			return result;
		} catch (error) {
			console.error('Error loading from fallback storage:', error);
			return null;
		}
	}
	return null;
}

// Apply loaded values to the page (only if they're not default values)
async function applyLoadedValues() {
	try {
		const configParts = [];
		let hasNonDefaultValues = false;
		
		getInputs().forEach(input => {
			const { name, value, type } = input;
			
			if (type === 'range' && !isDefault(name, parseFloat(value))) {
				configParts.push(`${name}(${value}${getUnit(name)})`);
				hasNonDefaultValues = true;
			} else if (type === 'checkbox' && !isDefault(name, input.checked)) {
				configParts.push(`${name}(${input.checked ? '1' : '0'})`);
				hasNonDefaultValues = true;
			}
		});
		
		if (!hasNonDefaultValues) {
			console.log('No non-default values to apply');
			return;
		}
		
		const filterConfig = configParts.join(' ');
		console.log('Applying loaded filter values:', filterConfig);
		
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		
		if (!tab?.id) {
			console.warn('No active tab found for applying loaded values');
			return;
		}
		
		// Don't apply filters on extension pages or other restricted pages
		if (tab.url && (tab.url.startsWith('chrome-extension://') || 
						tab.url.startsWith('chrome://') || 
						tab.url.startsWith('moz-extension://') ||
						tab.url.includes('popup.html') ||
						tab.url.includes('extension://'))) {
			console.log('Skipping filter application on extension page');
			return;
		}
		
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: (filterString) => {
				console.log('Applying loaded filter in page:', filterString);
				
				// Apply filter directly to body
				document.body.style.filter = filterString;
				document.body.style.transition = 'filter 0.3s ease-out';
				console.log('Loaded filter applied successfully');
			},
			args: [filterConfig]
		});
		
		// Update extension icon badge to show effects are active
		updateExtensionBadge(true);
		
		console.log('Loaded values applied successfully');
		showNotification('Previous filters restored!', 'success');
	} catch (error) {
		console.error('Error applying loaded values:', error);
		// Don't show error notification for loaded values
	}
}

function getUnit(name) {
	return FILTER_CONFIG[name]?.unit || '';
}

function isDefault(name, value) {
	const config = FILTER_CONFIG[name];
	if (!config) return false;
	
	// Handle boolean values for checkboxes
	if (typeof value === 'boolean') {
		return value === false; // false is default for checkboxes
	}
	
	// Handle numeric values
	return parseFloat(value) === config.defaultValue;
}

// Get current website name
async function getCurrentWebsiteName() {
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (!tab || !tab.url) return 'Unknown';
		
		const url = new URL(tab.url);
		return url.hostname;
	} catch (error) {
		console.error('Error getting website name:', error);
		return 'Unknown';
	}
}

// Update website name display
async function updateWebsiteName() {
	const websiteNameElement = document.getElementById('website-name');
	if (!websiteNameElement) return;
	
	const websiteName = await getCurrentWebsiteName();
	websiteNameElement.textContent = websiteName;
}

// Save filter values to storage
async function saveFilterValues() {
	try {
		const currentDomain = await getCurrentDomain();
		if (!currentDomain) {
			console.warn('Popup: Could not determine domain, cannot save filter values');
			return;
		}
		
		const filterValues = {};
		const domainStorageKey = getDomainStorageKey(currentDomain);
		
		// Check if chrome.storage is available
		if (!chrome || !chrome.storage || !chrome.storage.local) {
			console.warn('Chrome storage not available, using fallback storage');
			saveToFallbackStorage(domainStorageKey, filterValues);
			return;
		}
		
		getInputs().forEach(input => {
			const { name, type } = input;
			if (type === 'checkbox') {
				filterValues[name] = input.checked;
			} else if (type === 'range') {
				filterValues[name] = parseFloat(input.value);
			}
		});
		
		console.log(`Popup: Saving filter values for domain ${currentDomain}:`, filterValues);
		
		chrome.storage.local.set({ [domainStorageKey]: filterValues }, () => {
			if (chrome.runtime.lastError) {
				console.error('Error saving to chrome storage:', chrome.runtime.lastError);
				// Fallback to localStorage
				saveToFallbackStorage(domainStorageKey, filterValues);
			} else {
				console.log(`Filter values saved to chrome storage for domain ${currentDomain}`);
			}
		});
	} catch (error) {
		console.error('Error in saveFilterValues:', error);
		// Don't throw error, just log it
	}
}

// Load filter values from storage
async function loadFilterValues() {
	try {
		const currentDomain = await getCurrentDomain();
		if (!currentDomain) {
			console.warn('Popup: Could not determine domain, cannot load filter values');
			return;
		}
		
		const domainStorageKey = getDomainStorageKey(currentDomain);
		
		// Check if chrome.storage is available
		if (!chrome || !chrome.storage || !chrome.storage.local) {
			console.warn('Chrome storage not available, using fallback storage');
			const fallbackValues = loadFromFallbackStorage(domainStorageKey);
			if (fallbackValues) {
				getInputs().forEach(input => {
					const { name, type } = input;
					if (fallbackValues.hasOwnProperty(name)) {
						if (type === 'checkbox') {
							input.checked = fallbackValues[name];
						} else if (type === 'range') {
							input.value = fallbackValues[name];
							updateValueDisplay(input);
						}
					}
				});
				console.log(`Filter values loaded from fallback storage for domain ${currentDomain}`);
				
				// Apply the loaded values to the page if they're not default values
				setTimeout(() => {
					applyLoadedValues();
				}, 100);
			}
			return;
		}
		
		const result = await chrome.storage.local.get([domainStorageKey]);
		let savedValues = result[domainStorageKey] || {};
		console.log(`Popup: Loaded from chrome storage for domain ${currentDomain}:`, savedValues);
		
		// If chrome storage failed, try fallback storage
		if (!savedValues || Object.keys(savedValues).length === 0) {
			const fallbackValues = loadFromFallbackStorage(domainStorageKey);
			if (fallbackValues) {
				savedValues = fallbackValues;
				console.log(`Popup: Loaded values from fallback storage for domain ${currentDomain}:`, fallbackValues);
			}
		}
		
		getInputs().forEach(input => {
			const { name, type } = input;
			if (savedValues.hasOwnProperty(name)) {
				if (type === 'checkbox') {
					input.checked = savedValues[name];
				} else if (type === 'range') {
					input.value = savedValues[name];
					updateValueDisplay(input);
				}
			}
		});
		
		console.log(`Filter values loaded from storage for domain ${currentDomain}`);
		
		// Apply the loaded values to the page if they're not default values
		setTimeout(() => {
			applyLoadedValues();
		}, 100);
	} catch (error) {
		console.error('Error loading filter values:', error);
	}
}

// Cache DOM elements to avoid repeated queries
let cachedInputs = null;

function getInputs() {
	if (!cachedInputs) {
		cachedInputs = document.querySelectorAll('input');
	}
	return cachedInputs;
}

async function applyStyle(event = null) {
	const configParts = [];
	
	getInputs().forEach(input => {
		const { name, value, type } = input;
		
		if (type === 'range' && !isDefault(name, parseFloat(value))) {
			configParts.push(`${name}(${value}${getUnit(name)})`);
		} else if (type === 'checkbox' && !isDefault(name, input.checked)) {
			configParts.push(`${name}(${input.checked ? '1' : '0'})`);
		}
	});
	
	const filterConfig = configParts.join(' ');
	
	console.log('Applying filter:', filterConfig);
	
	if (!filterConfig.trim()) {
		// No filters to apply, reset instead
		console.log('No filters to apply, resetting instead');
		return resetStyle();
	}
	
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		
		if (!tab?.id) {
			throw new Error('No active tab found');
		}
		
		// Don't apply filters on extension pages or other restricted pages
		if (tab.url && (tab.url.startsWith('chrome-extension://') || 
						tab.url.startsWith('chrome://') || 
						tab.url.startsWith('moz-extension://') ||
						tab.url.includes('popup.html') ||
						tab.url.includes('extension://'))) {
			console.log('Skipping filter application on extension page');
			showNotification('Cannot apply filters to extension pages.', 'error');
			return;
		}
		
		console.log('Executing script on tab:', tab.id, 'URL:', tab.url);
		
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: (filterString) => {
				console.log('Applying filter in page:', filterString);
				
				// Apply filter directly to body
				document.body.style.filter = filterString;
				document.body.style.transition = 'filter 0.3s ease-out';
				console.log('Filter applied successfully');
			},
			args: [filterConfig]
		});
		
		// Update extension icon badge to show effects are active
		updateExtensionBadge(true);
		
		console.log('Script executed successfully');
		
		// Save filter values after successful application
		try {
			saveFilterValues();
			console.log('Filter values saved successfully');
		} catch (saveError) {
			console.error('Error saving filter values:', saveError);
			// Don't show error to user for save failures
		}
		
		// Show success notification for non-empty filters
		if (filterConfig.trim()) {
			showNotification('Filter applied successfully!', 'success');
		}
	} catch (error) {
		console.error('Error applying style:', error);
		console.error('Error details:', {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
		
		// Only show error for actual filter application failures
		if (error.message && error.message.includes('Cannot access')) {
			showNotification('Cannot access this page. Try refreshing and try again.');
		} else if (error.message && error.message.includes('chrome-extension://')) {
			showNotification('Cannot apply filters to extension pages.');
		} else if (error.message && error.message.includes('Cannot inject')) {
			showNotification('Cannot apply filters to this page type.');
		} else {
			showNotification('Failed to apply filter. Please refresh the page and try again.');
		}
	}
}

// Simple notification system
function showNotification(message, type = 'error') {
	// Create a temporary notification element
	const notification = document.createElement('div');
	notification.style.cssText = `
		position: fixed;
		top: 10px;
		left: 50%;
		transform: translateX(-50%);
		background: ${type === 'error' ? '#ff6b6b' : '#4ecdc4'};
		color: white;
		padding: 8px 16px;
		border-radius: 4px;
		font-size: 12px;
		z-index: 1000;
		box-shadow: 0 2px 8px rgba(0,0,0,0.2);
	`;
	notification.textContent = message;
	document.body.appendChild(notification);
	
	// Remove after 3 seconds
	setTimeout(() => {
		if (notification.parentNode) {
			notification.parentNode.removeChild(notification);
		}
	}, 3000);
}

// Update extension icon badge to show filter status
function updateExtensionBadge(isActive) {
	if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
		chrome.runtime.sendMessage({
			action: 'updateBadge',
			isActive: isActive
		}, (response) => {
			if (chrome.runtime.lastError) {
				console.log('Could not update badge:', chrome.runtime.lastError.message);
			} else {
				console.log('Badge updated successfully');
			}
		});
	}
}

async function resetStyle() {
	console.log('Starting reset process');
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		
		if (!tab?.id) {
			throw new Error('No active tab found');
		}
		
		console.log('Resetting filters on tab:', tab.id, 'URL:', tab.url);
		
		await chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: () => {
				console.log('Resetting filters in page');
				
				// Remove filters from body
				document.body.style.filter = '';
				document.body.style.transition = '';
				
				console.log('Filters reset in page successfully');
			}
		});
		
		// Update extension icon badge to show effects are inactive
		updateExtensionBadge(false);
		
		console.log('Reset script executed successfully');
		
		// Reset all inputs to their default values
		console.log('Resetting input values');
		getInputs().forEach(input => {
			const config = FILTER_CONFIG[input.name];
			if (config) {
				if (input.type === 'checkbox') {
					input.checked = false;
					console.log(`Reset checkbox ${input.name} to false`);
				} else if (input.type === 'range') {
					input.value = config.defaultValue;
					updateValueDisplay(input);
					console.log(`Reset range ${input.name} to ${config.defaultValue}`);
				}
			}
		});
		
		console.log('Input values reset successfully');
		
		// Clear saved filter values for current domain
		const currentDomain = await getCurrentDomain();
		if (currentDomain) {
			const domainStorageKey = getDomainStorageKey(currentDomain);
			
			if (chrome && chrome.storage && chrome.storage.local) {
				chrome.storage.local.remove([domainStorageKey], () => {
					if (chrome.runtime.lastError) {
						console.error('Error clearing chrome storage:', chrome.runtime.lastError);
					} else {
						console.log(`Chrome storage cleared successfully for domain ${currentDomain}`);
					}
				});
			} else {
				console.warn('Chrome storage not available, skipping clear');
			}
			
			// Also clear fallback storage
			const fallbackStorage = getFallbackStorage();
			if (fallbackStorage) {
				try {
					fallbackStorage.removeItem(domainStorageKey);
					console.log(`Fallback storage cleared successfully for domain ${currentDomain}`);
				} catch (error) {
					console.error('Error clearing fallback storage:', error);
				}
			}
		}
		
		showNotification('Filters reset successfully', 'success');
	} catch (error) {
		console.error('Error resetting style:', error);
		console.error('Reset error details:', {
			name: error.name,
			message: error.message,
			stack: error.stack
		});
		
		// Only show error for actual reset failures
		if (error.message && error.message.includes('Cannot access')) {
			showNotification('Cannot access this page to reset filters.');
		} else if (error.message && error.message.includes('chrome-extension://')) {
			showNotification('Cannot reset filters on extension pages.');
		} else {
			showNotification('Failed to reset filters. Please try again.');
		}
	}
}


// Optimized button click handler
async function handleButtonClick(event) {
	const buttonId = event.target.id;
	
	switch (buttonId) {
		case 'apply':
			await applyStyle();
			break;
		case 'reset':
			await resetStyle();
			break;
		default:
			console.warn(`Unknown button clicked: ${buttonId}`);
	}
}

// Optimized value display function using configuration
function updateValueDisplay(input) {
	const { name, value } = input;
	const valueDisplay = document.getElementById(`${name}-value`);
	
	if (!valueDisplay) return;
	
	const config = FILTER_CONFIG[name];
	if (!config) return;
	
	const numericValue = parseFloat(value);
	
	switch (name) {
			case 'blur':
			valueDisplay.textContent = `${numericValue}px`;
				break;
			case 'brightness':
			case 'contrast':
			valueDisplay.textContent = numericValue.toFixed(1);
				break;
			case 'hue-rotate':
			valueDisplay.textContent = `${numericValue}°`;
				break;
			case 'saturate':
			valueDisplay.textContent = `${numericValue}%`;
				break;
		default:
			valueDisplay.textContent = value;
	}
}

// Debounce function to optimize performance
function debounce(func, wait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Optimized debounced apply style function
const debouncedApplyStyle = debounce(applyStyle, 100);

// Initialize value displays
function initializeValueDisplays() {
	const rangeInputs = document.querySelectorAll('input[type="range"]');
	rangeInputs.forEach(input => {
		updateValueDisplay(input);
	});
}

// Optimized event handling with proper cleanup
document.addEventListener('DOMContentLoaded', async function() {
	// Update website name display
	await updateWebsiteName();
	
	// Load saved filter values
	await loadFilterValues();
	
	// Initialize value displays (after loading saved values)
	initializeValueDisplays();
	
	// Cache button and input elements
	const buttons = document.querySelectorAll('button');
	const inputs = getInputs();
	
	// Add button event listeners
	buttons.forEach(button => {
		button.addEventListener('click', handleButtonClick);
	});

	// Add input event listeners with optimized handling
	inputs.forEach(input => {
		if (input.type === 'range') {
			// Use debounced apply style for better performance
			input.addEventListener('input', function() {
			updateValueDisplay(this);
				debouncedApplyStyle();
			});
			
			// Apply immediately on change (when user stops dragging)
			input.addEventListener('change', applyStyle);
		} else if (input.type === 'checkbox') {
			// Apply immediately for checkboxes
			input.addEventListener('change', applyStyle);
		}
	});
	
	// Clear cache when DOM changes (if needed)
	const observer = new MutationObserver(() => {
		cachedInputs = null;
	});
	observer.observe(document.body, { childList: true, subtree: true });
});
