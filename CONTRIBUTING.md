# Contributing to Credit Card Rewards Tracker

Thank you for your interest in contributing! This project welcomes contributions of all kinds.

## 🎯 Ways to Contribute

### 1. Add New Credit Cards
The easiest way to contribute is by adding new cards to the database.

**To add a card:**
1. Open `credit-card-tracker.html`
2. Find the `INITIAL_CARD_DATABASE` constant
3. Add your card following this structure:

```javascript
"Card Name": {
  "issuer": "Bank Name",
  "annualFee": 95,
  "periodicBenefits": [
    {
      "name": "Monthly Credit",
      "type": "Dining",  // Dining, Travel, or Shop
      "frequency": "Monthly",  // Monthly, Quarterly, Semi-Annual, or Annual
      "value": 15,
      "period": "M2"  // M1-M12 for monthly, Q1-Q4 for quarterly, H1-H2 for semi-annual
    }
  ],
  "multipliers": {
    "Dining": 3,
    "Travel": 2,
    "Everything Else": 1
  }
}
```

### 2. Report Bugs
Found a bug? Please open an issue with:
- Description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS info

### 3. Suggest Features
Have an idea? Open an issue with:
- Feature description
- Use case / problem it solves
- Proposed implementation (if you have one)

### 4. Improve Documentation
- Fix typos
- Clarify confusing sections
- Add examples
- Translate to other languages

### 5. Code Contributions

**Setup:**
```bash
git clone https://github.com/yourusername/credit-card-tracker.git
cd credit-card-tracker
# No build step needed! Just open credit-card-tracker.html
```

**Making Changes:**
1. Create a new branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly in multiple browsers
4. Commit: `git commit -m "Description of changes"`
5. Push: `git push origin feature/your-feature-name`
6. Open a Pull Request

## 📋 Code Style

- Use consistent indentation (2 spaces)
- Follow existing naming conventions
- Comment complex logic
- Keep functions small and focused
- Use meaningful variable names

## ✅ Testing Checklist

Before submitting a PR, please verify:
- [ ] Works in Chrome
- [ ] Works in Firefox
- [ ] Works in Safari
- [ ] Works on mobile
- [ ] No console errors
- [ ] Data persists after refresh
- [ ] All modals open/close properly
- [ ] Benefits update stats correctly

## 🔍 Review Process

1. Maintainer reviews code
2. Feedback/changes requested if needed
3. Once approved, PR is merged
4. Your contribution is live!

## 📜 License

By contributing, you agree that your contributions will be licensed under the MIT License.

## 🙏 Thank You!

Every contribution helps make this tool better for everyone!
