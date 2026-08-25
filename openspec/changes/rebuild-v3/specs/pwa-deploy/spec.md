# Capability: PWA & Deploy

Home-screen installability, and running the service on the Mac Studio under the house
infrastructure conventions.

## ADDED Requirements

### Requirement: The client is a web app manifest away from installable

The system SHALL ship `public/manifest.webmanifest` declaring `display: standalone` and a
theme and background colour of `#0b1220`, with icons at the sizes iOS and Android require.

#### Scenario: The manifest declares standalone display

- **GIVEN** the built client
- **WHEN** the manifest is fetched
- **THEN** it declares `display: standalone`, `start_url` at the root, `theme_color`
  `#0b1220`, and `background_color` `#0b1220`
- **AND** it lists 192px and 512px icons

#### Scenario: No service worker is registered

- **GIVEN** the running client
- **WHEN** service worker registrations are inspected
- **THEN** there are none
- **AND** the build output contains no service worker file

---

### Requirement: iOS home-screen installation works over the tailnet

The system SHALL include the Apple-specific meta tags and an apple-touch-icon, and SHALL
use `viewport-fit=cover` so the layout extends into the safe areas.

#### Scenario: The app installs and launches standalone

- **GIVEN** an iPhone on the tailnet
- **WHEN** the user opens `https://<your-machine>.<your-tailnet>.ts.net:8443/` in Safari
  and chooses Add to Home Screen
- **THEN** the icon carries the app's artwork and name
- **AND** launching from it opens with no Safari chrome — no address bar and no toolbar

#### Scenario: The port does not surface to the user

- **GIVEN** the installed home-screen app
- **WHEN** it is launched
- **THEN** no `:8443` is visible anywhere in the UI

#### Scenario: The layout respects the notch and home indicator

- **GIVEN** the installed app on a device with a notch and home indicator
- **WHEN** any tab is displayed
- **THEN** content extends behind the status bar as intended with no clipped text
- **AND** the tab bar sits above the home indicator

---

### Requirement: The service runs under launchd with restart on failure

The system SHALL run as a launchd user agent named `com.llm.card-tracker`, started by
`llm-infrastructure/scripts/start_card_tracker.sh`, logging to
`llm-infrastructure/logs/card-tracker.log`.

#### Scenario: The start script follows the house pattern

- **GIVEN** `llm-infrastructure/scripts/start_card_tracker.sh`
- **WHEN** it is read
- **THEN** it sources `llm-infrastructure/.env`, builds `DATABASE_URL`, and ends with
  `exec .venv/bin/uvicorn server.app:app --host 127.0.0.1 --port 8101`
- **AND** it contains no credential literal

#### Scenario: The agent starts at load and restarts on failure

- **GIVEN** `~/Library/LaunchAgents/com.llm.card-tracker.plist` bootstrapped
- **WHEN** the uvicorn process is killed
- **THEN** launchd restarts it and the service answers `/api/health` again within seconds

#### Scenario: The agent survives a reboot

- **GIVEN** the bootstrapped agent
- **WHEN** the Mac Studio is rebooted and the user session starts
- **THEN** the service is running without manual intervention

#### Scenario: Logs land in the house location

- **GIVEN** a running service
- **WHEN** `llm-infrastructure/logs/card-tracker.log` is read
- **THEN** it contains uvicorn's startup lines and any errors

---

### Requirement: The service is exposed on a second HTTPS port

The system SHALL publish the service with
`tailscale serve --bg --https=8443 http://127.0.0.1:8101`, serving at the root of that
port rather than under a sub-path.

#### Scenario: The app answers at the root of port 8443

- **GIVEN** the serve configuration active
- **WHEN** `https://<your-machine>.<your-tailnet>.ts.net:8443/` is opened from a tailnet
  device
- **THEN** the client loads over a valid certificate
- **AND** `/api/health` on the same host and port returns 200

#### Scenario: The existing service on 443 is undisturbed

- **GIVEN** the OpenRouter dashboard already served on port 443
- **WHEN** the card tracker serve configuration is added
- **THEN** the dashboard still answers on 443 unchanged

#### Scenario: Root serving needs no base path configuration

- **GIVEN** the deployment
- **WHEN** the build configuration and the manifest are inspected
- **THEN** neither sets a base href, a scope, or a start URL other than `/`

#### Scenario: The service is not reachable outside the tailnet

- **GIVEN** the deployment
- **WHEN** the host is probed from outside the tailnet
- **THEN** neither 8101 nor 8443 is reachable

---

### Requirement: Availability is monitored and sleep is verified off

The system SHALL add a probe to `llm-infrastructure/scripts/health_check.sh`, and the
machine's sleep configuration SHALL be verified rather than assumed.

#### Scenario: The health check covers the new service

- **GIVEN** the updated `health_check.sh`
- **WHEN** it runs against a healthy service
- **THEN** it reports the card tracker as up
- **AND WHEN** the service is stopped, the next run reports it down

#### Scenario: Sleep is checked, not assumed

- **GIVEN** the deployment
- **WHEN** `pmset -g` is run and its output recorded
- **THEN** it confirms the machine will not sleep
- **AND** if it would, the configuration is changed and re-verified before the deployment
  is called done

#### Scenario: The phone reaches the app after the machine sits idle

- **GIVEN** a deployed service and a Mac Studio left idle overnight
- **WHEN** the app is opened from the phone the next morning
- **THEN** it loads and syncs without a manual wake

---

### Requirement: Deploying the client is a build and a copy

The system SHALL provide `npm run deploy` which builds the single-file client and copies
the output into `server/static/`.

#### Scenario: Deploy publishes a new build

- **GIVEN** a source change
- **WHEN** `npm run deploy` is run
- **THEN** `dist/` is rebuilt and its contents are copied into `server/static/`
- **AND** refreshing the app in a browser shows the change without restarting the service

#### Scenario: The build output is a single HTML file

- **GIVEN** a completed build
- **WHEN** `dist/` is listed
- **THEN** the client is one `index.html` with all CSS and JS inlined
- **AND** it loads with no external script or stylesheet request

#### Scenario: A failed build does not publish

- **GIVEN** a source change that fails type checking or the build
- **WHEN** `npm run deploy` is run
- **THEN** it exits non-zero
- **AND** `server/static/` still holds the previous working build

---

### Requirement: The deployment satisfies the end-to-end acceptance sweep

The system SHALL be verified against the full acceptance list on real devices before the
work is considered done.

#### Scenario: The acceptance sweep passes

- **GIVEN** the fully deployed system
- **WHEN** each criterion is exercised on a real iPhone and a real laptop
- **THEN** all of the following hold:
  - the app installs to the iPhone home screen and launches standalone
  - a phone edit is visible on the laptop after a refresh, and the reverse
  - a stale tab receives a 409 and refreshes instead of clobbering
  - killing the service produces an explicit unreachable state with mutations disabled
  - adding a card from the catalog seeds its benefits without writing back to
    `data/cards.json`
  - a fee-year-anchored quarterly credit on a Jan 31 fee date computes all four windows
    correctly
  - export produces a file that import restores to an identical state
- **AND** each result is recorded so a regression can be traced to a specific criterion
