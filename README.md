# CursorPort

If you've ever tried moving your favorite Windows cursors over to Linux, you know it can be a bit of a headache. **CursorPort** is a simple, web-based tool I built to bridge that gap. It helps you take Windows animated (`.ani`) and static (`.cur`) cursors and turn them into a theme that actually works on your Linux desktop.

## What it does

- **Distro Friendly**: Whether you're on Arch, Ubuntu, Fedora, or something else entirely, it'll work.
- **Live Commands**: As you type your username or theme name, the tool generates the exact terminal commands you need, no more guessing paths.
- **Featured Packs**: I've teamed up with artists like **BLZ** to include authorized demos (like the Frieren pack) right in the app.
- **Visual Mapping**: Instead of editing config files by hand, you can visually map Windows roles like "Working in Background" to their Linux equivalents.
- **One-Click Script**: It generates a `generate_symlink.sh` script for you that handles all the messy symlinking (over 50+ variations) automatically.
- **Beautiful UI**: Switch between "Miku" (Dark) and "Teto" (Light) modes depending on your vibe.
- **Remembers Your Work**: Your paths and mappings are saved locally, so you can pick up right where you left off.

## How to use it

1. **[Open CursorPort](https://cursorport.01blue.org/)** — No installation needed, it runs right in your browser.
2. **Grab your files**: Get the `.ani` or `.cur` files you want to use.
3. **Convert**: Follow the steps in the tool to run `win2xcur`. It'll give you the exact command to copy-paste.
4. **Organize**: Put your new cursors in `~/.local/share/icons/` using the command.
5. **Run the script**: Download and run the generated shell script to finish the setup.

## Prerequisites

The website handles the logic, but you'll need the `win2xcur` tool on your system to do the heavy lifting:

* **Arch Linux:** `yay -S win2xcur`
* **Everywhere else (Pip):** `pip install win2xcur`

## Gallery

<p align="center">
  <img src="./images/Page_Miku.jpeg" alt="Dark Mode (Miku)" width="45%" style="margin-right: 10px;" />
  <img src="./images/Page_Teto.jpeg" alt="Light Mode (Teto)" width="45%" />
</p>

## Credits & Support

* **Featured Artist:** <img src="./images/BLZ pfp.png" width="20" height="20" align="center" /> Big thanks to [BLZ Cursors](https://ko-fi.com/U7U6Z367V) for letting me feature their work. If you like the cursors in the demo, definitely consider supporting them on Ko-fi!
* **Contributors:** 
  * A huge shoutout to [hoangcaominh](https://github.com/hoangcaominh) for contributing a massive expansion to the symlink coverage. Thanks to their help, CursorPort now handles even more edge-case apps and desktop environments!
  * Big thanks to [fr0stb1rd](https://github.com/fr0stb1rd) for implementing the quick install one-liner (no need to download the script!) and several awesome UI tweaks.
* **Inspiration:** The UI themes are inspired by Hatsune Miku, Kasane Teto, and Akita Neru.

## License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details. Feel free to fork it, fix bugs, or contribute new features!
