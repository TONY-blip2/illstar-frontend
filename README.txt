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