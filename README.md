# Credit Card Rewards Tracker - Full Featured

A comprehensive web application for tracking credit card benefits, managing multiple profiles, and optimizing your wallet strategy.

## 🎯 Features

### Core Functionality
- **Profile Management** - Create profiles for multiple people (e.g., Andrew, Becca)
- **Card Assignment** - Assign cards to profiles (same card can be used by multiple people)
- **Benefit Tracking** - Track monthly, quarterly, semi-annual, and annual benefits
- **Current Period Filtering** - Only shows benefits available in the current period
- **Live Updates** - Clicking benefits updates all stats and charts in real-time

### Advanced Features
- **Wallet Optimizer** - Analyzes spending patterns and recommends optimal card combinations
- **Best Card Analysis** - Shows which card to use for each spending category
- **Portfolio Recommendations** - Suggests 3-card, 5-card, and 7-card optimal wallets
- **Card Database Management** - Add new cards and edit benefits directly in the app
- **Persistent Storage** - All data saved automatically using browser storage

### Design
- **Glassmorphic UI** - Beautiful frosted glass aesthetic with high contrast
- **Responsive Layout** - Works on desktop, tablet, and mobile
- **Real-time Charts** - SVG donut charts showing fee recovery progress
- **Smooth Animations** - Polished interactions throughout

## 🚀 Quick Start

### Option 1: Simple (No Installation)
1. Download `credit-card-tracker.html`
2. Open it in any modern web browser (Chrome, Firefox, Safari, Edge)
3. Start using immediately - no server or compilation needed!

### Option 2: Local Development
```bash
# Clone the repository
git clone https://github.com/yourusername/credit-card-tracker.git
cd credit-card-tracker

# Open in browser
open credit-card-tracker.html
# OR on Windows: start credit-card-tracker.html
# OR on Linux: xdg-open credit-card-tracker.html
```

## 📖 Usage Guide

### Getting Started
1. **Create a Profile**
   - Click "Manage Profiles"
   - Enter a name (e.g., "Andrew")
   - Click "Add Profile"

2. **Add a Card**
   - Click "+ Add Card"
   - Select your profile
   - Choose a card from the database
   - Card appears in your dashboard

3. **Track Benefits**
   - Click on a card to expand benefits
   - Click any benefit tile to mark as used
   - Watch the recovery percentage update in real-time

### Managing the Database
1. **Add New Card**
   - Navigate to "Manage Database" section
   - Enter card details (name, issuer, annual fee)
   - Add benefits with frequency and values
   - Add multipliers for optimization

2. **Edit Benefits**
   - Select a card from the database
   - Click "Edit Benefits"
   - Add, modify, or remove benefits
   - Changes save automatically

### Optimizing Your Wallet
1. Go to "Optimize" tab
2. Enter your annual spending by category
3. View best card recommendations
4. See suggested wallet combinations

## 🗂️ Data Structure

### Profiles
```javascript
{
  id: "prof-123",
  name: "Andrew"
}
```

### Cards
```javascript
{
  id: "card-456",
  profileId: "prof-123",
  cardName: "Amex Platinum",
  issuer: "American Express",
  annualFee: 695,
  periodicBenefits: [...],
  multipliers: {...}
}
```

### Benefits
```javascript
{
  name: "Uber Cash",
  type: "Dining",
  frequency: "Monthly",
  value: 15,
  period: "M2"  // M1-M12, Q1-Q4, H1-H2, or omit for Annual
}
```

## 💾 Data Storage

All data is stored locally in your browser using the `window.storage` API:
- Profiles
- Cards (your active cards)
- Card Database (available cards)
- Used Benefits (tracking)
- Annual Spending (for optimization)

**Note:** Data persists between sessions but is browser-specific. Export your data if switching browsers.

## 🎨 Customization

The app uses CSS variables for easy theme customization. Edit these in the `<style>` section:

```css
:root {
  --primary: #4f46e5;
  --secondary: #7c3aed;
  --accent: #ec4899;
  --success: #10b981;
}
```

## 🔧 Technical Details

**Built With:**
- React 18 (via CDN)
- Babel (for JSX compilation)
- Pure CSS (no frameworks)
- Browser Storage API

**Browser Requirements:**
- Modern browser with ES6+ support
- Storage API support
- SVG support

**No Build Process Required:**
This is a single-file application that runs entirely in the browser. No Node.js, npm, webpack, or any build tools needed!

## 📊 Included Cards

The app comes pre-loaded with 24 popular credit cards:
- Amex Platinum, Business Platinum, Gold, Business Gold
- Chase Sapphire Reserve, Freedom Unlimited, Freedom
- Ink Business Preferred, Cash, Unlimited
- Hilton Honors Aspire, Surpass
- Marriott Bonvoy Brilliant, Bold
- World of Hyatt
- Capital One Venture X
- Citi Strata Premier
- And more...

## 🤝 Contributing

Contributions welcome! To add new cards:
1. Fork the repository
2. Add card data to `INITIAL_CARD_DATABASE`
3. Submit a pull request

## 📝 License

MIT License - feel free to use and modify!

## 🐛 Troubleshooting

**Q: My benefits aren't showing**
A: Make sure they're set for the current period (month/quarter/half/year)

**Q: Cards disappeared**
A: Check browser storage settings - ensure cookies/storage isn't being cleared

**Q: Optimizer shows "None"**
A: Add multipliers to your cards in the database editor

**Q: Can I export my data?**
A: Currently data is browser-local. Export feature coming soon!

## 📮 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: your-email@example.com

## 🎯 Roadmap

- [ ] Data export/import
- [ ] PDF report generation
- [ ] Historical tracking charts
- [ ] Mobile app version
- [ ] Multi-currency support

---

**Made with ❤️ for credit card enthusiasts**
