# Git setup (before the workshop)

Do this **at home, before the workshop**. It takes about 15 minutes. At the end you'll run one test command. If it works, you're ready.

- [ ] 1. Install git
- [ ] 2. Tell git who you are
- [ ] 3. Sign in to GitHub from git
- [ ] 4. Test

> [!IMPORTANT]
> Type the commands exactly as shown, one line at a time, and press Enter after each one. Replace only the parts in `"quotes"` that are clearly yours (your name, your email).

## 1. Install git

Pick your system.

<details>
<summary><b>Windows</b></summary>

1. Download the installer: https://git-scm.com/downloads/win (the "64-bit Git for Windows Setup" link).
2. Run it and click **Next** on every screen, **except these two**:
   - **"Choosing the default editor used by Git"**: select **Use the Nano editor by default** (or Visual Studio Code if you use it). The default, Vim, is hard for beginners.
   - **"Adjusting the name of the initial branch in new repositories"**: select **Override the default branch name** and leave it as `main`.
3. Click **Install**, then **Finish**.
4. Open the Start menu and launch **Git Bash**. Use Git Bash for every command in this guide and in the workshop.

</details>

<details>
<summary><b>macOS</b></summary>

1. Open **Terminal** (press <kbd>Cmd</kbd>+<kbd>Space</kbd>, type `Terminal`, press Enter).
2. Run:
   ```
   git --version
   ```
3. If a window asks you to install the **command line developer tools**, click **Install** and wait until it finishes (5 to 10 minutes). Then run `git --version` again.
4. Install the GitHub CLI, which you need in step 3. If you have [Homebrew](https://brew.sh):
   ```
   brew install gh
   ```
   No Homebrew? Download the macOS installer (`.pkg`) from https://cli.github.com instead.

</details>

<details>
<summary><b>Linux</b></summary>

Ubuntu / Debian:
```
sudo apt update
sudo apt install git gh
```

Fedora:
```
sudo dnf install git gh
```

If `gh` isn't found, follow https://github.com/cli/cli/blob/trunk/docs/install_linux.md.

</details>

**Check:** run

```
git --version
```

You should see something like `git version 2.47.1`. Any version **2.23 or newer** is fine.

## 2. Tell git who you are

Your name and email go into every commit you make. Run these four lines and use your own name:

```
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
git config --global pull.rebase true
git config --global init.defaultBranch main
```

> [!TIP]
> **Keep your email private:** commits are visible to everyone who can see the repo. To hide your real email, open https://github.com/settings/emails, tick **Keep my email addresses private**, and copy the address shown there. It looks like `12345678+yourname@users.noreply.github.com`. Use that address in the `user.email` line above.

On **macOS and Linux**, also set a beginner-friendly editor (Windows users already picked one in the installer):

```
git config --global core.editor nano
```

**Check:** run

```
git config --global --list
```

You should see your `user.name`, `user.email`, `pull.rebase=true` and `init.defaultbranch=main`.

## 3. Sign in to GitHub from git

GitHub doesn't accept your password from the terminal. Sign in once through your browser instead.

<details>
<summary><b>Windows</b></summary>

Nothing to install: Git for Windows includes a sign-in helper. A browser window will open during the test in step 4. Choose **Sign in with your browser** and click **Authorize**.

</details>

<details>
<summary><b>macOS and Linux</b></summary>

Run:
```
gh auth login
```
Answer the questions with the arrow keys and Enter:

| Question | Answer |
|---|---|
| Where do you use GitHub? | **GitHub.com** |
| Preferred protocol for Git operations? | **HTTPS** |
| Authenticate Git with your GitHub credentials? | **Yes** |
| How would you like to authenticate? | **Login with a web browser** |

Copy the one-time code it shows, press Enter, paste the code in the browser, and click **Authorize**.

**Check:** `gh auth status` says `Logged in to github.com account <your-username>`.

</details>

## 4. Test

Run:

```
git ls-remote https://github.com/knnmelprop/git-workshop.git
```

✅ **Ready:** you see a few lines like this (the long codes will differ):

```
50a9de2c...    HEAD
50a9de2c...    refs/heads/main
```

That's it. Don't clone the repo yet: we'll do that together at the workshop.

## Something went wrong?

| You see | Fix |
|---|---|
| `git: command not found` / `'git' is not recognized` | Windows: use **Git Bash**, not Command Prompt or PowerShell. macOS/Linux: redo step 1, then close and reopen the terminal. |
| `Repository not found` | You signed in with a GitHub account that isn't in **knnmelprop**. Redo step 3 with your club account. Still failing? Send your GitHub username to the organizer. |
| Asked for a **password** in the terminal | Press <kbd>Ctrl</kbd>+<kbd>C</kbd> and do step 3. GitHub doesn't accept passwords here. |
| `gh: command not found` | Install the GitHub CLI (step 1), then close and reopen the terminal. |
| `git version 2.22` or older | Update git: reinstall (Windows), `brew upgrade git` (macOS), or your package manager (Linux). |
| Something else | Take a screenshot and send it to the organizer before the workshop. |
