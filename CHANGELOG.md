# Changelog

All notable changes to the Credit Card Rewards Tracker will be documented in this file.

## [2.2.0] - 2026-02-10

### Added
- **Available Benefits HUD** - Centralized benefit tracking dashboard
  - Shows all current benefits from all cards in one place
  - Tile format matching individual card style
  - Displays card name on each benefit tile
  - Click to mark used/unused
  - **Syncs automatically** with individual card sections
  - Only shows benefits for current period
  - Appears between stats and action buttons
  - Glassmorphic design matching overall theme

### Technical Details
- Clicking benefit in HUD updates the same benefit in card section
- Clicking benefit in card section updates the same benefit in HUD
- Uses same `toggleBenefit` function for perfect sync
- Filters to current period only (no inactive benefits)
- Benefits keyed by unique card ID + benefit index

## [2.1.0] - 2026-02-10

### Added
- **Remove Card Button** - Delete cards from profiles with one click
  - Appears on each card header
  - Confirmation dialog before deletion
  - Removes card without affecting database
  - Stops propagation to avoid expanding card

### Fixed
- **Dropdown Contrast** - Fixed white-on-white text in select menus
  - Select options now have dark background
  - White text on dark background for readability
  - Consistent across all dropdowns

## [2.0.0] - 2026-02-10

### Added
- **Data Persistence** - Now uses browser localStorage to save all data
- **Export/Import** - Backup and restore your data
  - Export creates timestamped JSON file
  - Import allows restoring from backup
  - Warning message before overwriting data
- **Database Management UI** - Full CRUD operations
  - Add new cards to database
  - Edit card benefits
  - Remove benefits
  - All changes auto-save
- **Profile System** - Track cards for multiple people
  - Create/delete profiles
  - Assign cards to profiles
  - Same card can be used by multiple profiles
  - Profile badges on cards
- **Wallet Optimizer** - Smart spending recommendations
  - Input annual spending by category
  - Best card per category
  - 3/5/7-card optimal wallet suggestions
  - Live points calculation
- **Database Tab** - Dedicated tab for managing card database
- **Current Period Filtering** - Only shows relevant benefits
  - Monthly benefits (M1-M12)
  - Quarterly benefits (Q1-Q4)
  - Semi-annual benefits (H1-H2)
  - Annual benefits
- **Real-time Updates** - All stats update immediately
  - Donut charts
  - Recovery percentages
  - Available/Used counts
  - Total statistics

### Changed
- Storage backend from window.storage API to localStorage
- Improved error handling for data operations
- Enhanced modal designs
- Better mobile responsiveness

### Fixed
- Data not persisting between sessions
- Async/await removed for localStorage (synchronous operations)
- Data parsing for localStorage format
- Benefit tracking by unique card IDs

## [1.0.0] - 2026-02-08

### Added
- Initial release
- Basic card tracking
- Benefit management
- Glassmorphic UI design
- 24 pre-loaded credit cards
- Monthly/Quarterly/Semi-Annual/Annual benefits
- Recovery percentage tracking
- Collapsible card sections

---

## Upcoming Features

### v2.1.0 (Planned)
- [ ] Clear all data button
- [ ] Undo/redo functionality
- [ ] Search cards
- [ ] Filter by issuer
- [ ] Sort cards by various metrics

### v3.0.0 (Planned)
- [ ] Historical tracking charts
- [ ] Calendar integration
- [ ] Benefit expiration reminders
- [ ] PDF report generation
- [ ] Multi-currency support

### v4.0.0 (Future)
- [ ] Cloud sync
- [ ] Mobile apps (iOS/Android)
- [ ] Shared household tracking
- [ ] AI-powered recommendations
