import type { WorkflowType } from "@/types/database";

export type DefaultAssignee = "employee" | "manager" | "admin";

export type TaskTemplate = {
  title: string;
  description: string;
  // Relative to the workflow's target_date (start date for onboarding, last
  // working day for offboarding) — negative days run before it.
  dayOffset: number;
  defaultAssignee: DefaultAssignee;
};

// Standard hibob-style checklists (spec: "Structured new-hire onboarding and
// offboarding checklists/tasks with assignees, due dates, and progress
// tracking"). Admin can seed a new workflow from these, then add/edit/remove
// tasks freely — this is a starting point, not a locked template system.
const ONBOARDING_TEMPLATE: TaskTemplate[] = [
  {
    title: "Send offer letter & welcome packet",
    description: "Signed offer, benefits overview, and first-day logistics.",
    dayOffset: -7,
    defaultAssignee: "admin",
  },
  {
    title: "Order equipment & provision accounts",
    description: "Laptop, badge, email, and core system accounts.",
    dayOffset: -3,
    defaultAssignee: "admin",
  },
  {
    title: "Complete new-hire paperwork",
    description: "Tax forms, ID verification, and bank details.",
    dayOffset: 0,
    defaultAssignee: "employee",
  },
  {
    title: "Welcome meeting with manager",
    description: "Introductions, role expectations, and first-week plan.",
    dayOffset: 0,
    defaultAssignee: "manager",
  },
  {
    title: "Company & culture orientation",
    description: "Company history, values, and policies walkthrough.",
    dayOffset: 1,
    defaultAssignee: "admin",
  },
  {
    title: "Meet the team",
    description: "Introductions to direct teammates and key stakeholders.",
    dayOffset: 3,
    defaultAssignee: "manager",
  },
  {
    title: "Set 30/60/90-day goals",
    description: "Agree on early milestones with the new hire's manager.",
    dayOffset: 7,
    defaultAssignee: "manager",
  },
  {
    title: "30-day check-in",
    description: "Review progress against early goals and gather feedback.",
    dayOffset: 30,
    defaultAssignee: "manager",
  },
  {
    title: "90-day performance review",
    description: "Formal review of ramp-up and probation period.",
    dayOffset: 90,
    defaultAssignee: "manager",
  },
];

const OFFBOARDING_TEMPLATE: TaskTemplate[] = [
  {
    title: "Confirm last working day & notify HR",
    description: "Log the departure date and reason with HR/admin.",
    dayOffset: -14,
    defaultAssignee: "admin",
  },
  {
    title: "Plan knowledge transfer",
    description: "Identify open work, owners, and handover documentation.",
    dayOffset: -7,
    defaultAssignee: "manager",
  },
  {
    title: "Schedule exit interview",
    description: "Book time to gather departure feedback.",
    dayOffset: -3,
    defaultAssignee: "admin",
  },
  {
    title: "Transfer ownership of files & projects",
    description: "Reassign active work items and shared documents.",
    dayOffset: -2,
    defaultAssignee: "manager",
  },
  {
    title: "Conduct exit interview",
    description: "Capture feedback on the employee's experience.",
    dayOffset: 0,
    defaultAssignee: "manager",
  },
  {
    title: "Return company equipment",
    description: "Laptop, badge, and any other company property.",
    dayOffset: 0,
    defaultAssignee: "employee",
  },
  {
    title: "Revoke system access & accounts",
    description: "Disable email, SSO, and internal system access.",
    dayOffset: 0,
    defaultAssignee: "admin",
  },
  {
    title: "Process final paycheck & benefits paperwork",
    description: "Final pay, unused leave payout, and benefits end date.",
    dayOffset: 1,
    defaultAssignee: "admin",
  },
  {
    title: "Remove from directory & distribution lists",
    description: "Update org chart, team lists, and shared calendars.",
    dayOffset: 1,
    defaultAssignee: "admin",
  },
];

export function templateFor(workflowType: WorkflowType): TaskTemplate[] {
  return workflowType === "onboarding" ? ONBOARDING_TEMPLATE : OFFBOARDING_TEMPLATE;
}

/** Adds `dayOffset` days to an ISO `YYYY-MM-DD` date, in UTC calendar days. */
export function addDaysISO(dateISO: string, dayOffset: number): string {
  const date = new Date(`${dateISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dayOffset);
  return date.toISOString().slice(0, 10);
}
