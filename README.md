# 🚀 RWX Ship Viewer

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Chrome Web Store](https://img.shields.io/badge/chrome-web%20store-orange.svg)

> Your ultimate companion for exploring the complete Star Citizen ship database with detailed specifications, prices, media galleries, and buy locations.

---

## 📖 Overview

**RWX Ship Viewer** is a powerful Chrome extension that provides instant access to comprehensive information about all Star Citizen ships. Whether you're a new player researching your first ship or a veteran managing your fleet, this extension gives you everything you need in one convenient interface.

### ✨ Key Features

- 🛸 **245+ Ships Database** - Complete Star Citizen ship catalog with real-time updates
- 💰 **Multi-Currency Pricing** - USD, EUR, GBP with automatic conversion + aUEC in-game prices
- 🖼️ **Rich Media Galleries** - High-resolution photos and official promotional videos
- 📊 **Technical Specifications** - Detailed stats, dimensions, speed, cargo, crew, and performance data
- 🔧 **Component Lists** - Complete breakdown of Avionics, Propulsion, and Weapons systems
- 🏪 **Buy Locations** - In-game purchase terminals with aUEC prices
- 🎁 **Loaner Ships Matrix** - See which ships you'll get as loaners
- ⭐ **Favorites System** - Save and quickly access your preferred ships
- 🔍 **Smart Filtering** - Search by name, manufacturer, type, status, and more
- ⏱️ **Executive Hangar Timer** - Track hangar availability with customizable adjustments
- ⚡ **Keyboard Shortcut** - Quick access with `Ctrl+Shift+S`
- 🎨 **Floating Button** - Customizable position and visibility

---

## 🖥️ Screenshots

| Main View | Ship Details | Media Gallery |
|-----------|--------------|---------------|
| <img width="128" height="80" alt="img1" src="https://github.com/user-attachments/assets/631f0ce7-9828-48a0-8fdc-ab1b670ceb65" />
 | <img width="128" height="80" alt="img2" src="https://github.com/user-attachments/assets/20894146-cdf8-4cf7-9288-ed103a0a72a2" />
 | <img width="128" height="80" alt="img3" src="https://github.com/user-attachments/assets/5cf0c954-fcd0-47d1-851f-6688da102560" />
 |

| Price Comparison | Buy Locations | Hangar Timer |
|------------------|---------------|--------------|
| ![Screenshot 4](screenshots/price-comparison.png) | ![Screenshot 5](screenshots/buy-locations.png) | ![Screenshot 6](screenshots/hangar-timer.png) |

---

## 📥 Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](#) *(link will be available after publication)*
2. Click **"Add to Chrome"**
3. Confirm permissions
4. Done! The floating button will appear on any webpage

### Manual Installation (Development)

1. Download or clone this repository:
   ```bash
   git clone https://github.com/rwxlff/RWX-Ship-Viewer.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable **"Developer mode"** (toggle in top-right corner)

4. Click **"Load unpacked"**

5. Select the project folder

6. The extension is now installed!

---

## 🎮 Usage

### Opening the Ship Viewer

**Method 1: Floating Button**
- Look for the floating ship icon on any webpage
- Click it to open the viewer

**Method 2: Keyboard Shortcut**
- Press `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (Mac)

**Method 3: Extension Popup**
- Click the extension icon in Chrome toolbar
- Click "Open Ship Viewer"

### Navigation

1. **Browse Ships**: Scroll through the complete list of 245+ ships
2. **Search**: Use the search bar to find ships by name, manufacturer, or type
3. **Filter**: Apply filters for manufacturer, type, status, and currency
4. **Sort**: Click any column header to sort (name, price, cargo, crew, etc.)
5. **Expand Details**: Click any ship row to see complete specifications
6. **View Media**: Click on expanded ships to browse photos and videos
7. **Save Favorites**: Click the ⭐ icon to save ships to your favorites
8. **Buy Locations**: View in-game terminals where ships can be purchased with aUEC

### Executive Hangar Timer

Track the Executive Hangar availability cycle:

- **Red Phase (120 min)**: Hangar closed
- **Green Phase (60 min)**: Hangar open
- **Black Phase (5 min)**: Resetting

**Controls:**
- `-5 min` / `+5 min`: Adjust timer to sync with game
- `Reset`: Return to default cycle

---

## 🔧 Features in Detail

### Ship Information

Each ship includes:

- **Basic Info**: Name, manufacturer, type, focus, production status
- **Dimensions**: Length, beam, height, mass
- **Capacity**: Cargo (SCU), min/max crew
- **Performance**: SCM speed, max speed, afterburner speed
- **Acceleration**: X/Y/Z-axis, main, retro
- **Maneuverability**: Pitch, yaw, roll maximums
- **Durability**: Hull HP, shield HP
- **Fuel**: Quantum fuel tanks, hydrogen fuel tanks
- **Hangar**: Pad type and container sizes

### Components

Detailed breakdown of:

- **Avionics**: Radar, computers, power plants, coolers, shield generators
- **Propulsion**: Fuel intakes, fuel tanks, quantum drives, jump modules, thrusters
- **Weapons**: Weapons, turrets, missiles

### Pricing

- **USD/EUR/GBP**: Real money prices with live conversion
- **MSRP vs Warbond**: Compare standard and warbond prices
- **Savings Calculator**: Automatic calculation of warbond discounts
- **aUEC Prices**: In-game currency prices
- **Buy Locations**: Complete list of terminals selling each ship

### Media Gallery

- **Photos**: Multiple high-resolution images with thumbnail navigation
- **Videos**: Embedded YouTube promotional videos
- **Links**: Direct access to RSI Store, Brochure, and Hotsite

---

## 🔒 Privacy & Security

**RWX Ship Viewer does NOT collect, store, or transmit any personal data.**

- ✅ All data stored locally in your browser
- ✅ No tracking, analytics, or telemetry
- ✅ No account required
- ✅ No personal information collected
- ✅ Open source and transparent

**Data Sources:**
- Roberts Space Industries (RSI) Ship Matrix API
- UEX Corp API for prices and specifications
- RSI Support for Loaner Matrix

For complete details, see our [Privacy Policy](https://github.com/rwxlff/RWX-Ship-Viewer/blob/main/PRIVACY.md).

---

## 🛠️ Technical Details

### Built With

- **Vanilla JavaScript** - No frameworks, pure performance
- **Chrome Extension Manifest V3** - Latest extension architecture
- **Local Storage API** - Client-side caching (24h)
- **Fetch API** - Modern HTTP requests
- **CSS3** - Custom styling with RSI-inspired design

### Permissions Explained

- `activeTab`: Inject viewer interface on current page
- `storage`: Save user preferences locally
- `webRequest`: Access RSI and UEX Corp APIs
- `scripting`: Execute viewer scripts
- Host permissions: Only RSI and UEX Corp domains

### Performance

- **24-hour cache**: Ship data cached locally for fast loading
- **2-minute price cache**: Recent prices cached briefly
- **Lazy loading**: Images and data loaded on demand
- **Minimal footprint**: ~2MB memory usage
- **Fast startup**: < 1 second load time

---

## 🗂️ Project Structure

```
RWX-Ship-Viewer/
├── manifest.json           # Extension configuration
├── background.js           # Service worker for CORS bypass
├── content.js              # Script injection handler
├── popup.html              # Extension popup interface
├── popup.js                # Popup logic and timer
├── timer.js                # Executive Hangar Timer
├── ship-viewer.js          # Main viewer application
├── uex-api.js              # UEX Corp API integration
├── icons/                  # Extension icons
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
├── README.md               # This file
├── LICENSE                 # MIT License
└── PRIVACY.md              # Privacy Policy
```

---

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/rwxlff/RWX-Ship-Viewer/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser version and OS
   - Screenshots if applicable

### Suggesting Features

1. Open an issue with the `enhancement` label
2. Describe the feature and its benefits
3. Provide examples or mockups if possible

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Setup

```bash
# Clone repository
git clone https://github.com/rwxlff/RWX-Ship-Viewer.git
cd RWX-Ship-Viewer

# Load extension in Chrome
# 1. Go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project folder

# Make changes and reload extension to test
```

---

## 📝 Changelog

### Version 1.0.0 (January 2026)

**Initial Release**

- ✨ Complete ship database with 245+ ships
- ✨ Multi-currency pricing (USD, EUR, GBP, aUEC)
- ✨ Rich media galleries (photos + videos)
- ✨ Technical specifications and components
- ✨ Buy locations with aUEC prices
- ✨ Loaner ships matrix
- ✨ Smart search and filtering
- ✨ Favorites system
- ✨ Executive Hangar Timer
- ✨ Customizable floating button
- ✨ Keyboard shortcut (Ctrl+Shift+S)
- ✨ 24-hour local caching

---

## 🐛 Known Issues

- Some ship photos may be unavailable from UEX API
- Loaner matrix updates may lag behind official changes
- Price data depends on availability from external APIs

*Report issues on [GitHub Issues](https://github.com/rwxlff/RWX-Ship-Viewer/issues)*

---

## 📋 Roadmap

### Planned Features

- [ ] Ship comparison mode (side-by-side)
- [ ] Export ship data to CSV/JSON
- [ ] Dark/Light theme toggle
- [ ] Advanced filtering (price range, cargo range, etc.)
- [ ] Ship history tracking (price changes over time)
- [ ] Fleet management tools
- [ ] Statistics and charts
- [ ] Multi-language support
- [ ] Sync favorites across devices

*Suggest features on [GitHub Discussions](https://github.com/rwxlff/RWX-Ship-Viewer/discussions)*

---

## 📜 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

### Third-Party Data

- Ship data: © Cloud Imperium Games / Roberts Space Industries
- UEX Corp data: Courtesy of [UEX Corp](https://uexcorp.space/)

**Disclaimer:** This extension is a fan-made tool and is not affiliated with, endorsed by, or connected to Cloud Imperium Games Corporation or Roberts Space Industries. Star Citizen®, Squadron 42®, Roberts Space Industries®, and Cloud Imperium® are registered trademarks of Cloud Imperium Rights LLC.

---

## 🙏 Acknowledgments

- **Cloud Imperium Games** - For creating Star Citizen
- **UEX Corp** - For maintaining comprehensive ship data
- **Star Citizen Community** - For feedback and support
- **Contributors** - Everyone who helps improve this project

---

## 💬 Support

### Get Help

- 📖 [Documentation](https://github.com/rwxlff/RWX-Ship-Viewer/wiki) *(coming soon)*
- 💬 [Discussions](https://github.com/rwxlff/RWX-Ship-Viewer/discussions)
- 🐛 [Issue Tracker](https://github.com/rwxlff/RWX-Ship-Viewer/issues)

### Contact

- **Developer:** Roger Wolff
- **GitHub:** [@rwxlff](https://github.com/rwxlff)
- **Email:** [your-email@example.com]

---

## ⭐ Star History

<a href="https://www.star-history.com/#rwxlff/RWX-Ship-Viewer&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=rwxlff/RWX-Ship-Viewer&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=rwxlff/RWX-Ship-Viewer&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=rwxlff/RWX-Ship-Viewer&type=date&legend=top-left" />
 </picture>
</a>

---

<div align="center">

**Made with ❤️ for the Star Citizen community**

[⬆ Back to Top](#-rwx-ship-viewer)

</div>
