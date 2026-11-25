// Every piece of interface text in the sample app, by key.
// The app marks each element with data-s="<key>" and data-kind="<kind>", so Stet
// can find, read and later replace every string on the screen.
// Deliberately sloppy in places: this is the app Stet reviews in the demo.
// Slice 3.1 adds an `id` (Indonesian) version next to each `en`.
export const STRINGS = {
  "nav.home": { kind: "nav", en: "Home" },
  "nav.invoices": { kind: "nav", en: "Invoices" },
  "nav.settings": { kind: "nav", en: "Settings" },

  // New invoice
  "new.heading": { kind: "heading", en: "Invoice Creation Module" },
  "new.subtitle": { kind: "subtitle", en: "Unlock seamless invoicing and elevate your workflow!" },
  "new.client.label": { kind: "label", en: "Client" },
  "new.client.placeholder": { kind: "placeholder", en: "Choose a client" },
  "new.email.label": { kind: "label", en: "Customer email" },
  "new.email.placeholder": { kind: "placeholder", en: "Lorem ipsum" },
  "new.due.label": { kind: "label", en: "Due date" },
  "new.due.placeholder": { kind: "placeholder", en: "DD/MM/YYYY" },
  "new.amount.label": { kind: "label", en: "Amount" },
  "new.amount.error": { kind: "error", en: "Error: you entered an invalid amount." },
  "new.items.label": { kind: "label", en: "Line items" },
  "new.items.empty": { kind: "empty", en: "No data" },
  "new.items.add": { kind: "button", en: "Add line item" },
  "new.preview": { kind: "link", en: "Click here" },
  "new.close": { kind: "button", en: "Close" },
  "new.save": { kind: "button", en: "Save draft" },
  "new.submit": { kind: "button", en: "Submit" },

  // Invoice list
  "list.heading": { kind: "heading", en: "Invoices" },
  "list.subtitle": { kind: "subtitle", en: "Your one-stop solution for all things billing." },
  "list.search.placeholder": { kind: "placeholder", en: "Placeholder text" },
  "list.search.go": { kind: "button", en: "Go" },
  "list.new": { kind: "button", en: "Instantiate new invoice" },
  "list.col.client": { kind: "column", en: "Client" },
  "list.col.amount": { kind: "column", en: "Amount" },
  "list.col.due": { kind: "column", en: "Due date" },
  "list.col.status": { kind: "column", en: "Status" },
  "list.status.paid": { kind: "status", en: "Paid" },
  "list.status.overdue": { kind: "status", en: "Overdue" },
  "list.status.failed": { kind: "status", en: "Failed" },
  "list.row.more": { kind: "link", en: "More" },
  "list.toast": { kind: "toast", en: "Success! Your amazing changes have been saved." },
  "list.next": { kind: "button", en: "Next page" },

  // Settings
  "set.heading": { kind: "heading", en: "Configure notification preferences matrix" },
  "set.reminders.label": { kind: "label", en: "Toggle boolean: reminders" },
  "set.reminders.help": { kind: "helper", en: "Send the client a reminder 3 days before the due date." },
  "set.company.label": { kind: "label", en: "Company name" },
  "set.company.placeholder": { kind: "placeholder", en: "[Insert company name]" },
  "set.footer.label": { kind: "label", en: "Bill footer" },
  "set.footer.placeholder": { kind: "placeholder", en: "Such as bank details or a thank-you note" },
  "set.calendar.help": { kind: "helper", en: "Seamlessly integrate with your favorite tools." },
  "set.calendar.button": { kind: "button", en: "Connect calendar" },
  "set.twostep.label": { kind: "label", en: "Two-step sign-in" },
  "set.twostep.link": { kind: "link", en: "Learn more" },
  "set.save": { kind: "button", en: "Persist changes" },
  "set.danger.heading": { kind: "heading", en: "Danger zone" },
  "set.danger.help": { kind: "helper", en: "Removes every client and invoice. This can't be undone." },
  "set.danger.button": { kind: "button", en: "Do it" },
};

// Example records shown in the list. These are data, not interface text, so
// they carry no data-s key and are not reviewed. All names are made up.
export const INVOICES = [
  { client: "Studio Arunika", amount: "1,250.00", due: "02/12/2026", status: "list.status.paid" },
  { client: "Kopi Tepi Laut", amount: "480.00", due: "28/11/2026", status: "list.status.overdue" },
  { client: "Bengkel Rapi", amount: "2,900.00", due: "15/12/2026", status: "list.status.failed" },
  { client: "Toko Benang Biru", amount: "75.50", due: "20/12/2026", status: "list.status.paid" },
];
