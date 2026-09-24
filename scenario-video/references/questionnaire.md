# First-use questionnaire

Asked once per repository; the answers go to `.claude/scenario-video.config.json` and are reused.
Ask in one message, grouped as below. For each question, propose an answer from what the repo
shows, so the user mostly confirms. Field names are in `settings.md`.

## The app
1. How is the app started locally? (`app.startCommand`)
2. At which address is it opened in the browser? (`app.address`)
3. Which address answers 2xx when it is up — a health endpoint, or the home page? (`app.healthCheck`)
4. Does it call other addresses of its own (an api on another port)? Their 4xx/5xx answers count
   as errors during a recording. (`app.otherAddresses`)

## Signing in
5. How does a user sign in? (`signIn.method`)
   - **a form in the UI** — which page, the username and password fields, the submit button, and
     something visible once signed in;
   - **a token from an api call** — the call (address, method, body with `{username}` and
     `{password}`), where the token is in the answer, and where the app keeps it (localStorage,
     sessionStorage or a cookie, and its key);
   - **none**.
6. Which accounts appear in videos? For each: the name shown on screen, the username, and the
   environment variable that holds the password. (`people`) Passwords are never written to the file.

## Data
7. Is there a seed command that prepares data for one run, given a run id? If not, the skill helps
   write one (`references/seeding.md`). (`seed.command`, `null` for none)

## Finding controls
8. Do controls carry a test id attribute (`data-testid`, `data-test`, `data-cy`, …)? Which one?
   (`locators.testIdAttribute`) Without one, scenarios find controls by role, label and text — say
   plainly that these break when the wording changes.

## Output
9. Where do scenarios, the tools and the videos go? (`folders.scenarios`, `folders.tools`,
   `folders.output` — defaults `guide-videos`, `guide-videos/tools`, `guide-videos/output`)
10. Caption language and direction? (`captions.language` — `he` and `en` have built-in words;
    another language brings its own `captions.words`; `captions.direction` — `rtl` or `ltr`)
11. One video per person, or one film per scenario that follows everybody? And who are the
    people? (`videoShape`)
12. Branding for the title cards: a logo file, a font, colours? (`branding` — all optional; the
    default look is a dark slate card with white text)
13. Anything on screen that must not be seen — emails, phone numbers, specific fields?
    (`masking.patterns`: `email`, `phone`; `masking.fields`: CSS selectors blurred)
14. Browser window size for the recording? (`viewport`, default 1440 × 900)

---

# The videos you want — asked for every new video

The settings above are asked once. These are asked each time a video is planned, in one message,
with a proposed answer for each. The answers shape the plan and the chapters, which the user then
approves (`plans-and-chapters.md`).

## What kind of film
1. **A tour or a story?**
   - **Tour** — a walk through a screen or an area: what is there and what it is for. Nothing is
     changed; the film ends by proving it (every call was a read — `app-setup.md` §5).
   - **Story (process)** — a piece of work from start to end, across the people who do it: a
     request opened, reviewed, approved. Things change, and the film says what moved and who moved
     it.
2. **Who watches it?** A new user, an administrator, a customer, the team itself. It decides the
   words on the slides and how much is explained.
3. **One film, or one per person?** (the settings' `videoShape` is the default)

## For a tour
4. **How deep?** Only the tabs or areas · the areas, then one real item from each (the item
   pointed at, its panel opened) · every item. One item each is usually right: a viewer learns what
   an item looks like from one of them.
5. **In which order?** The order the screen draws them, or grouped by what they are for.

## For a story
6. **The steps and the people** — who does what, in which order, and where it starts from (the
   seed).
7. **What must the viewer notice** at each step — a status moving, a clock starting, something the
   system deliberately does not do by itself.

## The words
8. **The slide lines.** Two short phrases per slide: what the step or area is **for**, and **why**
   a person comes to it. The idea, not a list of what is on the screen. Written plainly, the way a
   colleague would say it — no filler, no marketing tone. Propose them; the user approves them
   before anything is recorded.
9. **Captions** — the words on each action. Built from what the viewer reads on screen; say which
   controls should be captioned differently (a card that shows initials, a checkbox, a number).
10. **Length.** A target length per film (a tour of fifteen areas with one item each is about three
    minutes). Longer films are split by area or by step.
11. **Anything to leave out** — checks a test does that a viewer should not see, repeated actions,
    areas that are not ready.
