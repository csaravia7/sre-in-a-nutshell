import React from 'react';
import { useTranslation } from '../i18n/LanguageProvider';
import type { MessageKey } from '../i18n/translations';

type ActionPillType = 'act-now' | 'watch' | 'context' | 'silent';

const labelKeyMap: Record<ActionPillType, MessageKey> = {
  'act-now': 'pill.actNow',
  'watch': 'pill.watch',
  'context': 'pill.context',
  'silent': 'pill.silent',
};

const classMap: Record<ActionPillType, string> = {
  'act-now': 'pill act',
  'watch': 'pill watch',
  'context': 'pill context',
  'silent': 'pill silent',
};

type ActionPillProps = {
  type: ActionPillType;
};

export function ActionPill({ type }: ActionPillProps) {
  const { t } = useTranslation();
  return <span className={classMap[type]}>{t(labelKeyMap[type])}</span>;
}
