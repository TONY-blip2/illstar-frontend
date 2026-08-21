ILLSTAR — Editable Static Website
================================

How it works
------------
- This site reads product definitions from `products.json` and images from the `images/` folder.
- To add or edit products, open `products.json` in a text editor and follow the existing structure.
- To add images, place them into the `images/` folder and reference their filename in `products.json`.

Files included
--------------
- index.html        — Main page (streetwear urban design)
- style.css         — Styling
- script.js         — Loads products.json and renders the product grid
- products.json     — Product data (edit this to add/remove products)
- images/           — Product images (replace placeholders with your own)
- README.txt        — This file

Quick product example (products.json entries)
--------------------------------------------
Each product is an object with keys:
- id: unique string (e.g., "p4")
- name: product title
- price: display price (e.g., "K350")
- image: relative path to image (e.g., "images/shoe.jpg")
- description: short text

Example:
{
  "id": "p4",
  "name": "ILLSTAR Cap",
  "price": "K120",
  "image": "images/cap.jpg",
  "description": "Adjustable cap with embroidered logo."
}

Editing settings (WhatsApp & Instagram)
--------------------------------------
- Open the page in a browser and click Settings.
- Enter your WhatsApp number (international format, without '+' or spaces, e.g., 260971467772).
- Enter your Instagram URL.
- Click Save. These settings update links while you view the site locally.

Notes about hosting
-------------------
- When you upload to a host (Netlify, GitHub Pages, Hostinger), the settings panel will still work but remember:
  - Fetching `products.json` is done client-side; some hosts may cache. If you update products.json on the server, users will see updates immediately on reload.
  - If you want server-side product management (admin login, uploads), you'd need a lightweight CMS or a small backend.

Support
-------
If you want, I can:
- Add an admin UI that edits products.json from the browser (requires running locally with a simple server), or
- Prepare a GitHub repository and instructions to deploy to GitHub Pages or Netlify.

"soldOut": true
$env:DB_PASSWORD="rootpss"; npm run dev





# ILLSTAR — Git Push Cheat Sheet

## The one sequence you'll use 95% of the time

Every time you finish making changes — whether it's code, images, anything — the process is always the same three commands:

```
git add .
git commit -m "short description of what you changed"
git push
```

That's it. `git add .` stages everything you changed, `git commit` saves a labeled checkpoint, `git push` sends it to GitHub (which then triggers your live site to update automatically).

---

## Which folder do I need to be in?

This depends on WHAT you're changing:

| You changed...                          | Open this folder in VS Code                          |
|------------------------------------------|--------------------------------------------------------|
| `index.html`, `main.js`, `style.css`, images | `ILLSTAR WEBSITE` (frontend)                        |
| Anything in `src/` (controllers, routes, config) | `illstar-backend` (backend)                     |

**Always double-check** which folder your terminal is actually pointed at before running these commands. Quick check:
```
Get-Location
```
This prints the current folder path — make sure it matches what you meant to edit.

---

## Good commit messages

Doesn't need to be fancy — just a short note so future-you (or me) can tell what happened by skimming your history later:

- `"Add new product images"`
- `"Fix header logo size"`
- `"Update shipping policy text"`

---

## What happens after you push

- **Frontend** (`ILLSTAR WEBSITE` repo) → auto-deploys to both **Netlify** and **GitHub Pages**
- **Backend** (`illstar-backend` repo) → auto-deploys to **Render**

No extra steps needed — pushing to GitHub is the trigger for everything.

---

## Quick troubleshooting

**"nothing to commit, working tree clean"**
→ Totally fine — it just means there's nothing new to save. Either you already pushed this exact change, or you haven't actually saved the file in VS Code yet (check for the unsaved-changes dot on the file's tab).

**Want to double-check a file actually has your edit before pushing?**
```
Select-String -Path FILENAME -Pattern "something you know is in your edit"
```
If it finds a match, your edit is really there.

**Want to see what's about to be pushed?**
```
git status
```
Lists every file that's changed since your last commit.

**Made a mistake in your last commit message? (rare, don't worry about this unless it happens)**
```
git commit --amend -m "corrected message"
```

---

## The golden rule

If something ever looks unexpected — an error you don't recognize, a page that looks broken after deploying, anything confusing — **stop and paste it to me** rather than guessing further. Copy the exact error text or take a screenshot. That's always faster to fix than trying to work around it blind.
