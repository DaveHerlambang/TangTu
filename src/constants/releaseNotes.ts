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
    version: '0.4.1',
    date: '2026-11-23',
    en: {
      summary: 'Fixes for the bell, for restoring a backup, and for error messages.',
      sections: [
        {
          heading: 'fixed',
          items: [
            'Changing the day your month starts no longer skips a month recap.',
            'The year recap shows up only once.',
            'When you spend more than you earn, the month recap says so calmly instead of showing a minus.',
            'Restoring refuses a damaged backup file instead of bringing in transactions with no date.',
            'Error messages are always in your language.',
          ],
        },
      ],
    },
    id: {
      summary: 'Perbaikan untuk bel, pemulihan backup, dan pesan error.',
      sections: [
        {
          heading: 'fixed',
          items: [
            'Mengganti tanggal mulai bulan tidak lagi membuat rekap bulanan terlewat.',
            'Rekap tahunan hanya muncul sekali.',
            'Saat pengeluaran melebihi pemasukan, rekap bulanan menyampaikannya dengan tenang, tanpa angka minus.',
            'Pemulihan menolak file backup yang rusak, bukan memasukkan transaksi tanpa tanggal.',
            'Pesan error selalu dalam bahasamu.',
          ],
        },
      ],
    },
  },
  {
    version: '0.4.0',
    date: '2026-11-23',
    en: {
      summary: 'Three new looks for TangTu: Matcha, Iced Latte and Pitch Black.',
      sections: [
        {
          heading: 'new',
          items: [
            'Matcha: a calm green theme.',
            'Iced Latte: warm cream and coffee.',
            'Pitch Black: true black, easy on the eyes at night and on the battery of most phones.',
            'Pick one in Settings → Theme.',
          ],
        },
        {
          heading: 'improved',
          items: ['Light theme: what you spend is now blue, so it stands apart from your income in green.'],
        },
      ],
    },
    id: {
      summary: 'Tiga tampilan baru untuk TangTu: Matcha, Kopi Susu, dan Hitam Pekat.',
      sections: [
        {
          heading: 'new',
          items: [
            'Matcha: tema hijau yang menenangkan.',
            'Kopi Susu: krem hangat dan cokelat kopi.',
            'Hitam Pekat: hitam pekat, nyaman di mata saat malam dan hemat baterai di kebanyakan HP.',
            'Pilih di Pengaturan → Tema.',
          ],
        },
        {
          heading: 'improved',
          items: ['Tema Terang: pengeluaran sekarang berwarna biru, jadi beda jelas dengan pemasukan yang hijau.'],
        },
      ],
    },
  },
  {
    version: '0.3.0',
    date: '2026-11-22',
    en: {
      summary: 'Income sits next to spending on Home, search is right there, and the bell tells you more.',
      sections: [
        {
          heading: 'new',
          items: [
            'Search right on Home: type a note or a category and the list changes as you type. Pick this month, last month, 3 months, all time or your own dates.',
            'Tanggal tua: in the last week of your month, the bell tells you what is left and about how much you can spend a day.',
            'Your year in TangTu: early in the new year, a look back at what you spent and earned.',
          ],
        },
        {
          heading: 'improved',
          items: [
            'Home shows what you spent and what came in side by side. What is left appears once you log income.',
            'The month recap now shows your biggest purchase and which categories were higher or lower than usual.',
          ],
        },
      ],
    },
    id: {
      summary: 'Pemasukan sejajar dengan pengeluaran di Beranda, cari transaksi langsung di sana, dan bel punya lebih banyak cerita.',
      sections: [
        {
          heading: 'new',
          items: [
            'Cari langsung di Beranda: ketik catatan atau kategori, daftarnya berubah sambil kamu mengetik. Pilih bulan ini, bulan lalu, 3 bulan, semua, atau tanggal pilihanmu.',
            'Tanggal tua: di minggu terakhir bulanmu, bel memberi tahu sisa uangmu dan kira-kira berapa yang bisa dipakai per hari.',
            'Setahun kamu di TangTu: di awal tahun baru, kilas balik pengeluaran dan pemasukanmu.',
          ],
        },
        {
          heading: 'improved',
          items: [
            'Beranda menampilkan pengeluaran dan pemasukan berdampingan. Sisa muncul setelah kamu mencatat pemasukan.',
            'Rekap bulanan sekarang menunjukkan belanja terbesar dan kategori yang lebih tinggi atau lebih rendah dari biasanya.',
          ],
        },
      ],
    },
  },
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
