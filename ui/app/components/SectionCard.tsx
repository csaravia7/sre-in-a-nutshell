import React from 'react';
import { useTranslation } from '../i18n/LanguageProvider';

type SectionCardProps = {
  title: string;
  isLoading: boolean;
  error: Error | undefined | null;
  isEmpty: boolean;
  emptyMessage: string;
  children: React.ReactNode;
};

export function SectionCard({ title, isLoading, error, isEmpty, emptyMessage, children }: SectionCardProps) {
  const { t } = useTranslation();

  function renderBody() {
    if (isLoading) {
      return <div className="loading-state">Loading…</div>;
    }

    if (error) {
      const message = error.message ?? String(error);
      const isPermission = message.includes('403');
      return (
        <div className="error-state">
          <strong>{isPermission ? t('error.permission.title') : t('error.generic.title')}</strong>
          <div>{isPermission ? t('error.permission.desc') : message}</div>
        </div>
      );
    }

    if (isEmpty) {
      return <div className="empty-state">{emptyMessage}</div>;
    }

    return <>{children}</>;
  }

  return (
    <section className="section-card">
      <div className="section-header">
        <h3 className="section-title">{title}</h3>
      </div>
      <div className="section-body">{renderBody()}</div>
    </section>
  );
}
