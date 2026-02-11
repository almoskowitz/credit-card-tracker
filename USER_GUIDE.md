# User Guide - Credit Card Rewards Tracker

## Table of Contents
1. [Getting Started](#getting-started)
2. [Managing Profiles](#managing-profiles)
3. [Adding Cards](#adding-cards)
4. [Tracking Benefits](#tracking-benefits)
5. [Removing Cards](#removing-cards)
6. [Managing the Database](#managing-the-database)
7. [Optimizing Your Wallet](#optimizing-your-wallet)
8. [Backup & Restore](#backup--restore)

---

## Getting Started

### First Time Setup
1. Open `credit-card-tracker-full.html` in your browser
2. You'll see an empty dashboard
3. First, create a profile (see below)
4. Then add cards to that profile
5. Start tracking!

---

## Managing Profiles

Profiles allow multiple people to track their own cards independently.

### Create a Profile
1. Click **"Manage Profiles"** button
2. Enter a name (e.g., "Andrew", "Becca")
3. Click **"Add"**
4. Click **"Close"**

### Delete a Profile
1. Click **"Manage Profiles"**
2. Find the profile you want to delete
3. Click **"Delete"** next to that profile
4. ⚠️ This will also remove all cards assigned to that profile

### Best Practices
- Use real names for easy identification
- Create one profile per person
- Same cards can be added to multiple profiles

---

## Adding Cards

### Add a Card to Your Wallet
1. Click **"+ Add Card"** button
2. **Select your profile** from the dropdown
3. **Choose a card** from the list
4. The card appears on your dashboard!

### What You'll See
- Card name with profile badge
- Issuer name
- Annual fee
- Recovery donut chart
- Available benefits count
- Used benefits value

---

## Tracking Benefits

### View Benefits
1. **Click on any card header** to expand it
2. You'll see all **current period benefits** in a grid
3. Each benefit shows:
   - Name
   - Frequency (Monthly/Quarterly/Semi-Annual/Annual)
   - Type (Dining/Travel/Shop)
   - Value

### Mark Benefit as Used
1. Expand a card
2. **Click on any benefit tile**
3. It turns green with a checkmark ✓
4. **All stats update immediately:**
   - Donut chart percentage increases
   - "Used" value goes up
   - "Available" count goes down
   - Total recovery rate updates

### Unmark a Benefit
- Click the green tile again to unmark it
- Stats update in reverse

### Current Period Only
The app automatically shows only relevant benefits:
- **February** → Shows M2, Q1, H1, and Annual benefits
- **April** → Shows M4, Q2, H1, and Annual benefits
- Benefits reset at period boundaries automatically

---

## Removing Cards

**NEW FEATURE!** You can now remove cards from profiles.

### Remove a Card from a Profile
1. Find the card you want to remove
2. Click the **"Remove"** button on the card header
3. Confirm in the dialog
4. Card is removed from your wallet

### Important Notes
- Removes the card from **this profile only**
- Does **not** delete the card from the database
- Does **not** affect other profiles using the same card
- Historical benefit data is cleared
- You can re-add the card anytime

### Use Cases
- Added card to wrong profile by mistake
- No longer using a particular card
- Simplified your wallet
- Testing different card combinations

---

## Managing the Database

The Database tab lets you manage available cards.

### Add a New Card to Database
1. Go to **"Database"** tab
2. Click **"+ Add New Card"**
3. Enter:
   - Card name
   - Issuer
   - Annual fee
4. Click **"Add"**
5. Card is now available to add to profiles

### Edit Card Benefits
1. Go to **"Database"** tab
2. Find your card
3. Click **"Edit Benefits"**
4. **Remove benefits:**
   - Click "Remove" next to any benefit
5. **Add new benefit:**
   - Enter name
   - Select type (Dining/Travel/Shop)
   - Select frequency
   - Enter value
   - Enter period (M2, Q1, H1, or leave blank for Annual)
   - Click "Add Benefit"

### Benefit Periods Explained
- **Monthly:** M1 (Jan), M2 (Feb), ..., M12 (Dec)
- **Quarterly:** Q1, Q2, Q3, Q4
- **Semi-Annual:** H1 (Jan-Jun), H2 (Jul-Dec)
- **Annual:** Leave period blank

---

## Optimizing Your Wallet

Find the best cards for your spending patterns.

### Enter Your Spending
1. Go to **"Optimize"** tab
2. For each category, enter your **annual** spending
3. See instant recommendations:
   - Best card for that category
   - Points multiplier
   - Total points earned

### View Wallet Recommendations
Scroll down to see:
- **3-Card Daily Carry** - Minimal wallet
- **5-Card Travel Setup** - Balanced approach
- **7-Card Maximum** - Full optimization

### Categories
- Dining
- Supermarkets
- Gas Stations
- Travel
- Hotels
- Flights
- Office Supply
- Internet/Cable/Phone
- Shipping
- Drugstores
- Rideshare
- Streaming
- Everything Else

---

## Backup & Restore

### Export Your Data
1. Click **"Export Data"** button on Dashboard
2. Downloads: `credit-card-tracker-backup-YYYY-MM-DD.json`
3. Save this file somewhere safe

**What's Included:**
- All profiles
- All cards in wallets
- Card database
- Used benefits tracking
- Annual spending data

### Import Data
1. Click **"Import Data"** button
2. Select your backup JSON file
3. ⚠️ **Warning:** This replaces all current data
4. Click file to import
5. Data restored instantly!

### Best Practices
- Export before major changes
- Export monthly as backup
- Keep exports in cloud storage
- Use for switching devices

---

## Tips & Tricks

### Maximize Recovery Rate
- Mark benefits as used promptly
- Check dashboard monthly
- Focus on high-value benefits first
- Use all benefits before period ends

### Organize Multiple Profiles
- Use clear names (Andrew, Becca, not User1, User2)
- Each person manages their own benefits
- Compare recovery rates for motivation

### Database Management
- Add new cards as you get them
- Keep benefits up-to-date
- Remove outdated benefits
- Document spend thresholds

### Optimization Strategy
1. Enter actual spending (not estimates)
2. Update quarterly
3. Follow "Best Card" recommendations
4. Consider wallet size recommendations
5. Balance points vs. simplicity

---

## Troubleshooting

### Card Added to Wrong Profile
1. Click **"Remove"** on the card
2. Click **"+ Add Card"**
3. Select correct profile
4. Add the card again

### Benefits Not Showing
- Make sure they're for the current period
- Check if you're in the right month/quarter
- Verify period is set correctly (M2 for Feb, Q1 for Jan-Mar, etc.)

### Data Not Saving
- Check browser settings allow localStorage
- Not in Private/Incognito mode
- Export data as backup
- Try different browser

### Dropdown Hard to Read
- Fixed in v2.1.0!
- Options now have dark background
- White text for contrast

---

## Keyboard Shortcuts

Currently none, but coming soon:
- [ ] Ctrl+E - Export data
- [ ] Ctrl+N - New profile
- [ ] Escape - Close modals

---

## Need Help?

- Check [QUICKSTART.md](QUICKSTART.md) for basics
- Read [FEATURES.md](FEATURES.md) for full feature list
- See [INSTALLATION.md](INSTALLATION.md) for setup
- Open issue on GitHub
- Contact: your-email@example.com

---

**Happy Tracking! 💳✨**
