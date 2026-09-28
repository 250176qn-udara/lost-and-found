# Lost & Found

A front-end prototype (HTML, CSS, JavaScript) of a Lost & Found system for organizations such as schools, companies and stores.
Team: Cyber6 (graduation project).

## Run it

Open `index.html` in a browser. No server or build step is needed.
With Laragon or XAMPP, put the folder in `www` / `htdocs` and open it from `localhost`.

## What it shows

Use the role buttons at the top to switch views.

| Role | Pages |
|---|---|
| Member | My page, Report an item, Found items (claim form), Send thanks |
| Staff | Work queue, Scan item, Register found item, Verify claims (ID check at handover) |
| Org admin | Dashboard, Report an item, Register found item, Scan item, Users, Settings |
| Super admin | Organizations |

Rules built into the flow:

- Items must be handed to the office. Staff and admins can also register found items.
- An item is returned only after staff check the owner's ID at the office.
- Thank-you messages and gifts are voluntary and come from the owner.
- English and Japanese: use the globe button in the header.

## Files

```
index.html       page shell
css/style.css    all styles
js/app.js        mock data, views, translations (search "const J" to edit Japanese text)
```

## Notes

- All data is mock data in `js/app.js`. Nothing is saved.
- The QR code image is only a visual mock. Scan item works by typing an ID (try `LF-2026-0148`).

## Next steps

PHP + MySQL backend, real login and roles, saving data, matching, notifications.
