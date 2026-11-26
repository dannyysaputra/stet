// Every piece of interface text in the sample app, by key.
// The app marks each element with data-s="<key>" and data-kind="<kind>", so Stet
// can find, read and later replace every string on the screen.
// Deliberately sloppy in places: this is the app Stet reviews in the demo.
// `id` is the Indonesian version (slice 3.1): mostly fine, with the mistakes an
// agent makes when it translates word by word. ID_PLANTED lists them.
export const STRINGS = {
  "nav.home": { kind: "nav", en: "Home", id: "Rumah" },
  "nav.invoices": { kind: "nav", en: "Invoices", id: "Faktur" },
  "nav.settings": { kind: "nav", en: "Settings", id: "Pengaturan" },

  // New invoice
  "new.heading": { kind: "heading", en: "Invoice Creation Module", id: "Modul Pembuatan Faktur" },
  "new.subtitle": { kind: "subtitle", en: "Unlock seamless invoicing and elevate your workflow!", id: "Buka kunci penagihan mulus dan tinggikan alur kerja Anda!" },
  "new.client.label": { kind: "label", en: "Client", id: "Klien" },
  "new.client.placeholder": { kind: "placeholder", en: "Choose a client", id: "Pilih klien" },
  "new.email.label": { kind: "label", en: "Customer email", id: "Email pelanggan" },
  "new.email.placeholder": { kind: "placeholder", en: "Lorem ipsum", id: "Lorem ipsum" },
  "new.due.label": { kind: "label", en: "Due date", id: "Tanggal karena" },
  "new.due.placeholder": { kind: "placeholder", en: "DD/MM/YYYY", id: "HH/BB/TTTT" },
  "new.amount.label": { kind: "label", en: "Amount", id: "Jumlah" },
  "new.amount.error": { kind: "error", en: "Error: you entered an invalid amount.", id: "Kesalahan: kamu memasukkan jumlah yang tidak valid." },
  "new.items.label": { kind: "label", en: "Line items", id: "Item baris" },
  "new.items.empty": { kind: "empty", en: "No data", id: "Tidak ada data" },
  "new.items.add": { kind: "button", en: "Add line item", id: "Menambahkan rincian" },
  "new.preview": { kind: "link", en: "Click here", id: "Klik di sini" },
  "new.close": { kind: "button", en: "Close", id: "Dekat" },
  "new.save": { kind: "button", en: "Save draft", id: "Simpan draf" },
  "new.submit": { kind: "button", en: "Submit", id: "Kirim" },

  // Invoice list
  "list.heading": { kind: "heading", en: "Invoices", id: "Faktur" },
  "list.subtitle": { kind: "subtitle", en: "Your one-stop solution for all things billing.", id: "Solusi satu atap Anda untuk semua hal penagihan." },
  "list.search.placeholder": { kind: "placeholder", en: "Placeholder text", id: "Teks placeholder" },
  "list.search.go": { kind: "button", en: "Go", id: "Pergi" },
  "list.new": { kind: "button", en: "Instantiate new invoice", id: "Instansiasi faktur baru" },
  "list.col.client": { kind: "column", en: "Client", id: "Klien" },
  "list.col.amount": { kind: "column", en: "Amount", id: "Jumlah" },
  "list.col.due": { kind: "column", en: "Due date", id: "Jatuh tempo" },
  "list.col.status": { kind: "column", en: "Status", id: "Status" },
  "list.status.paid": { kind: "status", en: "Paid", id: "Lunas" },
  "list.status.overdue": { kind: "status", en: "Overdue", id: "Lewat jatuh tempo" },
  "list.status.failed": { kind: "status", en: "Failed", id: "Gagal" },
  "list.row.more": { kind: "link", en: "More", id: "Lagi" },
  "list.toast": { kind: "toast", en: "Success! Your amazing changes have been saved.", id: "Sukses! Perubahan luar biasamu telah disimpan." },
  "list.next": { kind: "button", en: "Next page", id: "Halaman berikutnya" },

  // Settings
  "set.heading": { kind: "heading", en: "Configure notification preferences matrix", id: "Konfigurasi matriks preferensi notifikasi" },
  "set.reminders.label": { kind: "label", en: "Toggle boolean: reminders", id: "Alihkan boolean: pengingat" },
  "set.reminders.help": { kind: "helper", en: "Send the client a reminder 3 days before the due date.", id: "Kirim pengingat ke klien 3 hari sebelum jatuh tempo." },
  "set.company.label": { kind: "label", en: "Company name", id: "Nama perusahaan" },
  "set.company.placeholder": { kind: "placeholder", en: "[Insert company name]", id: "[Masukkan nama perusahaan]" },
  "set.footer.label": { kind: "label", en: "Bill footer", id: "Kaki tagihan" },
  "set.footer.placeholder": { kind: "placeholder", en: "Such as bank details or a thank-you note", id: "Misalnya detail bank atau ucapan terima kasih" },
  "set.calendar.help": { kind: "helper", en: "Seamlessly integrate with your favorite tools.", id: "Terintegrasi dengan mulus dengan alat favorit Anda." },
  "set.calendar.button": { kind: "button", en: "Connect calendar", id: "Menghubungkan kalender" },
  "set.twostep.label": { kind: "label", en: "Two-step sign-in", id: "Masuk dua langkah" },
  "set.twostep.link": { kind: "link", en: "Learn more", id: "Pelajari lebih lanjut" },
  "set.save": { kind: "button", en: "Persist changes", id: "Bertahan perubahan" },
  "set.danger.heading": { kind: "heading", en: "Danger zone", id: "Zona bahaya" },
  "set.danger.help": { kind: "helper", en: "Removes every client and invoice. This can't be undone.", id: "Menghapus semua klien dan faktur. Ini tidak dapat dibatalkan." },
  "set.danger.button": { kind: "button", en: "Do it", id: "Lakukan" },
};

// The translation mistakes planted in the Indonesian version, by key, with the
// kind of problem each one is. The app speaks to its users as "Anda".
// Used to check the translation check (slice 3.2); never shown in the app.
export const ID_PLANTED = {
  "nav.home": "wrong_sense", // a house, not the start page: Beranda
  "new.close": "wrong_sense", // nearby: Tutup
  "list.search.go": "wrong_sense", // to travel: Cari
  "list.row.more": "wrong_sense", // again: Selengkapnya
  "set.save": "wrong_sense", // to endure: Simpan perubahan
  "new.due.label": "word_for_word", // "date because": Jatuh tempo
  "new.items.label": "word_for_word", // Rincian
  "set.footer.label": "word_for_word", // a bill's leg: Catatan kaki faktur
  "new.subtitle": "word_for_word", // "open the lock of smooth billing"
  "new.items.add": "wrong_verb_form", // a button: Tambahkan rincian
  "set.calendar.button": "wrong_verb_form", // a button: Hubungkan kalender
  "new.amount.error": "mixed_register", // kamu in an Anda app
  "list.toast": "mixed_register", // -mu in an Anda app
};

// Example records shown in the list. These are data, not interface text, so
// they carry no data-s key and are not reviewed. All names are made up.
export const INVOICES = [
  { client: "Studio Arunika", amount: "1,250.00", due: "02/12/2026", status: "list.status.paid" },
  { client: "Kopi Tepi Laut", amount: "480.00", due: "28/11/2026", status: "list.status.overdue" },
  { client: "Bengkel Rapi", amount: "2,900.00", due: "15/12/2026", status: "list.status.failed" },
  { client: "Toko Benang Biru", amount: "75.50", due: "20/12/2026", status: "list.status.paid" },
];
