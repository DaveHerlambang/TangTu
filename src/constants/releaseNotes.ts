/**
 * What's new (§10) — written for the person using the app, not for developers: features and fixes in
 * plain words, no technical details (those live in CHANGELOG.md). Both languages in every entry; the
 * page and the bell show the app's language. Indonesian says "kamu", never "Anda".
 *
 * Newest first. **Every release adds an entry** and the first entry's version must equal the app version
 * (a test checks it). Headings: new = something you can do now, improved = works differently or
 * better, fixed = something that was wrong.
 */
export type ReleaseHeading = 'new' | 'improved' | 'fixed';

export interface ReleaseText {
  /** One friendly sentence, also shown in the bell. */
  summary: string;
  sections: { heading: ReleaseHeading; items: string[] }[];
}

export interface ReleaseNotes {
  version: string;
  /** Release date, YYYY-MM-DD. */
  date: string;
  en: ReleaseText;
  id: ReleaseText;
}

export const RELEASE_NOTES: readonly ReleaseNotes[] = [
  {
    version: '0.2.0',
    date: '2026-11-22',
    en: {
      summary: 'Logging a transaction is clearer now, and everything is counted in rupiah.',
      sections: [
        {
          heading: 'improved',
          items: [
            'The add screen is laid out in the order you think: Expense or Income, then the amount in the middle, then the category.',
            'The number pad opens only when you tap the amount, so you can see the whole screen first. Tap the arrow to put it away.',
            'The day and a note now sit on one line. Press Save any time: if something is missing, TangTu shows you where.',
            'Everything is counted in rupiah, so your totals are always complete. Transactions you logged in another currency stay as they were.',
          ],
        },
      ],
    },
    id: {
      summary: 'Mencatat transaksi sekarang lebih jelas, dan semuanya dihitung dalam rupiah.',
      sections: [
        {
          heading: 'improved',
          items: [
            'Layar catat transaksi disusun sesuai urutan berpikirmu: Keluar atau Masuk, lalu nominal di tengah, lalu kategori.',
            'Tombol angka baru muncul saat kamu ketuk nominalnya, jadi kamu bisa lihat seluruh layar dulu. Ketuk panahnya untuk menyembunyikan.',
            'Tanggal dan catatan sekarang ada di satu baris. Tekan Simpan kapan saja: kalau ada yang kurang, TangTu menunjukkan bagiannya.',
            'Semua dihitung dalam rupiah, jadi totalmu selalu lengkap. Transaksi yang sudah kamu catat dengan mata uang lain tetap seperti semula.',
          ],
        },
      ],
    },
  },
  {
    version: '0.1.1',
    date: '2026-11-22',
    en: {
      summary: 'Small fixes: writing a note is easier, and a clearer name in the language setting.',
      sections: [
        {
          heading: 'improved',
          items: ['Settings → Language: "Follow phone" is now called "System default".'],
        },
        {
          heading: 'fixed',
          items: ['When you write a note on a transaction, the keyboard no longer covers the note.'],
        },
      ],
    },
    id: {
      summary: 'Perbaikan kecil: menulis catatan jadi lebih nyaman, dan nama yang lebih jelas di pengaturan bahasa.',
      sections: [
        {
          heading: 'improved',
          items: ['Pengaturan → Bahasa: "Ikuti HP" sekarang bernama "Default sistem".'],
        },
        {
          heading: 'fixed',
          items: ['Saat menulis catatan di transaksi, keyboard tidak lagi menutupi kolom catatan.'],
        },
      ],
    },
  },
  {
    version: '0.1.0',
    date: '2026-11-22',
    en: {
      summary: 'The first version of TangTu: log your spending in seconds and see where your money goes.',
      sections: [
        {
          heading: 'new',
          items: [
            'Log a purchase in a few taps: the amount on a number pad, a category, done. Income too.',
            'Your own categories, each with its own icon and colour, started from ready-made templates or from scratch.',
            'Home shows what you spent this month, your income and what is left, with every transaction grouped by day. Tap the eye to show the amounts.',
            'Charts: where your money went, how this month compares with the last ones, and how much you spent each day.',
            'Search your transactions by note or category.',
            'Choose the day your month starts, for example your payday.',
            'Back up everything to a file and restore it on a new phone. A restore can be undone for 7 days.',
            'Rupiah, dollars, euros, yen and Singapore dollars.',
            'English and Bahasa Indonesia, and three themes.',
          ],
        },
      ],
    },
    id: {
      summary: 'Versi pertama TangTu: catat pengeluaran dalam hitungan detik dan lihat uangmu lari ke mana.',
      sections: [
        {
          heading: 'new',
          items: [
            'Catat belanja cukup beberapa ketukan: jumlahnya di tombol angka, pilih kategori, beres. Pemasukan juga bisa.',
            'Kategori buatanmu sendiri, masing-masing dengan ikon dan warnanya, mulai dari template atau dari nol.',
            'Beranda menunjukkan pengeluaran bulan ini, pemasukan, dan sisanya, dengan semua transaksi dikelompokkan per hari. Ketuk ikon mata untuk menampilkan jumlahnya.',
            'Grafik: uangmu lari ke mana, bulan ini dibanding bulan-bulan sebelumnya, dan pengeluaran tiap hari.',
            'Cari transaksi lewat catatan atau kategori.',
            'Atur tanggal mulai bulanmu, misalnya tanggal gajian.',
            'Backup semua data ke file dan pulihkan di HP baru. Pemulihan bisa dibatalkan selama 7 hari.',
            'Rupiah, dolar, euro, yen, dan dolar Singapura.',
            'Bahasa Inggris dan Bahasa Indonesia, plus tiga tema.',
          ],
        },
      ],
    },
  },
];

export const latestRelease = (): ReleaseNotes => RELEASE_NOTES[0];

export const findRelease = (version: string | null | undefined): ReleaseNotes | undefined =>
  version ? RELEASE_NOTES.find((r) => r.version === version) : undefined;
