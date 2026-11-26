# Starter wording guide

The fixed guide the laptop model checks against until Phase 2, when the cloud
model writes a guide from the user's own two-line brief. Keep it short: every
line here is sent with every check.

## Voice

- Plain, specific and calm. Say what is on this screen and what happens next.
- Address the reader as "you". Talk about the product as "we" only in messages
  where we did something ("We emailed the clinic").
- No exclamation marks, except in a real celebration the user caused.

## Problem kinds

| Kind | What it looks like | Fix |
| --- | --- | --- |
| sounds_generated | Marketing filler that could sit in any app: "unlock", "seamless", "elevate", "supercharge", "empower", "journey", "next level", "one-stop", "effortless", "harness the power". | Say what this screen does, with a concrete noun or number. |
| vague_button | "Submit", "OK", "Yes", "Go", "Confirm", "Proceed", "Continue", "Finish", "Do it" where the action is known. | Verb + object: "Send invoice", "Delete task", "Pay 120.00". |
| blames_user | Says the user made a mistake: "you entered", "you forgot", "you failed", "invalid", "illegal", "wrong". | Say how to fix it: what is allowed, with an example. |
| unclear_message | Says something failed or is empty without saying what or what to do: "No data", "Something went wrong", "Error 500", error codes. | Name what is missing or failed, then the next step. |
| jargon | System or developer words: "module", "entity", "persist", "instantiate", "payload", "token", "query", "boolean", HTTP codes. | The word the user would say. |
| leftover_text | Draft or developer text that was never replaced: "Lorem ipsum", "TODO", "Title goes here", "Button", "undefined", "[Insert ...]", "Placeholder text". | The real text. |
| vague_link | Link text that does not say where it goes: "Click here", "here", "Read more", "Learn more", "More", "Link". | The destination: "Read the refund policy". |
| inconsistent_term | One thing called two names in the same app: client/customer, delete/remove, sign in/log in. | The app's chosen word. |

## Seriousness

- high: blocks or misleads the user (placeholder text, a payment button that
  does not say it charges, an error with no way forward, filler as a page
  heading).
- medium: makes the user stop and think.
- low: polish.

## Not a problem

Short labels ("Client", "Due date"), standard links ("Forgot password?"),
plain confirmations ("Changes saved."), and specific errors that say how to
fix them are fine. Do not flag text only because it is short.

Hint text inside an empty field (the element kind "placeholder") is fine when
it shows a real example or format, such as "name@company.com", "DD/MM/YYYY",
"Such as 250.00" or "Search tasks". Only flag it when it is leftover draft
text.
