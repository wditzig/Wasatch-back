# Accessibility conformance tracker

Target: **WCAG 2.2 Level AA** (which includes everything in WCAG 2.1 AA, the standard named in
the ADA Title II web rule).

**This is not an Accessibility Conformance Report (VPAT) and makes no conformance claim.** An
ACR requires manual and assistive-technology testing of every criterion, ideally by an
independent auditor. This tracker records what has actually been verified so far, so that
testing can be planned and nothing is assumed.

## Scope

| Surface                       | Pages                                                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Resident website (`city-web`) | City picker, home, services, report a problem (including error state), track a request, request status (with photos), departments, content pages, accessibility, privacy |
| Staff dashboard (`staff`)     | Sign-in, dashboard, request list and detail, notifications, audit log, website content, administration                                                                   |

## How each layer is verified

| Method                                                                      | Covers                                                                                                                                                                                                                            | Status                                              |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Automated axe-core scan (WCAG 2.0/2.1/2.2 A and AA rule sets) in CI         | Roughly a third to half of failure types: names, roles, contrast of text, labels, landmarks, duplicate ids                                                                                                                        | **Passing** on every listed page                    |
| Automated keyboard and reflow checks                                        | Skip link, radio group operation, no horizontal scroll at 360 px                                                                                                                                                                  | **Passing** for the report flow and three key pages |
| Component-level design rules                                                | Visible focus on everything; status never by colour alone; labels, hints and errors programmatically tied to inputs; error summary receives focus; 44 px primary targets; reduced-motion respected; brand colours forced to 4.5:1 | Built into `packages/ui`                            |
| Manual keyboard walkthrough of every flow                                   | Focus order, traps, operability                                                                                                                                                                                                   | **Not done**                                        |
| Screen readers (NVDA/Firefox, JAWS/Chrome, VoiceOver macOS + iOS, TalkBack) | Announcements, reading order, form errors, live regions                                                                                                                                                                           | **Not done**                                        |
| Zoom 200%/400%, text spacing, high-contrast mode                            | Reflow, clipping                                                                                                                                                                                                                  | **Not done** (360 px automated only)                |
| Cognitive / plain-language review                                           | Reading level, instructions, error wording                                                                                                                                                                                        | **Not done**                                        |
| Users with disabilities                                                     | Real-world usability                                                                                                                                                                                                              | **Not done**                                        |

## Criteria needing human judgement (cannot be passed by automation)

These are the first things to test manually; each needs a recorded result per surface.

| Criterion                                                 | Why it needs a person                        | Design intent                                                                                                                                                                                |
| --------------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1.1 Non-text content                                    | Is alt text meaningful?                      | Photos are labelled by who added them; decorative icons hidden. Resident-supplied photos have no description of their content — **known limitation**; consider an optional description field |
| 1.3.1 / 1.3.2 Info, relationships, sequence               | Does structure make sense when read aloud?   | Semantic headings, lists, tables with captions, definition lists                                                                                                                             |
| 1.4.10 / 1.4.12 Reflow, text spacing                      | Visual check at 400%                         | Fluid layouts, no fixed heights on text                                                                                                                                                      |
| 2.1.1 / 2.1.2 Keyboard, no trap                           | Every control operable                       | Native controls only; no custom widgets yet                                                                                                                                                  |
| 2.4.3 / 2.4.7 / 2.4.11 Focus order, visible, not obscured | Visual check                                 | Single focus style; no sticky overlays                                                                                                                                                       |
| 2.5.7 / 2.5.8 Dragging, target size                       | Content block reordering                     | Up/down buttons provided; no drag-only interaction                                                                                                                                           |
| 3.3.1–3.3.4 Errors                                        | Are messages understandable and recoverable? | Inline errors plus focused summary; input preserved                                                                                                                                          |
| 3.3.7 / 3.3.8 Redundant entry, accessible authentication  | Sign-in flow                                 | Password managers supported; no cognitive tests. Re-check when the identity provider is integrated                                                                                           |
| 4.1.3 Status messages                                     | Announced without focus change               | `role="status"` / `role="alert"` on results                                                                                                                                                  |

## Content created by cities

A city's own content can break accessibility even on an accessible platform. Built-in
safeguards: content is structured blocks (no raw HTML), headings are a block type, link text is
required, brand colours are corrected for contrast. Not yet built: alt-text requirements for
uploaded images in content, accessible document (PDF) checks, heading-order warnings.

## Before any conformance statement

1. Complete the manual methods above for every surface and record results per criterion.
2. Fix or document every failure with a remediation date.
3. Independent audit.
4. Publish an ACR (VPAT 2.x, WCAG edition) dated and versioned to the release tested.
5. Re-test on a schedule and on every significant UI change.
