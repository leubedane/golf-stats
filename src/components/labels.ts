import type { Translate } from '../i18n/i18n';
import type { HandicapClass, Settings } from '../domain/types';

export function classLabel(cls: HandicapClass, settings: Settings, t: Translate): string {
  switch (cls.kind) {
    case 'own':
      return t('class.own', { hcp: settings.handicap });
    case 'pga':
      return t('class.pga');
    case 'handicap':
      return cls.handicap === 0 ? t('class.scratch') : t('class.hcp', { hcp: cls.handicap });
  }
}
