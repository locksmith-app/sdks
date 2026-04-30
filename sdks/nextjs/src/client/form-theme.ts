import type { CSSProperties } from 'react'

/** Matches `frontend/src/app/globals.css` marketing tokens (dark steel + steel-blue accent). */
export type LocksmithFormThemeId = 'locksmith' | 'minimal'

export type LocksmithFormClassNames = {
  root?: string
  field?: string
  label?: string
  input?: string
  button?: string
  error?: string
  poweredBy?: string
}

const LOCKSMITH_VARS: Record<string, string> = {
  '--ls-bg':           'oklch(9.2% 0.008 245)',
  '--ls-bg-subtle':    'oklch(12.8% 0.009 245)',
  '--ls-bg-elevated':  'oklch(17.0% 0.009 245)',
  '--ls-border':       'oklch(22.5% 0.009 245)',
  '--ls-border-strong':'oklch(31.0% 0.009 245)',
  '--ls-text':         'oklch(93.0% 0.006 245)',
  '--ls-muted':        'oklch(64.0% 0.010 245)',
  '--ls-faint':        'oklch(43.0% 0.009 245)',
  '--ls-accent':       'oklch(64.5% 0.185 225)',
  '--ls-accent-hover': 'oklch(69.0% 0.185 225)',
  '--ls-accent-soft':  'oklch(64.5% 0.185 225 / 0.14)',
  '--ls-error':        'oklch(55% 0.22 25)',
  '--ls-error-muted':  'oklch(55% 0.22 25 / 0.12)',
  '--ls-strength-low': 'oklch(58% 0.2 25)',
  '--ls-strength-mid': 'oklch(72% 0.14 85)',
  '--ls-strength-high':'oklch(68% 0.14 155)',
  '--ls-strength-track':'oklch(28% 0.012 245)',
  '--ls-font':         `'Barlow', system-ui, sans-serif`,
  '--ls-font-display': `'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif`,
}

const MINIMAL_VARS: Record<string, string> = {
  '--ls-bg':            '#ffffff',
  '--ls-bg-subtle':     '#f9fafb',
  '--ls-bg-elevated':   '#ffffff',
  '--ls-border':        '#e5e7eb',
  '--ls-border-strong': '#d1d5db',
  '--ls-text':          '#111827',
  '--ls-muted':         '#6b7280',
  '--ls-faint':         '#9ca3af',
  '--ls-accent':        '#2563eb',
  '--ls-accent-hover':  '#1d4ed8',
  '--ls-accent-soft':   'rgba(37, 99, 235, 0.12)',
  '--ls-error':         '#dc2626',
  '--ls-error-muted':   'rgba(220, 38, 38, 0.1)',
  '--ls-strength-low':  '#ef4444',
  '--ls-strength-mid':  '#f59e0b',
  '--ls-strength-high': '#10b981',
  '--ls-strength-track':'#e5e7eb',
  '--ls-font':          'system-ui, sans-serif',
  '--ls-font-display':  'system-ui, sans-serif',
}

/** Injected once per surfaced form so `IconSpinner` animates. */
export const LOCKSMITH_FORM_KEYFRAMES_CSS = `@keyframes ls-form-spin{to{transform:rotate(360deg)}}`

export function locksmithFormThemeStyle(theme: LocksmithFormThemeId): CSSProperties {
  const vars = theme === 'locksmith' ? LOCKSMITH_VARS : MINIMAL_VARS
  return {
    ...vars,
    background:   'var(--ls-bg)',
    color:        'var(--ls-text)',
    fontFamily:   'var(--ls-font)',
    borderRadius: 12,
    padding:      24,
    boxSizing:    'border-box',
    maxWidth:     'min(100%, 28rem)',
    width:        '100%',
    border:       '1px solid var(--ls-border)',
    boxShadow:
      theme === 'locksmith'
        ? '0 0 0 1px oklch(64.5% 0.185 225 / 0.08), 0 24px 48px -32px oklch(0% 0 0 / 0.65)'
        : '0 1px 3px rgba(0,0,0,0.08)',
  } as CSSProperties
}

export const locksmithMarketingFontNote =
  'For typography that matches getlocksmith.dev, add Google Fonts Barlow (400–600) and Barlow Semi Condensed (500–700).'

export function mergeFormClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export function labelStyle(): CSSProperties {
  return {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           6,
    fontSize:      13,
    fontWeight:    500,
    color:         'var(--ls-muted)',
    fontFamily:    'var(--ls-font-display)',
    letterSpacing: '-0.01em',
  }
}

export function inputStyle(): CSSProperties {
  return {
    width:         '100%',
    boxSizing:     'border-box',
    padding:       '10px 12px',
    fontSize:      15,
    lineHeight:    1.4,
    borderRadius:  8,
    border:        '1px solid var(--ls-border-strong)',
    background:    'var(--ls-bg-elevated)',
    color:         'var(--ls-text)',
    outline:       'none',
    transition:    'border-color 0.15s ease, box-shadow 0.15s ease',
  }
}

/** Taller control (h-11) with room for left/right adornments. */
export function inputStyleLarge(paddingLeft: number, paddingRight: number): CSSProperties {
  return {
    ...inputStyle(),
    minHeight:   44,
    padding:     '0 12px',
    paddingLeft,
    paddingRight,
  }
}

export function inputIconRowStyle(): CSSProperties {
  return { position: 'relative', width: '100%' }
}

export function inputIconLeftStyle(): CSSProperties {
  return {
    position:  'absolute',
    left:      12,
    top:       '50%',
    transform: 'translateY(-50%)',
    color:     'var(--ls-faint)',
    display:   'flex',
    pointerEvents: 'none',
  }
}

export function passwordToggleStyle(): CSSProperties {
  return {
    position:      'absolute',
    right:         10,
    top:           '50%',
    transform:     'translateY(-50%)',
    padding:       6,
    border:        'none',
    background:    'transparent',
    color:         'var(--ls-faint)',
    cursor:        'pointer',
    borderRadius:  6,
    display:       'flex',
    alignItems:    'center',
    justifyContent:'center',
    transition:    'color 0.15s ease',
  }
}

export function cardHeaderStyle(): CSSProperties {
  return {
    textAlign:     'center',
    display:       'flex',
    flexDirection: 'column',
    gap:           6,
    paddingBottom: 4,
  }
}

export function cardTitleStyle(): CSSProperties {
  return {
    margin:        0,
    fontSize:      24,
    fontWeight:    700,
    fontFamily:    'var(--ls-font-display)',
    letterSpacing: '-0.02em',
    lineHeight:    1.2,
    textWrap:      'balance',
  }
}

export function cardDescriptionStyle(): CSSProperties {
  return {
    margin:        0,
    fontSize:      14,
    lineHeight:    1.45,
    color:         'var(--ls-muted)',
    textWrap:      'balance',
  }
}

export function sectionStackStyle(): CSSProperties {
  return {
    display:       'flex',
    flexDirection: 'column',
    gap:           24,
  }
}

export function formBlockStackStyle(): CSSProperties {
  return {
    display:       'flex',
    flexDirection: 'column',
    gap:           16,
  }
}

export function fieldSeparatorRowStyle(): CSSProperties {
  return {
    display:    'flex',
    alignItems: 'center',
    gap:        12,
    width:      '100%',
  }
}

export function fieldSeparatorLineStyle(): CSSProperties {
  return {
    flex:       1,
    height:     1,
    background: 'var(--ls-border-strong)',
  }
}

export function fieldSeparatorLabelStyle(): CSSProperties {
  return {
    fontSize:     12,
    fontWeight:   500,
    color:        'var(--ls-faint)',
    whiteSpace:   'nowrap',
    fontFamily:   'var(--ls-font)',
  }
}

export function linkAccentStyle(): CSSProperties {
  return {
    color:           'var(--ls-accent)',
    fontWeight:      600,
    textDecoration:  'none',
    transition:      'opacity 0.15s ease',
  }
}

export function footerLinksStyle(): CSSProperties {
  return {
    margin:     0,
    fontSize:   14,
    textAlign:  'center',
    color:      'var(--ls-muted)',
  }
}

export function outlineButtonStyle(disabled: boolean): CSSProperties {
  return {
    width:           '100%',
    boxSizing:       'border-box',
    minHeight:       44,
    padding:         '0 16px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             10,
    fontSize:        14,
    fontWeight:      600,
    fontFamily:      'var(--ls-font-display)',
    letterSpacing:   '-0.01em',
    borderRadius:    8,
    border:          '1px solid var(--ls-border-strong)',
    background:      'var(--ls-bg-elevated)',
    color:           'var(--ls-text)',
    cursor:          disabled ? 'not-allowed' : 'pointer',
    opacity:         disabled ? 0.55 : 1,
    transition:      'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
  }
}

/** Square outline control for icon-only social buttons. */
export function outlineIconButtonStyle(disabled: boolean): CSSProperties {
  return {
    ...outlineButtonStyle(disabled),
    width:    44,
    minWidth: 44,
    padding:  0,
  }
}

export function ghostButtonStyle(disabled: boolean): CSSProperties {
  return {
    width:           '100%',
    boxSizing:       'border-box',
    minHeight:       44,
    padding:         '0 16px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    fontSize:        14,
    fontWeight:      500,
    fontFamily:      'var(--ls-font)',
    borderRadius:    8,
    border:          'none',
    background:      'transparent',
    color:           'var(--ls-muted)',
    cursor:          disabled ? 'not-allowed' : 'pointer',
    opacity:         disabled ? 0.55 : 1,
  }
}

export function totpShieldCircleStyle(): CSSProperties {
  return {
    width:           56,
    height:          56,
    margin:          '0 auto',
    borderRadius:    '50%',
    background:      'var(--ls-accent-soft)',
    color:           'var(--ls-accent)',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
  }
}

export function otpSlotsRowStyle(): CSSProperties {
  return {
    display:        'flex',
    flexWrap:       'wrap',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  }
}

export function otpSlotStyle(): CSSProperties {
  return {
    width:          44,
    height:         44,
    textAlign:      'center',
    fontSize:       18,
    fontWeight:     600,
    fontFamily:     'var(--ls-font-display)',
    borderRadius:   8,
    border:         '2px solid var(--ls-border-strong)',
    background:     'var(--ls-bg-elevated)',
    color:          'var(--ls-text)',
    outline:        'none',
    boxSizing:      'border-box',
  }
}

export function otpSeparatorStyle(): CSSProperties {
  return {
    color:      'var(--ls-faint)',
    fontSize:   14,
    fontWeight: 600,
    userSelect: 'none',
  }
}

export function footnoteStyle(): CSSProperties {
  return {
    margin:     0,
    fontSize:   12,
    lineHeight: 1.45,
    textAlign:  'center',
    color:      'var(--ls-muted)',
    textWrap:   'balance',
  }
}

export function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    marginTop:       0,
    width:           '100%',
    boxSizing:       'border-box',
    minHeight:       44,
    padding:         '0 16px',
    display:         'flex',
    alignItems:      'center',
    justifyContent:  'center',
    gap:             8,
    fontSize:        15,
    fontWeight:      600,
    fontFamily:      'var(--ls-font-display)',
    letterSpacing:   '-0.01em',
    borderRadius:    8,
    border:          '1px solid transparent',
    cursor:          disabled ? 'not-allowed' : 'pointer',
    opacity:         disabled ? 0.55 : 1,
    background:      'var(--ls-accent)',
    color:           '#fff',
    boxShadow:       '0 1px 0 oklch(0% 0 0 / 0.12) inset',
    transition:      'opacity 0.15s ease, transform 0.15s ease',
  }
}

export function errorStyle(): CSSProperties {
  return {
    marginBottom:    0,
    padding:         '10px 14px',
    borderRadius:    8,
    fontSize:        13,
    lineHeight:      1.45,
    fontWeight:      500,
    color:           'var(--ls-error)',
    background:      'var(--ls-error-muted)',
    border:          '1px solid color-mix(in srgb, var(--ls-error) 28%, transparent)',
  }
}

export function fieldStackStyle(): CSSProperties {
  return {
    display:       'flex',
    flexDirection: 'column' as const,
    gap:           14,
  }
}

export function fieldLabelRowStyle(): CSSProperties {
  return {
    display:          'flex',
    alignItems:       'center',
    justifyContent:   'space-between',
    gap:              8,
    width:            '100%',
  }
}

export function forgotPasswordLinkStyle(): CSSProperties {
  return {
    fontSize:        12,
    fontWeight:      600,
    color:           'var(--ls-accent)',
    textDecoration:  'none',
    fontFamily:      'var(--ls-font)',
  }
}

export function socialGridStyle(columns: 1 | 2 | 3 | 4): CSSProperties {
  return {
    display:               'grid',
    gap:                   12,
    gridTemplateColumns:   columns === 1 ? '1fr' : `repeat(${columns}, minmax(0, 1fr))`,
  }
}

export function socialIconWrapStyle(): CSSProperties {
  return {
    display:        'flex',
    flexWrap:       'wrap',
    justifyContent: 'center',
    gap:            12,
  }
}
