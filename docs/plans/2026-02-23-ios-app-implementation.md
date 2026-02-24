# iOS App Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a native SwiftUI iOS app that imports the web app's JSON export and lets you view and mark credit card benefits used/unused on your phone.

**Architecture:** Four-tab SwiftUI app (Today, Cards, Optimizer, Settings) backed by SwiftData for local persistence. All business logic lives in pure Swift functions that mirror the web app's JS logic exactly. Data flows from SwiftData through `@Query` into views; shared profile filter lives in an `@Observable` AppState injected via environment.

**Tech Stack:** Swift 5.9, SwiftUI, SwiftData, iOS 17+, XCTest for unit tests on business logic.

**Design reference:** `docs/plans/2026-02-22-ios-app-design.md`

---

## Project Structure

```
CreditCardTracker/
├── CreditCardTrackerApp.swift       # App entry point, ModelContainer setup
├── AppState.swift                   # @Observable shared state (profile filter)
├── Models/
│   ├── Profile.swift                # SwiftData @Model
│   ├── WalletCard.swift             # SwiftData @Model
│   ├── CardDefinition.swift         # SwiftData @Model (periodicBenefits as JSON blob)
│   ├── UsedBenefit.swift            # SwiftData @Model
│   └── BenefitTypes.swift           # Plain Swift structs decoded from JSON blobs
├── Logic/
│   ├── BenefitLogic.swift           # Pure functions: isCurrentPeriod, calculateCardStats, etc.
│   └── WalletOptimizer.swift        # Pure function: calculateOptimalWallet
├── Import/
│   └── JSONImporter.swift           # Codable structs + import logic
├── Views/
│   ├── ContentView.swift            # TabView root
│   ├── Today/
│   │   ├── TodayView.swift
│   │   └── BenefitRowView.swift
│   ├── Cards/
│   │   ├── CardsGridView.swift
│   │   ├── CardTileView.swift
│   │   └── CardDetailView.swift
│   ├── Optimizer/
│   │   └── OptimizerView.swift
│   └── Settings/
│       └── SettingsView.swift
└── CreditCardTrackerTests/
    ├── BenefitLogicTests.swift
    ├── WalletOptimizerTests.swift
    └── JSONImporterTests.swift
```

---

### Task 1: Xcode Project Setup

**Files:**
- Create: `CreditCardTracker/` (Xcode project — done via Xcode UI)

**Step 1: Create the Xcode project**

In Xcode: File → New → Project → iOS → App
- Product Name: `CreditCardTracker`
- Interface: SwiftUI
- Language: Swift
- Storage: SwiftData ← tick this box
- Team: your personal team
- Bundle ID: `com.yourname.CreditCardTracker`

Uncheck "Include Tests" — we'll add the test target manually in the next step.

**Step 2: Add test target**

In Xcode: File → New → Target → Unit Testing Bundle
- Name: `CreditCardTrackerTests`
- Target to be tested: `CreditCardTracker`

**Step 3: Create folder structure**

In Finder, create these empty folders inside the project directory:
```
Models/
Logic/
Import/
Views/Today/
Views/Cards/
Views/Optimizer/
Views/Settings/
```

Drag each folder into the Xcode project navigator (check "Create groups", uncheck "Copy items").

**Step 4: Delete Xcode boilerplate**

Delete the generated `Item.swift` (the sample SwiftData model Xcode creates). Keep `CreditCardTrackerApp.swift` and `ContentView.swift`.

**Step 5: Commit**

```bash
git init  # if not already a git repo inside the iOS project folder
git add .
git commit -m "feat: scaffold Xcode project"
```

---

### Task 2: Benefit Type Structs (BenefitTypes.swift)

These are plain Swift structs decoded from the JSON blobs stored in `CardDefinition`. No SwiftData, no UI — pure data containers.

**Files:**
- Create: `Models/BenefitTypes.swift`

**Step 1: Write the failing test**

In `CreditCardTrackerTests/BenefitLogicTests.swift`:

```swift
import XCTest
@testable import CreditCardTracker

final class BenefitLogicTests: XCTestCase {
    func test_periodicBenefit_decodes_from_json() throws {
        let json = """
        {
            "name": "Dining Credit",
            "type": "dining",
            "frequency": "Monthly",
            "period": "M1",
            "value": 20
        }
        """.data(using: .utf8)!
        let benefit = try JSONDecoder().decode(PeriodicBenefit.self, from: json)
        XCTAssertEqual(benefit.name, "Dining Credit")
        XCTAssertEqual(benefit.frequency, "Monthly")
        XCTAssertEqual(benefit.numericValue, 20.0)
    }
}
```

**Step 2: Run test — confirm it fails**

`Cmd+U`. Expected: compile error "cannot find type PeriodicBenefit".

**Step 3: Implement BenefitTypes.swift**

```swift
import Foundation

struct PeriodicBenefit: Codable, Identifiable {
    var id: String { "\(name)-\(period ?? frequency)" }
    let name: String
    let type: String?
    let frequency: String       // "Monthly" | "Quarterly" | "Semi-Annual" | "Annual"
    let period: String?         // "M1", "Q2", "H1", etc.
    let value: BenefitValue?
    let monetaryValue: Double?

    /// Returns the dollar value to use for stats calculations.
    var numericValue: Double {
        if let mv = monetaryValue { return mv }
        if case .number(let n) = value { return n }
        return 0
    }

    /// Returns the display string for the benefit value.
    var displayValue: String {
        if let mv = monetaryValue { return "$\(Int(mv))" }
        if let v = value {
            switch v {
            case .number(let n): return "$\(Int(n))"
            case .string(let s): return s
            }
        }
        return ""
    }
}

// The web app uses value as either a number or a string
enum BenefitValue: Codable {
    case number(Double)
    case string(String)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let n = try? container.decode(Double.self) {
            self = .number(n); return
        }
        if let s = try? container.decode(String.self) {
            self = .string(s); return
        }
        throw DecodingError.typeMismatch(BenefitValue.self,
            .init(codingPath: decoder.codingPath, debugDescription: "Expected number or string"))
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .number(let n): try container.encode(n)
        case .string(let s): try container.encode(s)
        }
    }
}
```

**Step 4: Run test — confirm it passes**

`Cmd+U`. Expected: PASS.

**Step 5: Commit**

```bash
git add Models/BenefitTypes.swift CreditCardTrackerTests/BenefitLogicTests.swift
git commit -m "feat: add PeriodicBenefit and BenefitValue types"
```

---

### Task 3: SwiftData Models

**Files:**
- Create: `Models/Profile.swift`
- Create: `Models/WalletCard.swift`
- Create: `Models/CardDefinition.swift`
- Create: `Models/UsedBenefit.swift`

**Step 1: Profile.swift**

```swift
import SwiftData

@Model
final class Profile {
    var id: String
    var name: String

    init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}
```

**Step 2: WalletCard.swift**

```swift
import SwiftData

@Model
final class WalletCard {
    var id: String
    var cardName: String
    var profileId: String

    init(id: String, cardName: String, profileId: String) {
        self.id = id
        self.cardName = cardName
        self.profileId = profileId
    }
}
```

**Step 3: CardDefinition.swift**

```swift
import SwiftData
import Foundation

@Model
final class CardDefinition {
    var name: String
    var issuer: String
    var annualFee: Double
    var periodicBenefitsJSON: String   // raw JSON array string
    var multipliersJSON: String        // raw JSON object string

    init(name: String, issuer: String, annualFee: Double,
         periodicBenefitsJSON: String, multipliersJSON: String) {
        self.name = name
        self.issuer = issuer
        self.annualFee = annualFee
        self.periodicBenefitsJSON = periodicBenefitsJSON
        self.multipliersJSON = multipliersJSON
    }

    /// Decodes periodicBenefitsJSON into an array of PeriodicBenefit.
    func periodicBenefits() -> [PeriodicBenefit] {
        guard let data = periodicBenefitsJSON.data(using: .utf8),
              let benefits = try? JSONDecoder().decode([PeriodicBenefit].self, from: data)
        else { return [] }
        return benefits
    }

    /// Decodes multipliersJSON into [category: multiplier].
    func multipliers() -> [String: Double] {
        guard let data = multipliersJSON.data(using: .utf8),
              let mults = try? JSONDecoder().decode([String: Double].self, from: data)
        else { return [:] }
        return mults
    }
}
```

**Step 4: UsedBenefit.swift**

```swift
import SwiftData

@Model
final class UsedBenefit {
    var key: String   // "{cardId}-{benefitIndex}-{year}-{period}"

    init(key: String) {
        self.key = key
    }

    static func makeKey(cardId: String, benefitIndex: Int,
                        year: Int, period: String) -> String {
        "\(cardId)-\(benefitIndex)-\(year)-\(period)"
    }
}
```

**Step 5: Verify build**

`Cmd+B`. Expected: builds without errors.

**Step 6: Commit**

```bash
git add Models/
git commit -m "feat: add SwiftData models (Profile, WalletCard, CardDefinition, UsedBenefit)"
```

---

### Task 4: JSON Importer

Reads the web app's exported JSON and writes it into SwiftData.

**Files:**
- Create: `Import/JSONImporter.swift`
- Create: `CreditCardTrackerTests/JSONImporterTests.swift`

**Step 1: Write the failing test**

```swift
import XCTest
import SwiftData
@testable import CreditCardTracker

final class JSONImporterTests: XCTestCase {

    func test_import_creates_profiles_and_cards() throws {
        let json = """
        {
          "profiles": [{"id": "p1", "name": "Andrew"}],
          "cards": [{"id": "c1", "profileId": "p1", "cardName": "Amex Gold"}],
          "cardDatabase": {
            "Amex Gold": {
              "issuer": "American Express",
              "annualFee": 250,
              "periodicBenefits": [],
              "multipliers": {}
            }
          },
          "usedBenefits": {},
          "annualSpending": {}
        }
        """.data(using: .utf8)!

        let config = ModelConfiguration(isStoredInMemoryOnly: true)
        let container = try ModelContainer(for: Profile.self, WalletCard.self,
                                           CardDefinition.self, UsedBenefit.self,
                                           configurations: config)
        let context = ModelContext(container)

        try JSONImporter.import(json, into: context)

        let profiles = try context.fetch(FetchDescriptor<Profile>())
        XCTAssertEqual(profiles.count, 1)
        XCTAssertEqual(profiles.first?.name, "Andrew")

        let cards = try context.fetch(FetchDescriptor<WalletCard>())
        XCTAssertEqual(cards.count, 1)
        XCTAssertEqual(cards.first?.cardName, "Amex Gold")
    }
}
```

**Step 2: Run test — confirm it fails**

`Cmd+U`. Expected: compile error "cannot find type JSONImporter".

**Step 3: Implement JSONImporter.swift**

```swift
import Foundation
import SwiftData

// Codable structs matching the web app's JSON export format
private struct WebExport: Codable {
    let profiles: [WebProfile]
    let cards: [WebCard]
    let cardDatabase: [String: WebCardDef]
    let usedBenefits: [String: Bool]
    let annualSpending: [String: Double]?
}

private struct WebProfile: Codable {
    let id: String
    let name: String
}

private struct WebCard: Codable {
    let id: String
    let profileId: String
    let cardName: String
}

private struct WebCardDef: Codable {
    let issuer: String?
    let annualFee: Double?
    let periodicBenefits: [PeriodicBenefit]?
    let multipliers: [String: Double]?
}

enum JSONImporter {
    enum ImportError: Error {
        case invalidJSON
    }

    static func `import`(_ data: Data, into context: ModelContext) throws {
        guard let export = try? JSONDecoder().decode(WebExport.self, from: data) else {
            throw ImportError.invalidJSON
        }

        // Clear existing data before import
        try context.delete(model: Profile.self)
        try context.delete(model: WalletCard.self)
        try context.delete(model: CardDefinition.self)
        try context.delete(model: UsedBenefit.self)

        for p in export.profiles {
            context.insert(Profile(id: p.id, name: p.name))
        }

        for c in export.cards {
            context.insert(WalletCard(id: c.id, cardName: c.cardName, profileId: c.profileId))
        }

        let encoder = JSONEncoder()
        for (name, def) in export.cardDatabase {
            let benefitsJSON = (try? encoder.encode(def.periodicBenefits ?? [])).flatMap {
                String(data: $0, encoding: .utf8)
            } ?? "[]"
            let multipliersJSON = (try? encoder.encode(def.multipliers ?? [:])).flatMap {
                String(data: $0, encoding: .utf8)
            } ?? "{}"
            context.insert(CardDefinition(
                name: name,
                issuer: def.issuer ?? "Unknown",
                annualFee: def.annualFee ?? 0,
                periodicBenefitsJSON: benefitsJSON,
                multipliersJSON: multipliersJSON
            ))
        }

        for (key, isUsed) in export.usedBenefits where isUsed {
            context.insert(UsedBenefit(key: key))
        }

        try context.save()
    }

    static func export(from context: ModelContext) throws -> Data {
        let profiles = try context.fetch(FetchDescriptor<Profile>())
        let cards = try context.fetch(FetchDescriptor<WalletCard>())
        let defs = try context.fetch(FetchDescriptor<CardDefinition>())
        let used = try context.fetch(FetchDescriptor<UsedBenefit>())

        var dbDict: [String: WebCardDef] = [:]
        let decoder = JSONDecoder()
        for def in defs {
            let benefits = (def.periodicBenefitsJSON.data(using: .utf8)).flatMap {
                try? decoder.decode([PeriodicBenefit].self, from: $0)
            } ?? []
            let multipliers = (def.multipliersJSON.data(using: .utf8)).flatMap {
                try? decoder.decode([String: Double].self, from: $0)
            } ?? [:]
            dbDict[def.name] = WebCardDef(
                issuer: def.issuer,
                annualFee: def.annualFee,
                periodicBenefits: benefits,
                multipliers: multipliers
            )
        }

        let usedDict = Dictionary(uniqueKeysWithValues: used.map { ($0.key, true) })

        let export = WebExport(
            profiles: profiles.map { WebProfile(id: $0.id, name: $0.name) },
            cards: cards.map { WebCard(id: $0.id, profileId: $0.profileId, cardName: $0.cardName) },
            cardDatabase: dbDict,
            usedBenefits: usedDict,
            annualSpending: nil
        )

        return try JSONEncoder().encode(export)
    }
}
```

**Step 4: Run test — confirm it passes**

`Cmd+U`. Expected: PASS.

**Step 5: Commit**

```bash
git add Import/JSONImporter.swift CreditCardTrackerTests/JSONImporterTests.swift
git commit -m "feat: add JSON importer/exporter matching web app schema"
```

---

### Task 5: Business Logic — BenefitLogic

Pure functions, no SwiftUI, fully testable. Mirrors the web app's JS logic.

**Files:**
- Create: `Logic/BenefitLogic.swift`
- Modify: `CreditCardTrackerTests/BenefitLogicTests.swift`

**Step 1: Write the failing tests**

Add to `BenefitLogicTests.swift`:

```swift
func test_isCurrentPeriod_monthly_returns_true() {
    let now = Calendar.current.dateComponents([.month, .year], from: Date())
    let monthNum = now.month!
    let period = "M\(monthNum)"
    let benefit = makeBenefit(frequency: "Monthly", period: period)
    XCTAssertTrue(BenefitLogic.isCurrentPeriod(benefit))
}

func test_isCurrentPeriod_wrong_month_returns_false() {
    let now = Calendar.current.dateComponents([.month], from: Date())
    let wrongMonth = (now.month! % 12) + 1
    let benefit = makeBenefit(frequency: "Monthly", period: "M\(wrongMonth)")
    XCTAssertFalse(BenefitLogic.isCurrentPeriod(benefit))
}

func test_calculateCardStats_counts_used_value() {
    let benefits = [
        makeBenefit(frequency: "Monthly", period: currentMonthPeriod(), value: 20),
        makeBenefit(frequency: "Monthly", period: currentMonthPeriod(), value: 50),
    ]
    let usedKeys: Set<String> = [
        UsedBenefit.makeKey(cardId: "c1", benefitIndex: 0,
                             year: currentYear(), period: currentMonthPeriod())
    ]
    let stats = BenefitLogic.calculateCardStats(
        cardId: "c1", annualFee: 100, benefits: benefits, usedKeys: usedKeys)
    XCTAssertEqual(stats.usedAnnualValue, 20)
    XCTAssertEqual(stats.recovery, 20)
}

// Helpers
private func makeBenefit(frequency: String, period: String,
                          value: Double = 0) -> PeriodicBenefit {
    PeriodicBenefit(name: "Test", type: "dining", frequency: frequency,
                    period: period, value: .number(value), monetaryValue: nil)
}
private func currentMonthPeriod() -> String { "M\(Calendar.current.component(.month, from: Date()))" }
private func currentYear() -> Int { Calendar.current.component(.year, from: Date()) }
```

**Step 2: Run tests — confirm they fail**

`Cmd+U`. Expected: compile error "cannot find BenefitLogic".

**Step 3: Implement BenefitLogic.swift**

```swift
import Foundation

enum BenefitLogic {

    static let urgencyOrder: [String: Int] = [
        "Monthly": 0, "Quarterly": 1, "Semi-Annual": 2, "Annual": 3
    ]

    /// Returns true if the benefit falls in the current calendar period.
    static func isCurrentPeriod(_ benefit: PeriodicBenefit) -> Bool {
        let cal = Calendar.current
        let now = Date()
        let month = cal.component(.month, from: now)
        let quarter = (month - 1) / 3 + 1
        let half = month <= 6 ? 1 : 2

        switch benefit.frequency {
        case "Monthly":
            return benefit.period == "M\(month)"
        case "Quarterly":
            return benefit.period == "Q\(quarter)"
        case "Semi-Annual":
            return benefit.period == "H\(half)"
        case "Annual":
            return true
        default:
            return false
        }
    }

    /// Returns the period key string for a benefit in the current period.
    static func currentPeriodKey(for benefit: PeriodicBenefit) -> String {
        benefit.period ?? benefit.frequency
    }

    struct CardStats {
        let totalAnnualValue: Double
        let usedAnnualValue: Double
        let recovery: Double        // 0–100
        let currentPeriodTotal: Double
        let currentPeriodUsed: Double
        let availableCount: Int
    }

    static func calculateCardStats(cardId: String, annualFee: Double,
                                    benefits: [PeriodicBenefit],
                                    usedKeys: Set<String>) -> CardStats {
        var totalAnnualValue = 0.0
        var usedAnnualValue = 0.0
        var currentPeriodTotal = 0.0
        var currentPeriodUsed = 0.0
        var availableCount = 0

        for (idx, benefit) in benefits.enumerated() {
            let val = benefit.numericValue
            let year = Calendar.current.component(.year, from: Date())
            let period = currentPeriodKey(for: benefit)
            let key = UsedBenefit.makeKey(cardId: cardId, benefitIndex: idx,
                                          year: year, period: period)
            let used = usedKeys.contains(key)

            totalAnnualValue += val
            if used { usedAnnualValue += val }

            if isCurrentPeriod(benefit) {
                currentPeriodTotal += val
                if used { currentPeriodUsed += val }
                else { availableCount += 1 }
            }
        }

        let recovery = annualFee > 0
            ? min((usedAnnualValue / annualFee) * 100, 100)
            : 0

        return CardStats(
            totalAnnualValue: totalAnnualValue,
            usedAnnualValue: usedAnnualValue,
            recovery: recovery,
            currentPeriodTotal: currentPeriodTotal,
            currentPeriodUsed: currentPeriodUsed,
            availableCount: availableCount
        )
    }

    static func recoveryTier(_ pct: Double) -> RecoveryTier {
        if pct >= 70 { return .high }
        if pct >= 40 { return .mid }
        return .low
    }

    enum RecoveryTier { case high, mid, low }
}
```

**Step 4: Run tests — confirm they pass**

`Cmd+U`. Expected: all tests PASS.

**Step 5: Commit**

```bash
git add Logic/BenefitLogic.swift CreditCardTrackerTests/BenefitLogicTests.swift
git commit -m "feat: add BenefitLogic (isCurrentPeriod, calculateCardStats)"
```

---

### Task 6: Business Logic — WalletOptimizer

**Files:**
- Create: `Logic/WalletOptimizer.swift`
- Create: `CreditCardTrackerTests/WalletOptimizerTests.swift`

**Step 1: Write the failing test**

```swift
import XCTest
@testable import CreditCardTracker

final class WalletOptimizerTests: XCTestCase {
    func test_optimizer_picks_highest_multiplier_card() {
        let cards: [(name: String, multipliers: [String: Double])] = [
            ("Gold", ["dining": 4.0, "travel": 3.0]),
            ("Sapphire", ["dining": 3.0, "travel": 3.0]),
        ]
        let spending: [String: Double] = ["dining": 1000, "travel": 500]
        let results = WalletOptimizer.calculate(cards: cards, spending: spending)
        XCTAssertEqual(results.first?.name, "Gold")
    }
}
```

**Step 2: Run test — confirm it fails**

`Cmd+U`. Expected: compile error.

**Step 3: Implement WalletOptimizer.swift**

```swift
import Foundation

enum WalletOptimizer {
    struct Result: Identifiable {
        let id = UUID()
        let name: String
        let score: Double
        // Best card per category: category → (multiplier, annualValue)
        let categoryBreakdown: [String: (multiplier: Double, value: Double)]
    }

    static func calculate(
        cards: [(name: String, multipliers: [String: Double])],
        spending: [String: Double]
    ) -> [Result] {
        let totalSpend = spending.values.reduce(0, +)

        return cards.map { card in
            var score = 0.0
            var breakdown: [String: (Double, Double)] = [:]

            if totalSpend > 0 {
                for (category, amount) in spending where amount > 0 {
                    let mult = card.multipliers[category] ?? 1.0
                    score += amount * mult
                    breakdown[category] = (mult, amount * mult)
                }
            } else {
                score = card.multipliers.values.reduce(0, +)
            }

            return Result(name: card.name, score: score, categoryBreakdown: breakdown)
        }
        .sorted { $0.score > $1.score }
    }
}
```

**Step 4: Run test — confirm it passes**

`Cmd+U`. Expected: PASS.

**Step 5: Commit**

```bash
git add Logic/WalletOptimizer.swift CreditCardTrackerTests/WalletOptimizerTests.swift
git commit -m "feat: add WalletOptimizer"
```

---

### Task 7: AppState + App Entry Point

Shared observable state and ModelContainer wiring.

**Files:**
- Create: `AppState.swift`
- Modify: `CreditCardTrackerApp.swift`

**Step 1: AppState.swift**

```swift
import SwiftUI

@Observable
final class AppState {
    var selectedProfileId: String? = nil   // nil = All profiles
    var annualSpending: [String: Double] = [:]
}
```

**Step 2: Update CreditCardTrackerApp.swift**

```swift
import SwiftUI
import SwiftData

@main
struct CreditCardTrackerApp: App {
    let container: ModelContainer
    @State private var appState = AppState()

    init() {
        do {
            container = try ModelContainer(for:
                Profile.self, WalletCard.self, CardDefinition.self, UsedBenefit.self)
        } catch {
            fatalError("Failed to create ModelContainer: \(error)")
        }
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
        }
        .modelContainer(container)
    }
}
```

**Step 3: Verify build**

`Cmd+B`. Expected: builds cleanly.

**Step 4: Commit**

```bash
git add AppState.swift CreditCardTrackerApp.swift
git commit -m "feat: add AppState and configure ModelContainer"
```

---

### Task 8: ContentView (TabView root)

**Files:**
- Modify: `Views/ContentView.swift`

**Step 1: Implement ContentView.swift**

```swift
import SwiftUI

struct ContentView: View {
    var body: some View {
        TabView {
            TodayView()
                .tabItem { Label("Today", systemImage: "calendar") }
            CardsGridView()
                .tabItem { Label("Cards", systemImage: "creditcard") }
            OptimizerView()
                .tabItem { Label("Optimizer", systemImage: "chart.bar") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gear") }
        }
    }
}
```

Create stub views so it compiles — add these placeholder files now:

`Views/Today/TodayView.swift` — `struct TodayView: View { var body: some View { Text("Today") } }`
`Views/Cards/CardsGridView.swift` — `struct CardsGridView: View { var body: some View { Text("Cards") } }`
`Views/Optimizer/OptimizerView.swift` — `struct OptimizerView: View { var body: some View { Text("Optimizer") } }`
`Views/Settings/SettingsView.swift` — `struct SettingsView: View { var body: some View { Text("Settings") } }`

**Step 2: Verify build + run in simulator**

`Cmd+R`. Expected: app launches, four tabs visible, each shows placeholder text.

**Step 3: Commit**

```bash
git add Views/
git commit -m "feat: add TabView shell with stub screens"
```

---

### Task 9: Settings Screen (Import/Export)

Build Settings first — you need it to load real data before building the other screens.

**Files:**
- Modify: `Views/Settings/SettingsView.swift`

**Step 1: Implement SettingsView.swift**

```swift
import SwiftUI
import SwiftData

struct SettingsView: View {
    @Environment(\.modelContext) private var context
    @Query private var profiles: [Profile]

    @State private var showImporter = false
    @State private var showExporter = false
    @State private var exportData: Data?
    @State private var alertMessage: String?
    @State private var showAlert = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Profiles") {
                    if profiles.isEmpty {
                        Text("No profiles — import data first")
                            .foregroundStyle(.secondary)
                    } else {
                        ForEach(profiles) { profile in
                            Text(profile.name)
                        }
                    }
                }

                Section("Data") {
                    Button("Import from web app…") {
                        showImporter = true
                    }
                    Button("Export…") {
                        do {
                            exportData = try JSONImporter.export(from: context)
                            showExporter = true
                        } catch {
                            alertMessage = "Export failed: \(error.localizedDescription)"
                            showAlert = true
                        }
                    }
                }

                Section("App") {
                    LabeledContent("Version", value: Bundle.main.appVersion)
                }
            }
            .navigationTitle("Settings")
            .fileImporter(isPresented: $showImporter,
                          allowedContentTypes: [.json]) { result in
                handleImport(result)
            }
            .shareSheet(data: exportData, isPresented: $showExporter)
            .alert("Import", isPresented: $showAlert) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(alertMessage ?? "")
            }
        }
    }

    private func handleImport(_ result: Result<URL, Error>) {
        switch result {
        case .success(let url):
            guard url.startAccessingSecurityScopedResource() else { return }
            defer { url.stopAccessingSecurityScopedResource() }
            do {
                let data = try Data(contentsOf: url)
                try JSONImporter.import(data, into: context)
                alertMessage = "Import successful!"
            } catch {
                alertMessage = "Import failed: \(error.localizedDescription)"
            }
            showAlert = true
        case .failure(let error):
            alertMessage = error.localizedDescription
            showAlert = true
        }
    }
}

// Helper extensions
extension Bundle {
    var appVersion: String {
        (infoDictionary?["CFBundleShortVersionString"] as? String) ?? "1.0"
    }
}

// Share sheet helper
extension View {
    func shareSheet(data: Data?, isPresented: Binding<Bool>) -> some View {
        sheet(isPresented: isPresented) {
            if let data {
                ShareLink(item: data, preview: SharePreview("credit-card-tracker.json"))
            }
        }
    }
}
```

**Step 2: Run in simulator, import your web app JSON**

Export from the web app (Export button), transfer the JSON file to your simulator (drag onto simulator window), then tap Import in Settings.

Expected: profiles appear in the Profiles section.

**Step 3: Commit**

```bash
git add Views/Settings/SettingsView.swift
git commit -m "feat: add Settings screen with JSON import/export"
```

---

### Task 10: Today Screen

**Files:**
- Modify: `Views/Today/TodayView.swift`
- Create: `Views/Today/BenefitRowView.swift`

**Step 1: BenefitRowView.swift**

```swift
import SwiftUI

struct BenefitRowView: View {
    let benefit: PeriodicBenefit
    let cardName: String
    let isUsed: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Circle()
                    .fill(typeColor(benefit.type))
                    .frame(width: 8, height: 8)

                VStack(alignment: .leading, spacing: 2) {
                    Text(benefit.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .strikethrough(isUsed)
                        .foregroundStyle(isUsed ? .secondary : .primary)
                    Text("\(benefit.type?.capitalized ?? "") · \(benefit.frequency)")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text(cardName)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !benefit.displayValue.isEmpty {
                        Text(benefit.displayValue)
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundStyle(isUsed ? .secondary : .primary)
                    }
                }

                if isUsed {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundStyle(.green)
                        .font(.caption)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .listRowBackground(isUsed ? Color.green.opacity(0.07) : Color.clear)
        .sensoryFeedback(.impact(flexibility: .soft), trigger: isUsed)
    }

    private func typeColor(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "dining": return .orange
        case "travel": return .cyan
        case "shopping", "shop": return .purple
        default: return .gray
        }
    }
}
```

**Step 2: TodayView.swift**

```swift
import SwiftUI
import SwiftData

struct TodayView: View {
    @Environment(\.modelContext) private var context
    @Environment(AppState.self) private var appState

    @Query private var allCards: [WalletCard]
    @Query private var allDefs: [CardDefinition]
    @Query private var usedBenefits: [UsedBenefit]
    @Query private var profiles: [Profile]

    private let frequencies = ["Monthly", "Quarterly", "Semi-Annual", "Annual"]
    @State private var expandedSections: Set<String> = ["Monthly"]

    var body: some View {
        NavigationStack {
            List {
                statsStrip

                ForEach(frequencies, id: \.self) { freq in
                    let items = benefitItems(for: freq)
                    if !items.isEmpty {
                        Section(isExpanded: binding(for: freq)) {
                            ForEach(items, id: \.key) { item in
                                BenefitRowView(
                                    benefit: item.benefit,
                                    cardName: item.cardName,
                                    isUsed: item.isUsed
                                ) { toggleUsed(item) }
                            }
                        } header: {
                            HStack {
                                Text(freq)
                                    .font(.subheadline).fontWeight(.semibold)
                                Spacer()
                                Text("\(items.filter { !$0.isUsed }.count) unused")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Today")
            .toolbar { profilePicker }
        }
    }

    // MARK: - Stats strip
    private var statsStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                statTile("Annual Fees", value: "$\(Int(totalStats.fees))")
                statTile("Recovered YTD", value: "$\(Int(totalStats.recovered))", color: .green)
                statTile("Recovery Rate", value: "\(Int(totalStats.rate))%", color: rateColor(totalStats.rate))
                statTile("Net Cost", value: "$\(Int(totalStats.netCost))", color: .red)
            }
            .padding(.vertical, 4)
        }
        .listRowInsets(EdgeInsets(top: 8, leading: 16, bottom: 8, trailing: 16))
        .listRowBackground(Color.clear)
        .listRowSeparator(.hidden)
    }

    private func statTile(_ label: String, value: String, color: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.caption2).foregroundStyle(.secondary).textCase(.uppercase)
            Text(value).font(.subheadline).fontWeight(.bold).foregroundStyle(color)
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    // MARK: - Profile picker toolbar item
    @ToolbarContentBuilder
    private var profilePicker: some ToolbarContent {
        if profiles.count > 1 {
            ToolbarItem(placement: .topBarTrailing) {
                @Bindable var state = appState
                Picker("Profile", selection: $state.selectedProfileId) {
                    Text("All").tag(String?.none)
                    ForEach(profiles) { p in
                        Text(p.name).tag(Optional(p.id))
                    }
                }
                .pickerStyle(.menu)
            }
        }
    }

    // MARK: - Helpers
    private struct BenefitItem {
        let key: String
        let cardId: String
        let benefitIndex: Int
        let benefit: PeriodicBenefit
        let cardName: String
        let isUsed: Bool
        let periodKey: String
    }

    private func benefitItems(for frequency: String) -> [BenefitItem] {
        let usedKeySet = Set(usedBenefits.map(\.key))
        let year = Calendar.current.component(.year, from: Date())
        var items: [BenefitItem] = []

        let filteredCards = allCards.filter {
            appState.selectedProfileId == nil || $0.profileId == appState.selectedProfileId
        }

        for card in filteredCards {
            guard let def = allDefs.first(where: { $0.name == card.cardName }) else { continue }
            let benefits = def.periodicBenefits()
            for (idx, benefit) in benefits.enumerated() {
                guard benefit.frequency == frequency,
                      BenefitLogic.isCurrentPeriod(benefit) else { continue }
                let period = BenefitLogic.currentPeriodKey(for: benefit)
                let key = UsedBenefit.makeKey(cardId: card.id, benefitIndex: idx,
                                              year: year, period: period)
                items.append(BenefitItem(key: key, cardId: card.id, benefitIndex: idx,
                                         benefit: benefit, cardName: card.cardName,
                                         isUsed: usedKeySet.contains(key), periodKey: period))
            }
        }
        return items
    }

    private func toggleUsed(_ item: BenefitItem) {
        let year = Calendar.current.component(.year, from: Date())
        if item.isUsed {
            if let existing = usedBenefits.first(where: { $0.key == item.key }) {
                context.delete(existing)
            }
        } else {
            context.insert(UsedBenefit(key: item.key))
        }
        try? context.save()
    }

    private func binding(for freq: String) -> Binding<Bool> {
        Binding(
            get: { expandedSections.contains(freq) },
            set: { if $0 { expandedSections.insert(freq) } else { expandedSections.remove(freq) } }
        )
    }

    // MARK: - Total stats
    private var totalStats: (fees: Double, recovered: Double, rate: Double, netCost: Double) {
        let usedKeySet = Set(usedBenefits.map(\.key))
        let filteredCards = allCards.filter {
            appState.selectedProfileId == nil || $0.profileId == appState.selectedProfileId
        }
        var fees = 0.0, recovered = 0.0
        for card in filteredCards {
            guard let def = allDefs.first(where: { $0.name == card.cardName }) else { continue }
            fees += def.annualFee
            let stats = BenefitLogic.calculateCardStats(
                cardId: card.id, annualFee: def.annualFee,
                benefits: def.periodicBenefits(), usedKeys: usedKeySet)
            recovered += stats.usedAnnualValue
        }
        let rate = fees > 0 ? min((recovered / fees) * 100, 100) : 0
        return (fees, recovered, rate, fees - recovered)
    }

    private func rateColor(_ rate: Double) -> Color {
        switch BenefitLogic.recoveryTier(rate) {
        case .high: return .green
        case .mid: return .orange
        case .low: return .red
        }
    }
}
```

**Step 3: Run in simulator with imported data**

`Cmd+R`. Navigate to Today tab. Expected: benefit sections visible, tap a row toggles used state with haptic.

**Step 4: Commit**

```bash
git add Views/Today/
git commit -m "feat: add Today screen with benefit sections and toggle"
```

---

### Task 11: Cards Grid + Card Tile

**Files:**
- Modify: `Views/Cards/CardsGridView.swift`
- Create: `Views/Cards/CardTileView.swift`

**Step 1: CardTileView.swift**

```swift
import SwiftUI

struct CardTileView: View {
    let card: WalletCard
    let def: CardDefinition
    let profileName: String
    let usedKeys: Set<String>

    private var stats: BenefitLogic.CardStats {
        BenefitLogic.calculateCardStats(
            cardId: card.id, annualFee: def.annualFee,
            benefits: def.periodicBenefits(), usedKeys: usedKeys)
    }

    private var currentBenefits: [(index: Int, benefit: PeriodicBenefit)] {
        def.periodicBenefits().enumerated()
            .filter { BenefitLogic.isCurrentPeriod($0.element) }
            .map { (index: $0.offset, benefit: $0.element) }
            .sorted { (BenefitLogic.urgencyOrder[$0.benefit.frequency] ?? 0) <
                      (BenefitLogic.urgencyOrder[$1.benefit.frequency] ?? 0) }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.cardName)
                        .font(.subheadline).fontWeight(.bold)
                        .lineLimit(2)
                    Text(def.issuer)
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                Text(profileName)
                    .font(.caption2).padding(.horizontal, 6).padding(.vertical, 2)
                    .background(.pink.opacity(0.2), in: Capsule())
                    .foregroundStyle(.pink)
            }
            .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 6)

            // Stats row
            HStack(spacing: 0) {
                statCell("Fee", value: "$\(Int(def.annualFee))")
                statCell("Avail", value: "\(stats.availableCount)")
                statCell("YTD", value: "$\(Int(stats.usedAnnualValue))")
                statCell("Rec", value: "\(Int(stats.recovery))%",
                         color: tierColor(BenefitLogic.recoveryTier(stats.recovery)))
            }
            .padding(.horizontal, 12).padding(.bottom, 6)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 2)
                        .fill(.white.opacity(0.1))
                    RoundedRectangle(cornerRadius: 2)
                        .fill(tierGradient(BenefitLogic.recoveryTier(stats.recovery)))
                        .frame(width: geo.size.width * min(stats.recovery / 100, 1))
                }
            }
            .frame(height: 3)
            .padding(.horizontal, 12).padding(.bottom, 8)

            // Benefit chips
            Divider().opacity(0.15)
            if currentBenefits.isEmpty {
                Text("No benefits this period")
                    .font(.caption).foregroundStyle(.tertiary).italic()
                    .padding(.horizontal, 12).padding(.vertical, 8)
            } else {
                FlowLayout(spacing: 4) {
                    ForEach(currentBenefits, id: \.index) { item in
                        let year = Calendar.current.component(.year, from: Date())
                        let period = BenefitLogic.currentPeriodKey(for: item.benefit)
                        let key = UsedBenefit.makeKey(cardId: card.id, benefitIndex: item.index,
                                                      year: year, period: period)
                        let used = usedKeys.contains(key)
                        Text(chipLabel(item.benefit))
                            .font(.caption2).lineLimit(1)
                            .padding(.horizontal, 6).padding(.vertical, 3)
                            .background(chipColor(item.benefit.type).opacity(0.15),
                                        in: RoundedRectangle(cornerRadius: 6))
                            .overlay(RoundedRectangle(cornerRadius: 6)
                                .stroke(chipColor(item.benefit.type).opacity(0.3)))
                            .foregroundStyle(used ? .secondary : .primary)
                            .strikethrough(used)
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 8)
            }
        }
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 14))
        .overlay(alignment: .top) {
            issuerAccent
        }
    }

    private var issuerAccent: some View {
        RoundedRectangle(cornerRadius: 14)
            .stroke(issuerColor(def.issuer), lineWidth: 0)
            .overlay(alignment: .top) {
                issuerColor(def.issuer)
                    .frame(height: 3)
                    .clipShape(UnevenRoundedRectangle(
                        topLeadingRadius: 14, topTrailingRadius: 14))
            }
    }

    private func statCell(_ label: String, value: String, color: Color = .primary) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(label).font(.system(size: 8)).textCase(.uppercase)
                .foregroundStyle(.secondary)
            Text(value).font(.caption).fontWeight(.bold).foregroundStyle(color)
                .monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func chipLabel(_ b: PeriodicBenefit) -> String {
        b.displayValue.isEmpty ? b.name : "\(b.displayValue) \(b.name)"
    }

    private func chipColor(_ type: String?) -> Color {
        switch type?.lowercased() {
        case "dining": return .orange
        case "travel": return .cyan
        case "shopping", "shop": return .purple
        default: return .gray
        }
    }

    private func tierColor(_ tier: BenefitLogic.RecoveryTier) -> Color {
        switch tier { case .high: return .green; case .mid: return .orange; case .low: return .red }
    }

    private func tierGradient(_ tier: BenefitLogic.RecoveryTier) -> LinearGradient {
        let c = tierColor(tier)
        return LinearGradient(colors: [c, c.opacity(0.7)], startPoint: .leading, endPoint: .trailing)
    }

    private func issuerColor(_ issuer: String) -> Color {
        let i = issuer.lowercased()
        if i.contains("american express") { return Color(hex: "#c9a357") }
        if i.contains("chase") { return Color(hex: "#1a8fe3") }
        if i.contains("capital one") { return Color(hex: "#e04535") }
        if i.contains("citi") { return Color(hex: "#0073cf") }
        if i.contains("barclays") { return Color(hex: "#00aeef") }
        if i.contains("bank of america") { return Color(hex: "#cc1f36") }
        return .gray
    }
}

// Hex color helper
extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >> 8) & 0xFF) / 255
        let b = Double(int & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// Simple flow layout for chips
struct FlowLayout: Layout {
    var spacing: CGFloat = 4
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        return CGSize(width: proposal.width ?? 0,
                      height: rows.map(\.height).reduce(0, +) + CGFloat(max(0, rows.count-1)) * spacing)
    }
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let rows = computeRows(proposal: proposal, subviews: subviews)
        var y = bounds.minY
        for row in rows {
            var x = bounds.minX
            for sv in row.views {
                let size = sv.sizeThatFits(.unspecified)
                sv.place(at: CGPoint(x: x, y: y), proposal: .unspecified)
                x += size.width + spacing
            }
            y += row.height + spacing
        }
    }
    private struct Row { var views: [LayoutSubview] = []; var height: CGFloat = 0 }
    private func computeRows(proposal: ProposedViewSize, subviews: Subviews) -> [Row] {
        var rows: [Row] = []
        var current = Row()
        var x: CGFloat = 0
        let maxWidth = proposal.width ?? .infinity
        for sv in subviews {
            let size = sv.sizeThatFits(.unspecified)
            if x + size.width > maxWidth && !current.views.isEmpty {
                rows.append(current); current = Row(); x = 0
            }
            current.views.append(sv)
            current.height = max(current.height, size.height)
            x += size.width + spacing
        }
        if !current.views.isEmpty { rows.append(current) }
        return rows
    }
}
```

**Step 2: CardsGridView.swift**

```swift
import SwiftUI
import SwiftData

struct CardsGridView: View {
    @Environment(AppState.self) private var appState
    @Query private var allCards: [WalletCard]
    @Query private var allDefs: [CardDefinition]
    @Query private var usedBenefits: [UsedBenefit]
    @Query private var profiles: [Profile]

    private let columns = [GridItem(.adaptive(minimum: 160), spacing: 12)]

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(filteredCards) { card in
                        if let def = allDefs.first(where: { $0.name == card.cardName }) {
                            NavigationLink {
                                CardDetailView(card: card, def: def,
                                               usedKeys: usedKeySet)
                            } label: {
                                CardTileView(card: card, def: def,
                                             profileName: profileName(card.profileId),
                                             usedKeys: usedKeySet)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Cards")
        }
    }

    private var filteredCards: [WalletCard] {
        allCards.filter {
            appState.selectedProfileId == nil || $0.profileId == appState.selectedProfileId
        }
    }

    private var usedKeySet: Set<String> { Set(usedBenefits.map(\.key)) }

    private func profileName(_ id: String) -> String {
        profiles.first(where: { $0.id == id })?.name ?? ""
    }
}
```

**Step 3: Run in simulator**

`Cmd+R`. Navigate to Cards tab. Expected: card tiles in a 2-column grid with issuer accent bars, stats, progress bars, and benefit chips.

**Step 4: Commit**

```bash
git add Views/Cards/CardsGridView.swift Views/Cards/CardTileView.swift
git commit -m "feat: add Cards grid with tile layout"
```

---

### Task 12: Card Detail View

**Files:**
- Modify: `Views/Cards/CardDetailView.swift`

**Step 1: Implement CardDetailView.swift**

```swift
import SwiftUI
import SwiftData

struct CardDetailView: View {
    let card: WalletCard
    let def: CardDefinition
    let usedKeys: Set<String>

    @Environment(\.modelContext) private var context
    @Query private var usedBenefits: [UsedBenefit]

    private var benefits: [PeriodicBenefit] { def.periodicBenefits() }
    private let frequencies = ["Monthly", "Quarterly", "Semi-Annual", "Annual"]
    private var liveUsedKeys: Set<String> { Set(usedBenefits.map(\.key)) }

    var body: some View {
        List {
            // Stats header
            Section {
                let stats = BenefitLogic.calculateCardStats(
                    cardId: card.id, annualFee: def.annualFee,
                    benefits: benefits, usedKeys: liveUsedKeys)
                HStack {
                    statCell("Fee", "$\(Int(def.annualFee))")
                    Divider()
                    statCell("YTD", "$\(Int(stats.usedAnnualValue))")
                    Divider()
                    statCell("Recovery", "\(Int(stats.recovery))%",
                             color: tierColor(BenefitLogic.recoveryTier(stats.recovery)))
                }
                .fixedSize(horizontal: false, vertical: true)

                ProgressView(value: min(stats.recovery / 100, 1))
                    .tint(tierColor(BenefitLogic.recoveryTier(stats.recovery)))
            }

            // Benefits by frequency
            ForEach(frequencies, id: \.self) { freq in
                let freqBenefits = benefits.enumerated()
                    .filter { $0.element.frequency == freq }
                if !freqBenefits.isEmpty {
                    Section(freq) {
                        ForEach(Array(freqBenefits), id: \.offset) { idx, benefit in
                            let year = Calendar.current.component(.year, from: Date())
                            let period = BenefitLogic.currentPeriodKey(for: benefit)
                            let key = UsedBenefit.makeKey(cardId: card.id, benefitIndex: idx,
                                                          year: year, period: period)
                            let used = liveUsedKeys.contains(key)
                            let isCurrent = BenefitLogic.isCurrentPeriod(benefit)

                            Button {
                                if isCurrent { toggle(key: key, used: used) }
                            } label: {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(benefit.name)
                                            .font(.subheadline)
                                            .strikethrough(used)
                                            .foregroundStyle(used ? .secondary : .primary)
                                        Text(benefit.type?.capitalized ?? "")
                                            .font(.caption).foregroundStyle(.secondary)
                                    }
                                    Spacer()
                                    Text(benefit.displayValue)
                                        .font(.subheadline).fontWeight(.semibold)
                                        .monospacedDigit()
                                    if used {
                                        Image(systemName: "checkmark.circle.fill")
                                            .foregroundStyle(.green)
                                    }
                                }
                            }
                            .buttonStyle(.plain)
                            .listRowBackground(
                                isCurrent ? (used ? Color.green.opacity(0.07) : Color.clear)
                                          : Color.secondary.opacity(0.05)
                            )
                            .sensoryFeedback(.impact(flexibility: .soft), trigger: used)
                        }
                    }
                }
            }
        }
        .navigationTitle(card.cardName)
        .navigationBarTitleDisplayMode(.inline)
    }

    private func toggle(key: String, used: Bool) {
        if used {
            if let existing = usedBenefits.first(where: { $0.key == key }) {
                context.delete(existing)
            }
        } else {
            context.insert(UsedBenefit(key: key))
        }
        try? context.save()
    }

    private func statCell(_ label: String, _ value: String, color: Color = .primary) -> some View {
        VStack(spacing: 2) {
            Text(label).font(.caption2).textCase(.uppercase).foregroundStyle(.secondary)
            Text(value).font(.subheadline).fontWeight(.bold).foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }

    private func tierColor(_ tier: BenefitLogic.RecoveryTier) -> Color {
        switch tier { case .high: return .green; case .mid: return .orange; case .low: return .red }
    }
}
```

**Step 2: Run in simulator**

Tap a card tile. Expected: detail sheet pushes with stats header, benefits grouped by frequency, tap to toggle.

**Step 3: Commit**

```bash
git add Views/Cards/CardDetailView.swift
git commit -m "feat: add Card Detail view"
```

---

### Task 13: Optimizer Screen

**Files:**
- Modify: `Views/Optimizer/OptimizerView.swift`

**Step 1: Implement OptimizerView.swift**

```swift
import SwiftUI
import SwiftData

struct OptimizerView: View {
    @Environment(AppState.self) private var appState
    @Query private var allCards: [WalletCard]
    @Query private var allDefs: [CardDefinition]

    private let categories = ["Dining", "Travel", "Groceries", "Gas", "Entertainment", "Other"]

    var body: some View {
        NavigationStack {
            Form {
                Section("Annual Spending") {
                    ForEach(categories, id: \.self) { category in
                        HStack {
                            Text(category)
                            Spacer()
                            Text("$")
                                .foregroundStyle(.secondary)
                            TextField("0", value: bindingFor(category), format: .number)
                                .keyboardType(.numberPad)
                                .multilineTextAlignment(.trailing)
                                .frame(width: 80)
                        }
                    }
                }

                let results = optimizerResults
                if !results.isEmpty {
                    ForEach(categories, id: \.self) { category in
                        let spend = appState.annualSpending[category.lowercased()] ?? 0
                        if spend > 0 {
                            Section("Best for \(category)") {
                                ForEach(Array(results.prefix(3)), id: \.id) { result in
                                    if let breakdown = result.categoryBreakdown[category.lowercased()] {
                                        HStack {
                                            Text(result.name).font(.subheadline)
                                            Spacer()
                                            Text("\(Int(breakdown.multiplier))x")
                                                .font(.caption).foregroundStyle(.secondary)
                                            Text("$\(Int(breakdown.value))/yr")
                                                .font(.subheadline).fontWeight(.semibold)
                                                .foregroundStyle(.green)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Optimizer")
        }
    }

    private func bindingFor(_ category: String) -> Binding<Double?> {
        Binding(
            get: { appState.annualSpending[category.lowercased()] },
            set: { appState.annualSpending[category.lowercased()] = $0 ?? 0 }
        )
    }

    private var optimizerResults: [WalletOptimizer.Result] {
        let filteredCards = allCards.filter {
            appState.selectedProfileId == nil || $0.profileId == appState.selectedProfileId
        }
        let input = filteredCards.compactMap { card -> (name: String, multipliers: [String: Double])? in
            guard let def = allDefs.first(where: { $0.name == card.cardName }) else { return nil }
            return (name: card.cardName, multipliers: def.multipliers())
        }
        let spending = appState.annualSpending.filter { $0.value > 0 }
        return WalletOptimizer.calculate(cards: input, spending: spending)
    }
}
```

**Step 2: Run in simulator**

Enter spending values. Expected: results appear live below, ranked by best card per category.

**Step 3: Commit**

```bash
git add Views/Optimizer/OptimizerView.swift
git commit -m "feat: add Optimizer screen"
```

---

### Task 14: Final Polish + Sideload

**Step 1: Set signing team**

In Xcode → CreditCardTracker target → Signing & Capabilities:
- Team: select your personal Apple ID team
- Bundle Identifier: `com.yourname.CreditCardTracker`

**Step 2: Connect iPhone and run**

Select your device from the Xcode toolbar, `Cmd+R`.

First run: Xcode may ask you to trust the developer certificate on your phone — go to Settings → General → VPN & Device Management → trust your Apple ID.

**Step 3: Import data on device**

- Export JSON from the web app on your Mac
- AirDrop it to your iPhone
- Open Files app, find the JSON
- In the app: Settings → Import → navigate to the file

**Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete iOS app v1 — read-only SwiftUI with JSON import"
```

---

## Summary

| Task | Output |
|------|--------|
| 1 | Xcode project + folder structure |
| 2 | `PeriodicBenefit`, `BenefitValue` structs |
| 3 | SwiftData models (Profile, WalletCard, CardDefinition, UsedBenefit) |
| 4 | JSON importer/exporter |
| 5 | BenefitLogic pure functions + tests |
| 6 | WalletOptimizer pure function + tests |
| 7 | AppState + ModelContainer wiring |
| 8 | ContentView TabView shell |
| 9 | Settings screen (import/export) |
| 10 | Today screen |
| 11 | Cards grid + CardTile |
| 12 | Card Detail view |
| 13 | Optimizer screen |
| 14 | Signing + sideload |
