/**
 * Business-rule violations that are safe to show to the user. They carry a code (and params), not a
 * sentence: the screen turns `error.<code>` into text in the current language (§6.5).
 */
export type DomainErrorCode =
  | 'category.nameEmpty'
  | 'category.nameTaken'
  | 'category.notFound'
  | 'category.inUse'
  | 'transaction.amount'
  | 'transaction.category'
  | 'transaction.notFound'
  | 'backup.notApp'
  | 'backup.newer'
  | 'backup.damaged'
  | 'backup.empty'
  | 'backup.noSharing'
  | 'backup.safetyCopy'
  | 'backup.nothingToUndo';

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly params: Record<string, string | number>;

  constructor(code: DomainErrorCode, params: Record<string, string | number> = {}) {
    super(code);
    this.name = 'DomainError';
    this.code = code;
    this.params = params;
  }
}
