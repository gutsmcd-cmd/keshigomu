export type Lang = 'ja' | 'en'
export const dict = {
  ja: {
    app: 'けしゴム', lead: '写真の中のいらない物を、なぞって消す。', toggle: 'English',
    pick: '写真を選ぶ', note: '自分で撮った写真、または使ってよい写真に使ってください。',
    hint: '消したい物を指でなぞって、「消す」を押します。',
    brush: 'ブラシ', erase: '消す', clearMask: 'なぞりを消す', undo: '戻す', redo: 'やり直し',
    save: '保存', share: '共有', other: '別の写真', compare: '元と比べる（長押し）',
    dl: 'AIモデルを準備中（初回のみ・約200MB）', dlNote: 'Wi-Fiでどうぞ。一度ダウンロードすれば、次からはオフラインで使えます。',
    loading: 'AIを起動中…', working: '消しています…', fail: 'うまくいきませんでした。もう一度お試しください。',
    noMask: 'まず消したい所をなぞってください。', saved: '保存しました',
    foot: '無料・広告なし・ログイン不要。写真はこの端末から出ません。AI: LaMa（Apache-2.0）。',
  },
  en: {
    app: 'Eraser', lead: 'Brush over things in your photos to erase them.', toggle: '日本語',
    pick: 'Choose a photo', note: 'For your own photos, or photos you have the right to edit.',
    hint: 'Paint over what you want gone, then tap “Erase”.',
    brush: 'Brush', erase: 'Erase', clearMask: 'Clear brush', undo: 'Undo', redo: 'Redo',
    save: 'Save', share: 'Share', other: 'Another photo', compare: 'Compare (hold)',
    dl: 'Getting the AI model ready (first time only, ~200 MB)', dlNote: 'Wi-Fi recommended. After this one download it works offline.',
    loading: 'Starting the AI…', working: 'Erasing…', fail: 'That didn’t work. Please try again.',
    noMask: 'First paint over the part to erase.', saved: 'Saved',
    foot: 'Free, no ads, no login. Your photos never leave this device. AI: LaMa (Apache-2.0).',
  },
} as const
export type Dict = Record<keyof (typeof dict)["ja"], string>
