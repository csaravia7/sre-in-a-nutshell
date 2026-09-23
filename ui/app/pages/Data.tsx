import React, { useState } from "react";
import { useDql } from "@dynatrace-sdk/react-hooks";

export const Data = () => {
  const initialQuery =
    "fetch logs \n| summarize count(), by:{bin(timestamp, 1m)}";

  const [editorQueryString, setEditorQueryString] =
    useState<string>(initialQuery);
  const [queryString, setQueryString] = useState<string>(initialQuery);

  const { data, error, isLoading, cancel, refetch } = useDql({
    query: queryString,
  });

  // onClickQuery function is executed when the "RUN QUERY" Button is clicked and fetches the data from Grail.
  function onClickQuery() {
    if (isLoading) {
      void cancel();
    } else {
      if (queryString !== editorQueryString) setQueryString(editorQueryString);
      else void refetch();
    }
  }

  return (
    <div className="plain-page">
      <div className="plain-panel">
        <img
          src="./assets/Dynatrace_Logo.svg"
          alt="Dynatrace Logo"
          width={150}
          height={150}
          style={{ paddingBottom: 32 }}
        ></img>
        <h2>Explore the data in your environment by using the Dynatrace Query Language</h2>
      </div>

      <div className="plain-panel">
        <p>Use a query which has time series data:</p>
        <textarea
          className="query-editor"
          value={editorQueryString}
          onChange={(event) => setEditorQueryString(event.target.value)}
          rows={8}
        />
        <div className="inline-actions">
          {error && <div className="error-state">{error.message}</div>}
          <button className="primary-button" onClick={onClickQuery}>
            {isLoading ? 'Cancel' : 'Run query'}
          </button>
        </div>

        {data?.records && (
          <div className="result-panel">
            <h3>Result preview</h3>
            <pre>{JSON.stringify(data.records.slice(0, 5), null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
