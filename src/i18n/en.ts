/**
 * English — the source of truth for every string the user reads (§6.5).
 * `id.ts` must have exactly these keys (`satisfies Messages`), so a missing translation is a type error.
 *
 * - `{name}` placeholders are filled by `t(key, { name })`.
 * - Keys ending in `.one` / `.other` are plurals, read with `tp(base, count)`. Indonesian has no
 *   plural forms, so its two entries are the same.
 * - Brand lines (TangTu, Tanggal Tua, the tagline) are not here: they never change with the language.
 */
export const en = {
  // Common actions (glossary §6.5)
  'common.add': 'Add',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.delete': 'Delete',
  'common.archive': 'Archive',
  'common.restore': 'Restore',
  'common.undo': 'Undo',
  'common.again': 'Again',
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.closeMenu': 'Close menu',
  'common.optional': 'optional',
  'common.today': 'Today',
  'common.yesterday': 'Yesterday',
  'common.tomorrow': 'Tomorrow',
  'common.holdOn': 'Hold on',
  'common.somethingWrong': 'Something went wrong',

  // Navigation
  'tabs.home': 'Home',
  'tabs.charts': 'Charts',
  'screen.settings': 'Settings',

  // Periods: "month" when the start day is 1, "period" otherwise (§3)
  'period.word.month': 'month',
  'period.word.period': 'period',
  'period.change': 'Change {period}',
  'period.previous': 'Previous {period}',
  'period.next': 'Next {period}',
  'period.backToCurrent': 'Back to this {period}',
  'calendar.previousMonth': 'Previous month',
  'calendar.nextMonth': 'Next month',
  'calendar.previousYear': 'Previous year',
  'calendar.nextYear': 'Next year',
  'calendar.previousWeek': 'Previous week',
  'calendar.nextWeek': 'Next week',
  'calendar.goToDate': 'Go to date',

  // Home
  'home.spentThis.month': 'Spent this month',
  'home.spentThis.period': 'Spent this period',
  'home.empty.title.month': 'No spending yet this month',
  'home.empty.title.period': 'No spending yet this period',
  'home.empty.body': 'Every purchase you log shows up here, grouped by day.',
  'home.empty.action': 'Add the first one',
  'home.settings': 'Settings',
  'home.loadError': "Couldn't load your data: {message}",

  // Charts
  'charts.empty.title': 'Nothing to chart yet',
  'charts.empty.body': 'Log a few purchases and this page shows where your money goes.',

  // Hidden amounts (the eye)
  'amounts.show': 'Show amounts',
  'amounts.hide': 'Hide amounts',
  'amounts.hidden': 'hidden',

  // Lists
  'list.reorder': 'Reorder',
  'list.reorderHint': 'Long press and drag to move',

  // Settings
  'settings.appearance': 'Appearance',
  'settings.theme': 'Theme',
  'settings.theme.detail': 'Choose how TangTu looks',
  'settings.theme.sheetHint': 'Pick the look you like. TangTu remembers it.',
  'settings.language': 'Language',
  'settings.language.detail': 'The words in the app',
  'settings.language.sheetHint': 'Changes right away. Things you typed stay as you wrote them.',
  'settings.about': 'About',
  'settings.version': 'Version {version}',

  'theme.sakura': 'Cherry Blossom',
  'theme.light': 'Light',
  'theme.dark': 'Dark',

  'language.system': 'Follow phone',
  'language.system.detail': 'Currently {language}',
  'language.en': 'English',
  'language.id': 'Bahasa Indonesia',

  // Relative times (bell history, last backup)
  'ago.justNow': 'Just now',
  'ago.minutes': '{n} min ago',
  'ago.hours': '{n} h ago',
  'backupAge.never': 'never',
  'backupAge.today': 'today',
  'backupAge.yesterday': 'yesterday',
  'backupAge.days': '{n} days ago',
  'backupAge.on': 'on {date}',

  // Plurals
  'count.transactions.one': '{count} transaction',
  'count.transactions.other': '{count} transactions',
} as const;

export type MessageKey = keyof typeof en;
/** Every language must provide exactly the English keys. */
export type Messages = Record<MessageKey, string>;
