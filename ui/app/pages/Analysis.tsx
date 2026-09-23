import React, { useState } from 'react';
import { NamespaceCardsSection } from '../sections/analysis/NamespaceCardsSection';
import { ServiceComparisonSection } from '../sections/analysis/ServiceComparisonSection';
export function Analysis() {
  const [selectedNamespace, setSelectedNamespace] = useState<string | null>(null);

  return (
    <div className="page">
      {selectedNamespace === null ? (
        <>
          <NamespaceCardsSection onSelect={setSelectedNamespace} />
        </>
      ) : (
        <ServiceComparisonSection
          namespace={selectedNamespace}
          onBack={() => setSelectedNamespace(null)}
        />
      )}
    </div>
  );
}
