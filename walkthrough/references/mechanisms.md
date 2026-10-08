# The mechanisms, and the bug each one prevents

Each was added to the walk it was generalised from after a real failure in a watched run. Keep them
when adapting the templates; when one is removed, the bug it names comes back.

## Watching

**The gate on the first touch** (`controls.ts` `gateTheNextTouch`). A step starts as soon as it is
announced; its first touch draws the ring and waits there for Next. So the navigation to the step's
screen happens while Next stands, and the watcher sees *what is about to be touched* before pressing.
A step is code, so its first control is only known when the step reaches it — this is the only way to
show it in advance. A step that touches nothing waits for the same Next when it ends.

**Scroll the section, then the control** (`drawTheRing`). The section around the control is centred
first, then the control if it is still outside the window — the watcher sees where on the screen the
control is, not a control alone at the window's edge.

**The ring holds and follows.** `ringHoldMs` (600) before the control changes, so the eye arrives first.
The ring is re-measured every frame while the element or a box around it animates, so it lands where a
sliding panel stops, and it disappears when the element leaves the page instead of framing nothing.

**The window fits the screen.** Headed, the browser opens maximized and the page has no fixed viewport.
A fixed 1600×1000 page in a smaller, display-scaled window put the strip with Next below the window's
edge — the walk waited for a button nobody could see.

**The strip is whole while Next waits.** It fades to 0.1 while the walk acts and is opaque while it
waits. A fade driven by hover alone left it at 0.1 after every step: the walk's own clicks moved the
mouse onto the app, and a navigation rebuilt the overlay with no hover state.

**Text selectable, buttons in their own row.** The strip ignores the pointer while the walk acts (a click
at a control's coordinates must reach the control); while Next waits it takes the pointer so its text
can be selected and copied. The buttons stand in one centred row under the text — inline at the end
of a caption they wrapped and misaligned.

**Which wait it is.** "Before step N/M", "After step N/M — done ✓ / failed", "Change of user". Without
it the three waits (before a step, after it, the change of person) looked alike. M is counted from the
numbered steps at start, so a step added or removed changes it by itself. Numbers must rise in walk
order — a step that ran before its own number was a numbering bug the runner now refuses.

**Continue automatically needs a second press within 3 s**, so the switch to auto is deliberate, not a
stray click. **Pause is always on the strip**: drawn only on auto, as a tab on the window's edge, the watcher
could not find it ("I don't see any tab"); step by step the same place shows the mode.

**Back and Return here are navigation only.** They go to the page, unfold the sections and draw the ring
— they never press, type or sign out. A place on another person's screen says "cannot — it may be under
another user" instead of signing out. A control inside something an earlier press opened (a menu, a
dialog) cannot be reached by address; Return here then runs the step again from its start — safe
because the walk stops only before a step's first touch, so the step has written nothing yet. A Next
pressed while the screen stands elsewhere returns there first.

**The steps list any time**, current step marked, read only. Choosing a step mid-walk would skip steps
whose writes the next step needs.

**Fold to a tab.** The strip covers the bottom of the page; folded, the page under it can be clicked, and
the tab says the walk still waits.

## Correctness

**The start step runs the earlier steps for real.** The chosen step needs the state the steps before it
leave (a record created, a status moved). They run by themselves, unannounced, then every Next waits.

**Wait on state, never on sleep.** A sleep long enough on a fast machine is too short on a slow one, and
too long everywhere. Waits name what they wait for and carry a ceiling.

**Races stop their losers** (`outcomes.ts`). A Playwright wait takes no abort signal: the losing branch
of a race ran on and logged "Timeout 60000ms exceeded" a minute after the race had settled, read as a
second failure in a passing walk. Losers taken through `untilRaceEnds` stop within a second of the
verdict; a loser that fails after it is logged by name as the losing branch, never dropped.

**Scope every read to this action — the four-second toast.** A status move's confirmation was also a
bubble that stayed four seconds across in-app navigation and carried the same "recorded" attribute. In
a fast run the check for step 22's move read step 20's bubble and passed on the wrong evidence. Read
inside the window or row this action opened, and match the outcome by what it names (the target), not
by its presence on the page.

**Match what the requirement means.** A check for a retired word matched it as a substring and failed on
seeded text that contained it inside a longer word. A check is only as good as its matcher: whole words
for wording, attributes for state.

**The clock that counted the wait for Next.** A "filter answers within 2 s" check took its start time,
then made the step's first touch — which waited 8.5 s for the watcher's Next — and failed a fast
filter. Start a clock after the touch returns, or `act.point` the control first. The report separates
each step's acting time from its time waiting for a person for the same reason.

**Visible and enabled before acting.** A disabled control is a named error, never a forced click.

**Signed in as the right person.** After every sign-in, who the app says is in is compared with the
person's username; a mismatch ends the walk — every step after it would act as the wrong person.

**Quiet before the walk navigates.** Leaving a page with a request open aborts it, and the abort is a
failed request — a browser error the walk caused itself. Before `step.goto` and Back the walk waits until
no request is in flight (ceiling 15 s, by name). An app that keeps a stream open (SSE, long poll) must
have that URL excluded in `BrowserErrors.quiet`, said in the brief.

## Reporting

**Four browser listeners, zero errors.** Console errors, uncaught errors, failed requests and 4xx/5xx
from the app's origins, attached before the first navigation. Each is logged with its step; the walk
ends after the step it happened in; the exit code is 1. A refusal the scenario expects is declared by
the step (`expectAnswer`) and matched once — an expected answer that never came is a FAIL.

**NOT CHECKED, with a reason.** A check the walk could not make here (the case did not come up, the page
closed before it was read) is said by name, listed in the report, and never counted as a pass.

**Requirements nobody proved.** A step lists the requirements it is written against; one that no check
named is listed in the report, so a check deleted by accident is visible.

**Scroll per step.** Every scroll of the page and its scrolled elements, summed, shown at the step's end
and tabled in the report. A step that costs several screens of scrolling is a finding about the screen.

**The exit code is the result**, and the report is written on every path — a walk that stopped half-way
still leaves its rows, its "not reached" steps and its cleanup.

**Run id and cleanup, green or red.** Without a cleanup, a database that ran a suite a dozen times held
thousands of leftover rows, and every list screen drew them. The cleanup runs after a failed walk too;
a cleanup that fails fails the run.

## How the overlay stays out of the way

- A **closed** shadow root on a 0×0 host with no attributes: locators, text reads and
  `querySelectorAll` never see the strip, so drawing it is not a change on the app's screen.
- **Top frame only**: an iframe gets the init script too, and drew a second strip over a printed report.
- **sessionStorage** keeps the question and its answer, so a sign-out reload neither drops a standing
  Next nor forgets that it was pressed. A write that fails throws — a lost question would leave the
  runner waiting forever.
- **Written as a string**: tsx/esbuild wrap named functions in `__name(...)`, which the page does not
  have; a string reaches the page as written. Page callbacks in `page.evaluate` use no named functions,
  and the harness adds a `__name` shim for safety.
