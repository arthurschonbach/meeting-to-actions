import type { CoreExtraction } from "./schema";

export const SAMPLE_TITLE = "Q3 Roadmap Sync — 2026-09-18";

export const SAMPLE_TRANSCRIPT = `Attendees: Maya (PM), Tom (Engineering), Priya (Design), Luca (Customer Success)

Maya: Thanks everyone. Goal today is to lock the Q3 scope for the onboarding redesign and decide what we're cutting.

Tom: Engineering estimate is roughly six weeks for the full guided flow. But if we drop the analytics dashboard from this release, we can probably do it in four.

Maya: Let's do that. We're shipping the guided onboarding without the analytics dashboard. I'll note that as a firm decision.

Priya: The new empty states are ready for review. I'll walk the team through them next Tuesday.

Luca: Customers keep asking about a CSV import option. I don't think we've decided on that yet.

Maya: Right, that's still open. We need to figure out whether CSV import is in scope or pushed to Q4.

Tom: I can spike the CSV importer to see how much work it is.

Maya: Great, Tom, can you have that spike done by next Friday?

Tom: Yes.

Priya: Someone needs to update the design tokens before the redesign ships, but I'm not sure who owns that.

Maya: Let's leave that for now. Also, we should probably review pricing before launch, but nobody's picked that up.

Luca: I'll draft the customer announcement once the scope is locked.

Maya: Perfect. Let's wrap up.`;

export const SAMPLE_EXTRACTION: CoreExtraction = {
  minutes: {
    title: "Q3 Roadmap Sync",
    summary:
      "Locked Q3 scope around the guided onboarding flow. Analytics dashboard cut to save two weeks; CSV import left undecided.",
    attendees: ["Maya", "Tom", "Priya", "Luca"],
  },
  decisions: [
    {
      statement: "Ship guided onboarding without the analytics dashboard.",
      context: "Saves ~2 weeks.",
    },
  ],
  open_questions: [
    {
      question: "Is CSV import in scope for Q3 or deferred to Q4?",
      context: "Customers requesting it.",
    },
    {
      question: "Who owns the design token update?",
      context: "Unassigned.",
    },
    {
      question: "Will pricing be reviewed before launch, and by whom?",
      context: "Raised, unassigned.",
    },
  ],
  action_items: [
    {
      task: "Spike the CSV importer.",
      owner: "Tom",
      owner_status: "explicit",
      due_date: "next Friday",
      due_date_status: "explicit",
    },
    {
      task: "Walk through the new empty states.",
      owner: "Priya",
      owner_status: "explicit",
      due_date: "next Tuesday",
      due_date_status: "explicit",
    },
    {
      task: "Draft the customer announcement.",
      owner: "Luca",
      owner_status: "explicit",
      due_date: null,
      due_date_status: "unknown",
    },
    {
      task: "Update the design tokens.",
      owner: null,
      owner_status: "unknown",
      due_date: null,
      due_date_status: "unknown",
    },
  ],
};
