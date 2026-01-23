# Privacy Policy for RWX Ship Viewer

**Last Updated:** January 24, 2026

---

## Introduction

RWX Ship Viewer ("the Extension") is a browser extension designed to help Star Citizen players view and compare ship information. This Privacy Policy explains how the Extension handles data and protects your privacy.

**Developer:** Roger Wolff  
**Extension Name:** RWX Ship Viewer  
**Version:** 1.0.0  
**Contact:** rwxlff+sv@gmail.com

---

## TL;DR (Too Long; Didn't Read)

**RWX Ship Viewer does NOT collect, store, or transmit any personal data. Everything runs locally in your browser. Your privacy is 100% protected.**

---

## 1. Data Collection

### 1.1. No Personal Data Collection

The Extension does **NOT** collect, store, transmit, or process any personal information, including but not limited to:

- ❌ Name, email address, or contact information
- ❌ Browsing history or website visits
- ❌ IP addresses or location data
- ❌ User credentials or passwords
- ❌ Payment information
- ❌ Any personally identifiable information (PII)

### 1.2. Local Storage Only

The Extension uses your browser's local storage mechanism (`localStorage` and `chrome.storage.local`) exclusively to:

**Cache Public Data:**
- Ship data from RSI Ship Matrix API (refreshed every 24 hours)
- Ship prices from UEX Corp API
- Loaner ship matrix information

**Save Your Preferences:**
- Favorite ships list
- Filter selections (manufacturer, type, status)
- Currency preference (USD, EUR, GBP)
- Floating button position and visibility
- Sort column and direction
- Keybind configuration (keyboard shortcut)
- Executive Hangar Timer adjustments

**All this data remains on your device and is never transmitted to any external server or third party.**

---

## 2. External Data Sources

The Extension fetches publicly available data from the following sources:

### 2.1. Roberts Space Industries (RSI)

- **Ship Matrix API:** `https://robertsspaceindustries.com/ship-matrix/index`
- **Loaner Matrix:** `https://support.robertsspaceindustries.com/hc/en-us/articles/360003093114-Loaner-Ship-Matrix`
- **Purpose:** Fetch official ship specifications, production status, and loaner information

### 2.2. UEX Corp API

- **Vehicles API:** `https://api.uexcorp.uk/2.0/vehicles`
- **Prices API:** `https://api.uexcorp.uk/2.0/vehicles_prices`
- **aUEC Prices API:** `https://api.uexcorp.uk/2.0/vehicles_purchases_prices_all`
- **Purpose:** Fetch community-maintained ship prices, buy locations, and additional specifications

**Note:** These requests are made directly from your browser to the respective APIs. The Extension acts only as a data viewer and does not intercept, modify, or store any request/response beyond caching for performance.

**External Privacy Policies:**
- [RSI Privacy Policy](https://robertsspaceindustries.com/privacy)
- [UEX Corp Website](https://uexcorp.space/)

---

## 3. Permissions Explained

The Extension requests the following Chrome permissions:

### 3.1. `activeTab`

**Why:** To inject the ship viewer interface on the current browser tab when you click the floating button or use the keyboard shortcut.

**What it does NOT do:** Does not track your browsing activity or monitor which websites you visit.

### 3.2. `storage`

**Why:** To save your preferences (favorites, filters, button position, keybind) locally on your device so they persist across browser sessions.

**What it does NOT do:** Does not sync or upload any data to cloud servers.

### 3.3. `webRequest`

**Why:** To allow the Extension to fetch ship data from RSI and UEX Corp APIs without being blocked by CORS (Cross-Origin Resource Sharing) restrictions.

**What it does NOT do:** Does not monitor, intercept, or modify your general web traffic. Only used for specific API calls to RSI and UEX Corp.

### 3.4. `scripting`

**Why:** To execute the ship viewer scripts on web pages.

**What it does NOT do:** Does not execute malicious code or track user behavior.

### 3.5. Host Permissions

The Extension requests access to:
- `https://robertsspaceindustries.com/*`
- `https://support.robertsspaceindustries.com/*`
- `https://api.uexcorp.uk/*`

**Why:** To fetch ship data from these specific domains only.

---

## 4. Data Security

Since the Extension does not collect or transmit personal data, there is minimal security risk. However, we implement the following practices:

- ✅ **Local-only storage:** All user preferences are stored locally using browser storage APIs
- ✅ **No authentication:** The Extension does not require login, registration, or any form of user authentication
- ✅ **HTTPS only:** All external API requests are made over secure HTTPS connections
- ✅ **No tracking scripts:** The Extension does not include any analytics, tracking pixels, or third-party monitoring tools
- ✅ **No remote code execution:** The Extension does not download or execute code from remote servers

---

## 5. Third-Party Services

The Extension does **NOT** integrate with any third-party analytics, advertising, or tracking services.

**No data is shared with:**
- ❌ Google Analytics
- ❌ Facebook Pixel
- ❌ Advertising networks
- ❌ Data brokers or aggregators
- ❌ Any other third-party services

---

## 6. Children's Privacy

The Extension is not directed at children under the age of 13. We do not knowingly collect information from children. If you believe a child has provided information through the Extension, please contact us immediately at [your-email@example.com].

---

## 7. Your Rights and Choices

### 7.1. Data Access

Since the Extension does not collect personal data, there is no data to request, access, modify, or delete from our servers (because we don't have any servers storing your data).

### 7.2. Control Your Data

You can:

- **Clear local data:** Clear your browser's cache and local storage at any time to remove all Extension data from your device
- **Reset preferences:** Use the Extension's settings to reset filters, favorites, and other preferences
- **Uninstall:** Remove the Extension completely from your browser through Chrome's extension management page (`chrome://extensions/`)

### 7.3. Opt-Out

You can disable specific features:
- Toggle floating button on/off
- Change or disable keyboard shortcut
- Clear favorites list
- Clear cached data

---

## 8. Changes to This Privacy Policy

We may update this Privacy Policy from time to time to reflect changes in the Extension or legal requirements. Any updates will be posted on this page with a revised "Last Updated" date.

**How you'll be notified:**
- Changes will be announced via the Extension's update notes in the Chrome Web Store
- The updated policy will be available on our GitHub repository

**Your continued use of the Extension after any changes constitutes acceptance of the updated Privacy Policy.**

---

## 9. Open Source

RWX Ship Viewer is open source. You can review the complete source code to verify our privacy practices at:

**GitHub Repository:** [https://github.com/rwxlff/RWX-Ship-Viewer](https://github.com/rwxlff/RWX-Ship-Viewer)

We encourage security researchers and developers to review our code and report any concerns.

---

## 10. Compliance

This Extension complies with:

- ✅ **GDPR** (General Data Protection Regulation) - European Union
- ✅ **CCPA** (California Consumer Privacy Act) - United States
- ✅ **Chrome Web Store Developer Program Policies**
- ✅ **Browser Extension Privacy Best Practices**

---

## 11. Data Retention

### 11.1. Cached Data

- **Ship Matrix Data:** Cached for 24 hours, then automatically refreshed
- **Price Data:** Cached for 2 minutes (USD prices) or 24 hours (aUEC prices)
- **Loaner Matrix:** Cached for 24 hours

### 11.2. User Preferences

- **Stored indefinitely** until you clear browser data or uninstall the Extension
- **Can be reset** at any time through the Extension settings

---

## 12. Cookies

The Extension does **NOT** use cookies. All data is stored using browser's local storage APIs (`localStorage` and `chrome.storage.local`).

---

## 13. Analytics and Tracking

The Extension does **NOT** use any analytics, tracking, or telemetry services. We do not collect usage statistics, crash reports, or any other data about how you use the Extension.

---

## 14. Contact Information

If you have any questions, concerns, or requests regarding this Privacy Policy or the Extension's data practices, please contact:

**Developer:** Roger Wolff  
**Email:** [your-email@example.com]  
**GitHub:** [https://github.com/rwxlff](https://github.com/rwxlff)  
**Project Page:** [https://github.com/rwxlff/RWX-Ship-Viewer](https://github.com/rwxlff/RWX-Ship-Viewer)

---

## 15. Disclaimer

**RWX Ship Viewer is a fan-made tool and is not affiliated with, endorsed by, or connected to Cloud Imperium Games Corporation or Roberts Space Industries.**

Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC.

All ship data and images are the property of their respective owners.

---

## 16. Effective Date

This Privacy Policy is effective as of **January 24, 2026** and applies to all versions of RWX Ship Viewer from v1.0.0 onwards.

---

## 17. Legal Basis for Processing (GDPR)

Under GDPR, the legal basis for processing data is:

- **Legitimate Interest:** Providing the Extension's functionality (viewing ship data)
- **User Consent:** By installing and using the Extension, you consent to this Privacy Policy

Since no personal data is collected, GDPR rights related to data access, rectification, erasure, and portability are not applicable.

---

## 18. International Data Transfers

The Extension does not transfer any personal data internationally because it does not collect personal data.

API requests to RSI (US-based) and UEX Corp are made directly from your browser and are subject to their respective privacy policies.

---

## Summary

✅ **No personal data collection**  
✅ **No tracking or analytics**  
✅ **All data stored locally**  
✅ **Open source and transparent**  
✅ **GDPR and CCPA compliant**  
✅ **No third-party sharing**

**Your privacy is our priority. Enjoy using RWX Ship Viewer!**

---

*Last reviewed and updated: January 24, 2026*