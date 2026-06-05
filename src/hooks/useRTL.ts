import { useIsRTL } from '../constants/i18n';

/**
 * Provides RTL-aware style helpers.
 * Use `row` instead of hard-coding `'row'` for horizontal flex layouts.
 * Use `textAlign` for text alignment.
 * Use `start` / `end` for logical margin/padding (LTR-safe).
 */
export function useRTL() {
  const isRTL = useIsRTL();

  return {
    isRTL,
    /** 'row-reverse' in Arabic, 'row' otherwise */
    row: (isRTL ? 'row-reverse' : 'row') as 'row' | 'row-reverse',
    /** 'right' in Arabic, 'left' otherwise */
    textAlign: (isRTL ? 'right' : 'left') as 'right' | 'left',
    /** Logical writing direction string for Text writingDirection */
    writingDirection: (isRTL ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
    /** Horizontal padding/margin on the leading side */
    paddingStart: (v: number) => isRTL ? { paddingRight: v } : { paddingLeft: v },
    paddingEnd:   (v: number) => isRTL ? { paddingLeft: v }  : { paddingRight: v },
    marginStart:  (v: number) => isRTL ? { marginRight: v }  : { marginLeft: v },
    marginEnd:    (v: number) => isRTL ? { marginLeft: v }   : { marginRight: v },
    /** Flip a chevron/arrow icon name for RTL */
    chevronForward: (isRTL ? 'chevron-back' : 'chevron-forward') as any,
    chevronBack:    (isRTL ? 'chevron-forward' : 'chevron-back') as any,
  };
}
