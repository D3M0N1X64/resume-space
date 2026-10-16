# Ashton Lee: Résumé

**Live site: https://d3m0n1x64.github.io/resume-space/**

A mission-control themed résumé for Ashton Lee, network administrator at Alabama Goodwill Industries. It covers my experience, skills, education and accolades, with a way to get in touch.

## Features

- Hero scene built from NASA public-domain photography: Apollo 11's Earthrise with Hubble drifting overhead
- Dark mode by default, plus a light mode with a sunrise sky
- Telemetry-style summary panel with a live UTC clock
- Responsive layout for phones, and a print style that turns the page into a plain paper résumé
- Small interactive terminal

## Built with

Plain HTML, CSS and JavaScript. No frameworks and no build step. Hosted on GitHub Pages.

```
index.html      page content
css/style.css   styles, themes and print layout
js/main.js      starfield, photo framing, clock, terminal and theme toggle
images/         NASA photos and cutouts
```

To run it locally, open `index.html` in a browser. Light mode's sky mask needs a local web server, because browsers block CSS masks on `file://` pages.

## Credits

Photos: NASA (Apollo 11 AS11-44-6552, Apollo 17 Blue Marble, STS-125 Hubble release), public domain.
