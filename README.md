# Ashton Lee: Résumé

**Live site: https://d3m0n1x64.github.io/resume-space/**

A mission-control themed résumé for Ashton Lee, network administrator at Alabama Goodwill Industries. It covers my experience, skills, education and accolades, with a way to get in touch.

This site, and the commits co-authored by Claude, were built while attending the AI Forge sessions at the GAINS conference, with Microsoft, Anthropic, OpenAI and Goodwill Keystone.

## Features

- The whole site runs inside a cockpit multi-function display (MFD): keys on all four sides of the bezel press the labels on the screen's edges for navigation, contact links, day/night mode, paging and printing
- Access screen on the same display: a green-phosphor terminal asks for a PowerShell-style `[Y] Yes [N] No` confirmation, then the display grows to fill the window and switches to the site (shown once per browser session). Answering No drops to a crew shell with the same commands as the site's terminal, and a BYPASS key goes straight in. RESET on the site brings the access screen back
- Hero scene built from NASA public-domain photography: Apollo 11's Earthrise with Hubble drifting overhead
- Dark mode by default, plus a light mode with a sunrise sky
- Telemetry-style summary panel with a live UTC clock
- Responsive layout for phones, and a print style that turns the page into a plain paper résumé
- Small interactive terminal; its `mobile` command opens `mobile.html`, a preview of the site in phone-sized frames
- Easter eggs (`js/eggs.js`), tracked by the `achievements` command. No spoilers here

## Built with

Plain HTML, CSS and JavaScript. No frameworks and no build step. Hosted on GitHub Pages.

```
index.html      page content
css/style.css   styles, themes and print layout
js/main.js      MFD frame, access screen, starfield, photo framing, clock, terminal
js/eggs.js      easter eggs and achievements
images/         NASA photos and cutouts
```

To run it locally, open `index.html` in a browser. Light mode's sky mask needs a local web server, because browsers block CSS masks on `file://` pages.

## Credits

Photos: NASA (Apollo 11 AS11-44-6552, Apollo 17 Blue Marble, STS-125 Hubble release), public domain.
