import { SegmentsProvider, useSegments } from "@dynatrace/strato-components/filters";
import { useCurrentTheme } from "@dynatrace/strato-components/core";
import type { FilterSegment } from "@dynatrace-sdk/client-query";
import { DqlQueryParamsProvider } from "@dynatrace-sdk/react-hooks";
import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Route, Routes } from "react-router-dom";
import { Header } from "./components/Header";
import { Today } from "./pages/Today";
import { Week } from "./pages/Week";
import { Analysis } from "./pages/Analysis";
import { LanguageProvider } from "./i18n/LanguageProvider";

const SEGMENTS_STORAGE_KEY = "sre-in-a-nutshell-segments";

function readStoredSegments(): FilterSegment[] {
  try {
    const stored = localStorage.getItem(SEGMENTS_STORAGE_KEY);
    if (stored === null) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed as FilterSegment[] : [];
  } catch {
    return [];
  }
}

const SegmentPersistence = () => {
  const { segments } = useSegments();

  useEffect(() => {
    try {
      localStorage.setItem(SEGMENTS_STORAGE_KEY, JSON.stringify(segments));
    } catch {
      // The active provider still preserves the selection for this session.
    }
  }, [segments]);

  return null;
};

const PersistentSegmentsProvider = ({ children }: { children: React.ReactNode }) => {
  const [defaultSegments] = useState<FilterSegment[]>(readStoredSegments);

  return (
    <SegmentsProvider defaultSegments={defaultSegments}>
      <SegmentPersistence />
      {children}
    </SegmentsProvider>
  );
};

const SegmentAwareContent = () => {
  const { segments } = useSegments();
  return (
    <DqlQueryParamsProvider filterSegments={segments}>
      <Routes>
        <Route path="/" element={<Navigate to="/analysis" replace />} />
        {/* today and week routes kept but not linked from nav */}
        <Route path="/today" element={<Today />} />
        <Route path="/week" element={<Week />} />
        <Route path="/analysis" element={<Analysis />} />
      </Routes>
    </DqlQueryParamsProvider>
  );
};

export const App = () => {
  const theme = useCurrentTheme();

  return (
    <LanguageProvider>
      <PersistentSegmentsProvider>
        <div className="app-shell" data-theme={theme}>
          <Header />
          <main className="page-content">
            <SegmentAwareContent />
          </main>
        </div>
      </PersistentSegmentsProvider>
    </LanguageProvider>
  );
};
