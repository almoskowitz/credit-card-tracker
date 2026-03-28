# Firebase Cloud Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace localStorage persistence with Firebase Realtime Database so the app syncs across devices.

**Architecture:** Add Firebase JS SDK via CDN (like React/Babel). Use Firebase Realtime Database to store the same 5 data keys currently in localStorage. Use Firebase Anonymous Auth to create a device-linked session, with a simple "sync code" (the Firebase user UID) users can enter on other devices to link them. Keep localStorage as a fallback/cache so the app works offline.

**Tech Stack:** Firebase Realtime Database (free Spark plan), Firebase Anonymous Auth, Firebase JS SDK v9 compat (CDN)

---

### Task 1: Create Firebase Project & Get Config

This is a manual step — no code.

**Step 1: Create the Firebase project**

1. Go to https://console.firebase.google.com/
2. Click "Add project" → name it `credit-card-tracker` → disable Google Analytics (not needed) → Create
3. Click "Build" → "Realtime Database" → "Create Database"
4. Choose region (us-central1 is fine) → Start in **test mode** (we'll lock it down in Task 6)
5. Click "Authentication" → "Get Started" → Enable "Anonymous" sign-in method

**Step 2: Get the Firebase config**

1. In Firebase console → Project Settings (gear icon) → scroll to "Your apps" → click web icon (`</>`)
2. Register app name: `credit-card-tracker` → Register
3. Copy the `firebaseConfig` object — you'll paste it in Task 2

**Step 3: Commit — nothing to commit yet**

---

### Task 2: Add Firebase SDK Scripts & Initialize

**Files:**
- Modify: `credit-card-tracker-full.html:7-9` (add script tags after Babel)
- Modify: `credit-card-tracker-full.html:670` (add Firebase init before INITIAL_CARD_DATABASE)

**Step 1: Add Firebase CDN scripts after the Babel script tag (line 9)**

Add these three script tags after the existing Babel `<script>` tag:

```html
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js"></script>
```

**Step 2: Add Firebase initialization at the top of the `<script type="text/babel">` block (before `INITIAL_CARD_DATABASE`)**

```javascript
const firebaseConfig = {
    // PASTE YOUR CONFIG FROM TASK 1 HERE
    apiKey: "...",
    authDomain: "...",
    databaseURL: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();
```

**Step 3: Open in browser, check console for errors**

Expected: No errors. Firebase should initialize silently.

**Step 4: Commit**

```bash
git add credit-card-tracker-full.html
git commit -m "feat: add Firebase SDK and initialization"
```

---

### Task 3: Add Anonymous Auth & Sync Code UI

**Files:**
- Modify: `credit-card-tracker-full.html` — inside `App()` component

**Step 1: Add auth state and sync code state variables**

After the existing `useState` declarations (around line 759), add:

```javascript
const [firebaseUser, setFirebaseUser] = useState(null);
const [syncCode, setSyncCode] = useState('');
const [syncInput, setSyncInput] = useState('');
const [showSyncModal, setShowSyncModal] = useState(false);
const [syncStatus, setSyncStatus] = useState('offline'); // 'offline' | 'syncing' | 'synced'
```

**Step 2: Add auth effect**

After the existing `useEffect(() => { loadData(); }, []);` block, add:

```javascript
useEffect(() => {
    const savedSyncCode = localStorage.getItem('sync-code');
    if (savedSyncCode) {
        setSyncCode(savedSyncCode);
    }

    auth.signInAnonymously().then(() => {
        console.log('Firebase auth ready');
    }).catch(err => {
        console.error('Auth error:', err);
    });

    const unsubscribe = auth.onAuthStateChanged(user => {
        if (user) {
            setFirebaseUser(user);
            if (!savedSyncCode) {
                setSyncCode(user.uid);
                localStorage.setItem('sync-code', user.uid);
            }
        }
    });
    return () => unsubscribe();
}, []);
```

**Step 3: Add sync modal UI**

Add a "Sync" button in the actions bar (near the Export/Import buttons), and a modal:

```jsx
<button className="btn btn-sm" onClick={() => setShowSyncModal(true)}>
    {syncStatus === 'synced' ? '✓ Synced' : syncStatus === 'syncing' ? '↻ Syncing' : '☁ Sync'}
</button>
```

The sync modal should show:
- Current sync code (copyable) with explanation: "Enter this code on your other devices to sync"
- Input field to enter a sync code from another device
- "Link Device" button that saves the entered code and reloads data from Firebase

```jsx
{showSyncModal && (
    <div className="modal-overlay" onClick={() => setShowSyncModal(false)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Cloud Sync</h3>
            <div style={{marginTop: '1rem'}}>
                <label className="form-label">Your Sync Code</label>
                <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    <input className="form-input" value={syncCode} readOnly style={{fontFamily: 'monospace', fontSize: '0.8rem'}} />
                    <button className="btn btn-sm" onClick={() => {navigator.clipboard.writeText(syncCode); alert('Copied!')}}>Copy</button>
                </div>
                <p style={{fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem'}}>
                    Enter this code on another device to sync your data.
                </p>
            </div>
            <div style={{marginTop: '1.5rem'}}>
                <label className="form-label">Link Another Device's Data</label>
                <div style={{display: 'flex', gap: '0.5rem'}}>
                    <input className="form-input" placeholder="Paste sync code here" value={syncInput} onChange={e => setSyncInput(e.target.value)} />
                    <button className="btn btn-sm" onClick={() => {
                        if (syncInput.trim()) {
                            setSyncCode(syncInput.trim());
                            localStorage.setItem('sync-code', syncInput.trim());
                            setSyncInput('');
                            setShowSyncModal(false);
                            window.location.reload();
                        }
                    }}>Link</button>
                </div>
                <div style={{padding: '0.75rem', background: 'rgba(255,193,7,0.1)', borderRadius: '8px', marginTop: '1rem', fontSize: '0.8rem'}}>
                    <strong>⚠️</strong> Linking will replace your local data with the other device's data.
                </div>
            </div>
            <button className="btn" onClick={() => setShowSyncModal(false)} style={{marginTop: '1rem'}}>Close</button>
        </div>
    </div>
)}
```

**Step 4: Open in browser, verify auth works and sync code displays**

Expected: Modal opens, shows a Firebase UID as the sync code.

**Step 5: Commit**

```bash
git add credit-card-tracker-full.html
git commit -m "feat: add anonymous auth and sync code UI"
```

---

### Task 4: Replace saveData with Firebase Write

**Files:**
- Modify: `credit-card-tracker-full.html` — `saveData` function (~line 783)

**Step 1: Rewrite `saveData` to write to both localStorage and Firebase**

Replace the existing `saveData` function:

```javascript
const saveData = () => {
    try {
        localStorage.setItem('profiles', JSON.stringify(profiles));
        localStorage.setItem('cards', JSON.stringify(cards));
        localStorage.setItem('card-database', JSON.stringify(cardDatabase));
        localStorage.setItem('used-benefits', JSON.stringify(usedBenefits));
        localStorage.setItem('annual-spending', JSON.stringify(annualSpending));
    } catch (error) {
        console.error('Local save error:', error);
    }

    if (syncCode) {
        setSyncStatus('syncing');
        db.ref('users/' + syncCode).set({
            profiles,
            cards,
            cardDatabase,
            usedBenefits,
            annualSpending,
            lastUpdated: Date.now()
        }).then(() => {
            setSyncStatus('synced');
        }).catch(err => {
            console.error('Firebase save error:', err);
            setSyncStatus('offline');
        });
    }
};
```

**Step 2: Verify — make a change (add a profile), check Firebase console**

Open Firebase Console → Realtime Database. You should see a `users/<uid>` node with your data.

**Step 3: Commit**

```bash
git add credit-card-tracker-full.html
git commit -m "feat: write data to Firebase on every save"
```

---

### Task 5: Replace loadData with Firebase Read + Real-Time Listener

**Files:**
- Modify: `credit-card-tracker-full.html` — `loadData` function and the `useEffect` that calls it

**Step 1: Rewrite `loadData` to read from Firebase first, localStorage as fallback**

Replace the existing `loadData` function:

```javascript
const loadData = () => {
    // Load from localStorage immediately (fast, works offline)
    try {
        const profilesData = localStorage.getItem('profiles');
        const cardsData = localStorage.getItem('cards');
        const databaseData = localStorage.getItem('card-database');
        const benefitsData = localStorage.getItem('used-benefits');
        const spendingData = localStorage.getItem('annual-spending');

        if (profilesData) setProfiles(JSON.parse(profilesData));
        if (cardsData) setCards(JSON.parse(cardsData));
        if (databaseData) setCardDatabase(JSON.parse(databaseData));
        if (benefitsData) setUsedBenefits(JSON.parse(benefitsData));
        if (spendingData) setAnnualSpending(JSON.parse(spendingData));
    } catch (error) {
        console.log('No local data');
    }
};
```

**Step 2: Add a real-time Firebase listener in a new useEffect**

Add this after the auth useEffect (from Task 3):

```javascript
useEffect(() => {
    if (!syncCode) return;

    const ref = db.ref('users/' + syncCode);
    const listener = ref.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            setSyncStatus('synced');
            if (data.profiles) setProfiles(data.profiles);
            if (data.cards) setCards(data.cards);
            if (data.cardDatabase) setCardDatabase(data.cardDatabase);
            if (data.usedBenefits) setUsedBenefits(data.usedBenefits);
            if (data.annualSpending) setAnnualSpending(data.annualSpending);
        }
    }, (error) => {
        console.error('Firebase listener error:', error);
        setSyncStatus('offline');
    });

    return () => ref.off('value', listener);
}, [syncCode]);
```

**Step 3: Prevent save loop — the Firebase listener will trigger state changes, which triggers the save useEffect, which writes back to Firebase**

Modify the save `useEffect` to skip saving when data came from Firebase. Add a ref to track this:

```javascript
const skipNextSave = React.useRef(false);
```

In the Firebase listener (from Step 2), set `skipNextSave.current = true` before updating state.

Update the save `useEffect`:

```javascript
useEffect(() => {
    if (skipNextSave.current) {
        skipNextSave.current = false;
        return;
    }
    if (profiles.length > 0 || cards.length > 0 || Object.keys(cardDatabase).length > 0) {
        saveData();
    }
}, [profiles, cards, cardDatabase, usedBenefits, annualSpending]);
```

**Step 4: Test cross-device sync**

1. Open the app in two different browsers (e.g., Chrome and Edge)
2. In browser 2, enter the sync code from browser 1
3. Make a change in browser 1 → verify it appears in browser 2 within seconds

**Step 5: Commit**

```bash
git add credit-card-tracker-full.html
git commit -m "feat: add real-time Firebase listener for cross-device sync"
```

---

### Task 6: Lock Down Firebase Security Rules

**Step 1: In Firebase Console → Realtime Database → Rules, replace with:**

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": true,
        ".write": true
      }
    },
    ".read": false,
    ".write": false
  }
}
```

This allows read/write only under `users/<syncCode>` paths and blocks everything else. Since sync codes are random Firebase UIDs (28 chars), they're unguessable.

> **Note:** For stronger security, you could restrict `.write` to authenticated users whose `auth.uid` matches `$uid`. But since we want multiple devices to share a sync code (and they each get different anonymous UIDs), the simple rules above are the pragmatic choice. The sync code itself acts as a shared secret.

**Step 2: Test that the app still works after rules change**

**Step 3: Commit — nothing to commit (rules are in Firebase console, not in code)**

---

### Task 7: Enable GitHub Pages

This is a manual step.

**Step 1: In your GitHub repo → Settings → Pages**
- Source: "Deploy from a branch"
- Branch: `main` → `/ (root)`
- Save

**Step 2: Wait ~1 minute, then visit `https://almoskowitz.github.io/credit-card-tracker/credit-card-tracker-full.html`**

The app should load and work on any device with that URL.

**Step 3: Add the GitHub Pages URL to the Firebase authorized domains**

Firebase Console → Authentication → Settings → Authorized domains → Add `almoskowitz.github.io`

---

### Task 8: Final Testing

**Step 1: Test on phone**

1. Open the GitHub Pages URL on your phone's browser
2. Open sync modal, enter your sync code from desktop
3. Verify all data appears

**Step 2: Test bidirectional sync**

1. Mark a benefit as used on your phone
2. Verify it updates on desktop within seconds (Firebase real-time listener)

**Step 3: Test offline fallback**

1. Turn off WiFi on phone
2. App should still work with cached localStorage data
3. Turn WiFi back on — changes should sync

**Step 4: Commit any final tweaks**
