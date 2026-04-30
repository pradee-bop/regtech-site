# regtech-site

Static website for **RegTech Services** — Expert Consulting for Life Sciences & Healthcare Compliance.

## Structure

```
.
├── index.html              # Main landing page
├── assets/
│   └── css/
│       └── styles.css      # Site styles
└── README.md
```

## Deploy on Cloudflare Pages

1. Sign in to Cloudflare and go to **Workers & Pages → Create → Pages → Connect to Git**.
2. Select this repository (`pradee-bop/regtech-site`) and the `main` branch.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave blank)*
   - **Build output directory:** `/` (or leave blank — root)
4. Click **Save and Deploy**. Cloudflare will publish `index.html` from the repository root.

## Custom domain

After the first deploy:
- Go to your Pages project → **Custom domains → Set up a custom domain**.
- Add `regtechservices.team` (and `www.regtechservices.team`).
- Follow Cloudflare's DNS instructions.

## Local preview

Just open `index.html` in a browser, or run any static server, e.g.:

```bash
python3 -m http.server 8080
```

## Contact form

The contact form uses [FormSubmit](https://formsubmit.co) and sends submissions to `contact@regtechservices.team`. The first submission will trigger an activation email to confirm the recipient address.
