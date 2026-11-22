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
