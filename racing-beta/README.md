# Beta Car Racing Game

Private testing edition of BeeBright's racing game. Download the latest **Beta-Car-Racing-Game.exe** from this repository's Releases and double-click it. No Python installation, login, admin account, cloud save or public website is required. Windows 10/11 with Microsoft Edge WebView2 Runtime is supported. Windows can warn about an unsigned beta executable; this build is not code-signed.

Choose Harbor Circuit, Canyon Switchback, Alpine Hairpins or Midnight Metro, then Start race. WASD/arrows drive and reverse, R switches cockpit/chase camera, and Escape pauses. High graphics uses Babylon.js with clearcoat paint, HDR tone mapping, bloom, reflections and soft shadows. Lightweight graphics retains a fallback for weaker devices. A transmission animates shifts, driver hands and dashboard gauges.

The game uses the exact same racing mechanics and models as BeeBright. Its private Actions workflow checks the public canonical repository every 15 minutes and on manual dispatch. When racing source changes, it copies only racing files, tests them, builds and actually launches the Windows executable, then publishes a private prerelease. Updates are downloaded from Releases; existing executables do not silently update themselves. GitHub can delay scheduled runs.

For development: install Node 22.12 or newer, run `npm ci`, `npm test`, then `npm run dev`. `npm run build` creates the offline interface. On Windows, install Python 3.14, `pip install pywebview==6.2.1 pythonnet==3.2.0 pyinstaller==6.22.3`, then `python -m PyInstaller --onefile --name Beta-Car-Racing-Game --collect-all webview --collect-all clr_loader --add-data "dist;dist" launcher.py`. The downloadable executable bundles Python; it does not install a shared runtime on your computer.

Original unbranded cars and procedural art; no Mercedes logos or Assetto Corsa assets. This remains a small racing beta, with visual fidelity below a commercial racing simulator. Source and original content retain BeeBright's Creative Commons Attribution-NonCommercial-ShareAlike 4.0 license. Babylon.js (Apache-2.0), Three.js (MIT), pywebview (BSD), Python and other dependencies retain their own licenses, bundled in THIRD_PARTY_NOTICES.txt.

Uninstall: delete the downloaded executable. It keeps no accounts, cloud data or saved racing progress. No administrator rights or system Python removal is needed.
