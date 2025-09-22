// Content script for Page Filter Effects
// This script runs on every page load and applies saved filters

(function() {
	'use strict';
	
	// Configuration object (same as popup.js)
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

	// Storage key (must match popup.js)
	const STORAGE_KEY = 'pageFilterValues';

	// Check if we're on a restricted page
	function isRestrictedPage() {
		const url = window.location.href;
		return url.startsWith('chrome-extension://') || 
			   url.startsWith('chrome://') || 
			   url.startsWith('moz-extension://') ||
			   url.startsWith('about:') ||
			   url.startsWith('data:') ||
			   url.startsWith('file:') ||
			   url.includes('popup.html') ||
			   url.includes('extension://');
	}

	// Get unit for filter
	function getUnit(name) {
		return FILTER_CONFIG[name]?.unit || '';
	}

	// Check if value is default
	function isDefault(name, value) {
		const config = FILTER_CONFIG[name];
		if (!config) return false;
		
		if (typeof value === 'boolean') {
			return value === false;
		}
		
		return parseFloat(value) === config.defaultValue;
	}

	// Apply filters directly to body without DOM manipulation
	function applyFiltersToBody(filterString) {
		// Apply filter directly to body
		document.body.style.filter = filterString;
		document.body.style.transition = 'filter 0.3s ease-out';
		console.log('Page Filter Effects: Applied filter to body:', filterString);
		
		// Update extension icon badge to show effects are active
		updateExtensionBadge(true);
	}

	// Remove filters from body
	function removeFiltersFromBody() {
		document.body.style.filter = '';
		document.body.style.transition = '';
		console.log('Page Filter Effects: Removed filters from body');
		
		// Update extension icon badge to show effects are inactive
		updateExtensionBadge(false);
	}

	// Update extension icon badge to show filter status
	function updateExtensionBadge(isActive) {
		if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
			chrome.runtime.sendMessage({
				action: 'updateBadge',
				isActive: isActive
			}, (response) => {
				if (chrome.runtime.lastError) {
					console.log('Page Filter Effects: Could not update badge:', chrome.runtime.lastError.message);
				} else {
					console.log('Page Filter Effects: Badge updated successfully');
				}
			});
		}
	}

	// Apply filters to the page
	function applyFilters(filterValues) {
		const configParts = [];
		let hasNonDefaultValues = false;

		Object.entries(filterValues).forEach(([name, value]) => {
			if (!isDefault(name, value)) {
				if (typeof value === 'boolean') {
					configParts.push(`${name}(${value ? '1' : '0'})`);
				} else {
					configParts.push(`${name}(${value}${getUnit(name)})`);
				}
				hasNonDefaultValues = true;
			}
		});

		if (!hasNonDefaultValues) {
			return false;
		}

		const filterConfig = configParts.join(' ');
		
		// Apply filters directly to body
		applyFiltersToBody(filterConfig);
		
		console.log('Page Filter Effects: Applied filters:', filterConfig);
		return true;
	}

	// Create floating notification window
	function createNotificationBanner() {
		// Remove existing notification if any
		const existingNotification = document.getElementById('page-filter-effects-notification');
		if (existingNotification) {
			existingNotification.remove();
		}

		const notification = document.createElement('div');
		notification.id = 'page-filter-effects-notification';
		notification.style.cssText = 'filter: none !important; -webkit-filter: none !important;';
		notification.innerHTML = `
			<div style="
				position: fixed;
				bottom: 20px;
				left: 20px;
				background: rgba(255, 255, 255, 0.85);
				backdrop-filter: blur(15px);
				border: 1px solid rgba(102, 126, 234, 0.15);
				border-radius: 8px;
				padding: 8px 12px;
				z-index: 2147483647;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
				font-size: 12px;
				max-width: 200px;
				transform: translateY(100px);
				opacity: 0;
				transition: all 0.3s ease;
				/* Ensure notification is never affected by filters */
				filter: none !important;
				-webkit-filter: none !important;
			">
				<div style="display: flex; align-items: center; gap: 8px; filter: none !important;">
					<img src="${chrome.runtime.getURL('icon128.png')}" style="
						width: 20px;
						height: 20px;
						border-radius: 4px;
						flex-shrink: 0;
						filter: none !important;
					" alt="Page Filter Effects">
					<div style="flex: 1; filter: none !important;">
						<div style="font-weight: 500; color: #333; font-size: 11px; filter: none !important;">
							Filters Active
						</div>
					</div>
					<button id="page-filter-effects-reset" style="
						background: rgba(255, 107, 107, 0.8);
						border: none;
						color: white;
						padding: 4px 8px;
						border-radius: 4px;
						cursor: pointer;
						font-size: 10px;
						font-weight: 500;
						transition: all 0.2s ease;
						filter: none !important;
					">
						Reset
					</button>
					<button id="page-filter-effects-close" style="
						background: transparent;
						border: none;
						color: #999;
						cursor: pointer;
						font-size: 14px;
						padding: 2px;
						opacity: 0.7;
						transition: opacity 0.2s ease;
						width: 16px;
						height: 16px;
						display: flex;
						align-items: center;
						justify-content: center;
						filter: none !important;
					">
						×
					</button>
				</div>
			</div>
		`;

		// Add hover effects
		const resetBtn = notification.querySelector('#page-filter-effects-reset');
		const closeBtn = notification.querySelector('#page-filter-effects-close');

		resetBtn.addEventListener('mouseenter', () => {
			resetBtn.style.background = 'rgba(255, 107, 107, 0.9)';
			resetBtn.style.transform = 'scale(1.05)';
		});
		resetBtn.addEventListener('mouseleave', () => {
			resetBtn.style.background = 'rgba(255, 107, 107, 0.8)';
			resetBtn.style.transform = 'scale(1)';
		});

		closeBtn.addEventListener('mouseenter', () => {
			closeBtn.style.opacity = '1';
			closeBtn.style.color = '#666';
		});
		closeBtn.addEventListener('mouseleave', () => {
			closeBtn.style.opacity = '0.7';
			closeBtn.style.color = '#999';
		});

		// Add event listeners
		resetBtn.addEventListener('click', resetFilters);
		closeBtn.addEventListener('click', () => {
			notification.remove();
		});

		document.body.appendChild(notification);

		// Animate in
		setTimeout(() => {
			const innerDiv = notification.querySelector('div');
			innerDiv.style.transform = 'translateY(0)';
			innerDiv.style.opacity = '1';
		}, 10);

		// Auto-hide after 5 seconds
		setTimeout(() => {
			if (notification.parentNode) {
				const innerDiv = notification.querySelector('div');
				innerDiv.style.transform = 'translateY(20px)';
				innerDiv.style.opacity = '0';
				setTimeout(() => {
					if (notification.parentNode) {
						notification.remove();
					}
				}, 300);
			}
		}, 5000);
	}

	// Reset filters
	function resetFilters() {
		// Remove filters from body
		removeFiltersFromBody();
		
		// Remove notification
		const notification = document.getElementById('page-filter-effects-notification');
		if (notification) {
			const innerDiv = notification.querySelector('div');
			innerDiv.style.transform = 'translateY(20px)';
			innerDiv.style.opacity = '0';
			setTimeout(() => {
				if (notification.parentNode) {
					notification.remove();
				}
			}, 300);
		}

		// Clear storage
		if (chrome && chrome.storage && chrome.storage.local) {
			chrome.storage.local.remove([STORAGE_KEY]);
		}

		console.log('Page Filter Effects: Filters reset');
	}

	// Load and apply saved filters
	async function loadAndApplyFilters() {
		if (isRestrictedPage()) {
			return;
		}

		try {
			let filterValues = null;

			// Try chrome storage first
			if (chrome && chrome.storage && chrome.storage.local) {
				const result = await chrome.storage.local.get([STORAGE_KEY]);
				filterValues = result[STORAGE_KEY];
				console.log('Page Filter Effects: Loaded from chrome storage:', filterValues);
			}

			// Fallback to localStorage
			if (!filterValues) {
				try {
					const stored = localStorage.getItem(STORAGE_KEY);
					filterValues = stored ? JSON.parse(stored) : null;
					console.log('Page Filter Effects: Loaded from localStorage:', filterValues);
				} catch (error) {
					console.error('Page Filter Effects: Error reading from localStorage:', error);
				}
			}

			if (filterValues && Object.keys(filterValues).length > 0) {
				console.log('Page Filter Effects: Applying filters:', filterValues);
				const applied = applyFilters(filterValues);
				if (applied) {
					// Show notification banner
					createNotificationBanner();
				}
			} else {
				console.log('Page Filter Effects: No saved filter values found');
			}
		} catch (error) {
			console.error('Page Filter Effects: Error loading filters:', error);
		}
	}

	// Wait for DOM to be ready
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', loadAndApplyFilters);
	} else {
		loadAndApplyFilters();
	}

	// Listen for storage changes to update filters in real-time
	if (chrome && chrome.storage && chrome.storage.onChanged) {
		chrome.storage.onChanged.addListener((changes, namespace) => {
			if (namespace === 'local' && changes[STORAGE_KEY]) {
				const newValues = changes[STORAGE_KEY].newValue;
				if (newValues) {
					const applied = applyFilters(newValues);
					if (applied) {
						createNotificationBanner();
					} else {
						// No filters to apply, remove notification
						const notification = document.getElementById('page-filter-effects-notification');
						if (notification) {
							notification.remove();
						}
					}
				} else {
					// Storage cleared, reset filters
					resetFilters();
				}
			}
		});
	}

})();
