# Indonesian interface rules

Used by the translation check. Each Indonesian line is judged against its
English original and the kind of element it sits in. Notes for the user are
written in plain English.

## Problem kinds

| Kind | What it looks like | Example |
| --- | --- | --- |
| wrong_sense | The word picked has a different meaning of the English word. | Close: "Dekat" (nearby) should be "Tutup". Home: "Rumah" (house) should be "Beranda". |
| word_for_word | Each English word translated separately, so the phrase reads oddly or means something else. | Line items: "Item baris" should be "Rincian". Sign up: "Tanda tangan ke atas" should be "Daftar". |
| wrong_verb_form | The verb form does not suit the element. | Button "Menyimpan draf" should be "Simpan draf". Status "Simpan..." should be "Menyimpan...". |
| mixed_register | Formal and informal address mixed, or the app's chosen address not followed. | "Anda bisa ubah profilmu" mixes Anda and -mu. |

## Rules

1. Buttons and menu actions use the base verb or the command form: Simpan,
   Kirim, Hapus, Unggah, Cari, Tutup, Batalkan, Tambahkan.
2. Progress and status text uses the me- form or di- form: Menyimpan...,
   Mengunggah..., Disetujui, Menunggu persetujuan.
3. Use the app's chosen address everywhere. Formal apps use "Anda" (capital
   A) and the possessive "Anda" ("Kursus Anda"), never -mu, kamu or slang.
   Informal apps use "kamu" and -mu, never "Anda".
4. Use the set terms Indonesian apps already use:

| English | Indonesian |
| --- | --- |
| Home | Beranda |
| Settings | Pengaturan |
| Sign in / Sign out | Masuk / Keluar |
| Sign up | Daftar |
| Due date | Jatuh tempo |
| Line items | Rincian |
| Invoice | Faktur |
| Receipt | Struk |
| Upload / Download | Unggah / Unduh |
| Cancel (dismiss a dialog) | Batal |
| Cancel (an appointment) | Batalkan |
| Appointment | Janji temu |
| Password | Kata sandi |

5. Translate the meaning on this screen, not the words. Marketing filler
   should be rewritten as a plain sentence, not translated line by line.
6. Keep numbers, currency and product names as they are.

## Not a problem

Loanwords Indonesian apps commonly use ("file", "email", "draf", "klien",
"opsional") are fine. A shorter or freer translation is fine when the meaning
and the action are the same.
