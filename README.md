# TomlWhy
Type a TOML `key = value` line and see its TOML 1.0 type, parsed value, or the exact rule it breaks.
Static client-side app. Open `app.html`.
Scope: single-line scalars. Spec: https://toml.io/en/v1.0.0 (Integer, Float, Boolean, date-time and Local sections read directly; String section read for basic and literal strings).
Tests: `node test-engine.js` compares against Python tomli 2.4.1 (`oracle.py`). Deliberate deviations: integers beyond 64 bits and times without seconds are errors (TOML 1.0), tomli accepts them.
