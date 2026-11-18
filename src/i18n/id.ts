import type { Messages } from './en';

/**
 * Bahasa Indonesia. Casual and warm: "kamu", never "Anda"; a light Gen Z touch that never hides
 * the meaning. Same meaning as English, not a word-for-word copy. Glossary in docs/SPEC.md §6.5.
 */
export const id = {
  'common.add': 'Tambah',
  'common.save': 'Simpan',
  'common.edit': 'Ubah',
  'common.delete': 'Hapus',
  'common.archive': 'Arsipkan',
  'common.restore': 'Pulihkan',
  'common.undo': 'Batalkan',
  'common.again': 'Lagi',
  'common.cancel': 'Batal',
  'common.close': 'Tutup',
  'common.closeMenu': 'Tutup menu',
  'common.optional': 'opsional',
  'common.today': 'Hari ini',
  'common.yesterday': 'Kemarin',
  'common.tomorrow': 'Besok',
  'common.holdOn': 'Eits, sebentar',
  'common.somethingWrong': 'Ada yang error',

  'tabs.home': 'Beranda',
  'tabs.charts': 'Grafik',
  'screen.settings': 'Pengaturan',

  'period.word.month': 'bulan',
  'period.word.period': 'periode',
  'period.change': 'Ganti {period}',
  'period.previous': '{Period} sebelumnya',
  'period.next': '{Period} berikutnya',
  'period.backToCurrent': 'Balik ke {period} ini',
  'calendar.previousMonth': 'Bulan sebelumnya',
  'calendar.nextMonth': 'Bulan berikutnya',
  'calendar.previousYear': 'Tahun sebelumnya',
  'calendar.nextYear': 'Tahun berikutnya',
  'calendar.previousWeek': 'Minggu sebelumnya',
  'calendar.nextWeek': 'Minggu berikutnya',
  'calendar.goToDate': 'Lompat ke tanggal',

  'home.spentThis.month': 'Keluar bulan ini',
  'home.spentThis.period': 'Keluar periode ini',
  'home.empty.title.month': 'Bulan ini kamu belum jajan',
  'home.empty.title.period': 'Periode ini kamu belum jajan',
  'home.empty.body': 'Semua yang kamu catat muncul di sini, dikelompokkan per hari.',
  'home.empty.action': 'Catat yang pertama',
  'home.settings': 'Pengaturan',
  'home.loadError': 'Data kamu gagal dimuat: {message}',

  'charts.empty.title': 'Grafiknya masih kosong',
  'charts.empty.body': 'Catat beberapa pengeluaran, nanti di sini kelihatan uangmu larinya ke mana.',

  'amounts.show': 'Tampilkan nominal',
  'amounts.hide': 'Sembunyikan nominal',
  'amounts.hidden': 'disembunyikan',

  'list.reorder': 'Ubah urutan',
  'list.reorderHint': 'Tekan lama lalu geser untuk memindahkan',

  'settings.appearance': 'Tampilan',
  'settings.theme': 'Tema',
  'settings.theme.detail': 'Atur gaya TangTu kamu',
  'settings.theme.sheetHint': 'Pilih yang paling kamu suka. TangTu bakal ingat.',
  'settings.language': 'Bahasa',
  'settings.language.detail': 'Bahasa yang dipakai aplikasi',
  'settings.language.sheetHint': 'Langsung berubah. Yang kamu ketik sendiri tetap seperti aslinya.',
  'settings.about': 'Tentang',
  'settings.version': 'Versi {version}',

  'theme.sakura': 'Cherry Blossom',
  'theme.light': 'Terang',
  'theme.dark': 'Gelap',

  'language.system': 'Ikuti HP',
  'language.system.detail': 'Sekarang {language}',
  'language.en': 'English',
  'language.id': 'Bahasa Indonesia',

  'ago.justNow': 'Barusan',
  'ago.minutes': '{n} menit lalu',
  'ago.hours': '{n} jam lalu',
  'backupAge.never': 'belum pernah',
  'backupAge.today': 'hari ini',
  'backupAge.yesterday': 'kemarin',
  'backupAge.days': '{n} hari lalu',
  'backupAge.on': '{date}',

  'count.transactions.one': '{count} transaksi',
  'count.transactions.other': '{count} transaksi',
} satisfies Messages;
