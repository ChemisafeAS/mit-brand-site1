"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildSaltAnalysisCsv, type SaltAnalysisRow } from "@/lib/salt-analysis-shared";
import { initialSaltAnalysisState, type SaltAnalysisState } from "./state";
import styles from "./salt-analysis.module.css";

function downloadCsv(csvContent: string) {
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "saltanalyse-oversigt.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

const DANISH_MONTHS = [
  "Januar",
  "Februar",
  "Marts",
  "April",
  "Maj",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "December",
];

function parseSaltAnalysisDateParts(value: string) {
  const match = value.match(/^(\d{2})[./-](\d{2})[./-](\d{4})$/);

  if (!match) {
    return null;
  }

  const [, , month, year] = match;
  const monthNumber = Number.parseInt(month, 10);

  if (monthNumber < 1 || monthNumber > 12) {
    return null;
  }

  return {
    month: month.padStart(2, "0"),
    monthLabel: DANISH_MONTHS[monthNumber - 1],
    year,
  };
}

function normalizeRecipientFilterValue(value: string) {
  return value.trim().toLocaleLowerCase("da-DK");
}

function normalizeSearchValue(value: string) {
  return value
    .toLocaleLowerCase("da-DK")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getRecipientFilterOptions(rows: SaltAnalysisRow[]) {
  const options = new Map<string, string>();

  for (const row of rows) {
    const recipient = row.recipient.trim();

    if (!recipient) {
      continue;
    }

    const normalizedKey = normalizeRecipientFilterValue(recipient);
    const existing = options.get(normalizedKey);

    if (!existing || recipient > existing) {
      options.set(normalizedKey, recipient);
    }
  }

  return Array.from(options.entries()).sort((a, b) =>
    a[0].localeCompare(b[0], "da-DK")
  );
}

function Summary({ rows }: { rows: SaltAnalysisRow[] }) {
  if (!rows.length) {
    return null;
  }

  const readyCount = rows.filter((row) => row.status === "klar").length;
  const reviewCount = rows.length - readyCount;
  const missingWaterCount = rows.filter((row) => !row.waterContent.trim()).length;
  const missingKeyFieldsCount = rows.filter(
    (row) => !row.recipient.trim() || !row.sampleType.trim() || !row.sampleDate.trim()
  ).length;

  return (
    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Analyser i oversigten</span>
        <strong className={styles.summaryValue}>{rows.length}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Klar direkte</span>
        <strong className={styles.summaryValue}>{readyCount}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Mangler vandindhold</span>
        <strong className={styles.summaryValue}>{missingWaterCount}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Kræver tjek</span>
        <strong className={styles.summaryValue}>{Math.max(reviewCount, missingKeyFieldsCount)}</strong>
      </article>
    </section>
  );
}

function ResultsTable({
  initialRows,
  monthFilter,
  onRowsChange,
  recipientFilter,
  searchFilter,
  setGlobalError,
  setGlobalNotice,
  setMonthFilter,
  setRecipientFilter,
  setSearchFilter,
  setShowOnlyVejdirektoratet,
  showOnlyVejdirektoratet,
  setYearFilter,
  yearFilter,
}: {
  initialRows: SaltAnalysisRow[];
  monthFilter: string;
  onRowsChange: (rows: SaltAnalysisRow[]) => void;
  recipientFilter: string;
  searchFilter: string;
  setGlobalError: (message: string) => void;
  setGlobalNotice: (message: string) => void;
  setMonthFilter: (value: string) => void;
  setRecipientFilter: (value: string) => void;
  setSearchFilter: (value: string) => void;
  setShowOnlyVejdirektoratet: (value: boolean | ((current: boolean) => boolean)) => void;
  showOnlyVejdirektoratet: boolean;
  setYearFilter: (value: string) => void;
  yearFilter: string;
}) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editableRows, setEditableRows] = useState(initialRows);
  const [savingRowId, setSavingRowId] = useState<string | null>(null);

  useEffect(() => {
    setEditableRows(initialRows);
  }, [initialRows]);

  useEffect(() => {
    onRowsChange(editableRows);
  }, [editableRows, onRowsChange]);

  const monthOptions = useMemo(() => {
    return Array.from(
      new Map(
        editableRows
          .map((row) => parseSaltAnalysisDateParts(row.sampleDate))
          .filter((value): value is NonNullable<ReturnType<typeof parseSaltAnalysisDateParts>> =>
            Boolean(value)
          )
          .map((value) => [value.month, value.monthLabel] as const)
      ).entries()
    ).sort(([monthA], [monthB]) => Number(monthB) - Number(monthA));
  }, [editableRows]);

  const yearOptions = useMemo(
    () =>
      Array.from(
        new Set(
          editableRows
            .map((row) => parseSaltAnalysisDateParts(row.sampleDate)?.year ?? "")
            .filter(Boolean)
        )
      ).sort((a, b) => Number(b) - Number(a)),
    [editableRows]
  );

  const recipientOptions = useMemo(
    () => getRecipientFilterOptions(editableRows),
    [editableRows]
  );

  const visibleRows = useMemo(() => {
    return editableRows.filter((row) => {
      const parsedDate = parseSaltAnalysisDateParts(row.sampleDate);
      const matchesMonth =
        monthFilter === "alle" || (parsedDate ? parsedDate.month === monthFilter : false);
      const matchesYear =
        yearFilter === "alle" || (parsedDate ? parsedDate.year === yearFilter : false);
      const matchesRecipient =
        recipientFilter === "alle" ||
        normalizeRecipientFilterValue(row.recipient) === recipientFilter;
      const matchesVejdirektoratet =
        !showOnlyVejdirektoratet || row.recipient.toLowerCase().includes("vejdirektoratet");
      const searchHaystack = normalizeSearchValue(
        [
          row.fileName,
          row.reportNumber,
          row.recipient,
          row.deliveryNoteNumber,
          row.sampleType,
          row.waterContent,
          row.sampleDate,
        ].join(" ")
      );
      const matchesSearch =
        !searchFilter || searchHaystack.includes(normalizeSearchValue(searchFilter));

      return (
        matchesMonth &&
        matchesYear &&
        matchesRecipient &&
        matchesVejdirektoratet &&
        matchesSearch
      );
    });
  }, [editableRows, monthFilter, recipientFilter, searchFilter, showOnlyVejdirektoratet, yearFilter]);

  function updateRow(index: number, field: keyof SaltAnalysisRow, value: string) {
    setEditableRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  async function saveRow(row: SaltAnalysisRow) {
    if (!row.id) {
      setEditingRowId(null);
      return;
    }

    setSavingRowId(row.id);
    setGlobalError("");

    try {
      const response = await fetch("/api/saltanalyser", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(row),
      });
      const payload = (await response.json()) as
        | { error?: string; notice?: string; row?: SaltAnalysisRow }
        | undefined;

      if (!response.ok || !payload?.row) {
        throw new Error(payload?.error || "Saltanalysen kunne ikke gemmes.");
      }

      const savedRow = payload.row;

      setEditableRows((currentRows) =>
        currentRows.map((candidate) => (candidate.id === savedRow.id ? savedRow : candidate))
      );
      setEditingRowId(null);
      setGlobalNotice(payload.notice ?? "Ændringerne er gemt.");
    } catch (error) {
      setGlobalError(
        error instanceof Error ? error.message : "Saltanalysen kunne ikke gemmes."
      );
    } finally {
      setSavingRowId(null);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.titleSmall}>Oversigt</h3>
          <p className={styles.helperText}>
            Første version læser de vigtigste felter ud automatisk. Brug
            redigering, hvis en PDF skal finjusteres manuelt.
          </p>
          <div className={styles.resultsQuickFilters}>
            <button
              type="button"
              className={showOnlyVejdirektoratet ? styles.filterChipActive : styles.filterChip}
              onClick={() => setShowOnlyVejdirektoratet((current) => !current)}
            >
              Vejdirektoratet
            </button>
          </div>
        </div>
        <div className={styles.resultsActions}>
          <label className={`${styles.filterField} ${styles.searchField}`}>
            <span className={styles.filterLabel}>Søg</span>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Rapportnr., modtager, følgeseddel..."
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
            />
          </label>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Måned</span>
            <select
              className={styles.filterSelect}
              value={monthFilter}
              onChange={(event) => setMonthFilter(event.target.value)}
            >
              <option value="alle">Alle</option>
              {monthOptions.map(([monthValue, monthLabel]) => (
                <option key={monthValue} value={monthValue}>
                  {monthLabel}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>År</span>
            <select
              className={styles.filterSelect}
              value={yearFilter}
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="alle">Alle</option>
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className={`${styles.filterField} ${styles.recipientField}`}>
            <span className={styles.filterLabel}>Til</span>
            <select
              className={styles.filterSelect}
              value={recipientFilter}
              onChange={(event) => setRecipientFilter(event.target.value)}
            >
              <option value="alle">Alle</option>
              {recipientOptions.map(([recipientValue, recipientLabel]) => (
                <option key={recipientValue} value={recipientValue}>
                  {recipientLabel}
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => downloadCsv(buildSaltAnalysisCsv(visibleRows))}
          >
            Eksportér viste rækker
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Fil</th>
              <th>Rapportnr.</th>
              <th>Til</th>
              <th>Følgeseddel</th>
              <th>Prøvetype</th>
              <th>Vandindhold</th>
              <th>Analysedato</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const index = editableRows.findIndex(
                (candidate) => candidate.fileName === row.fileName
              );
              const rowId = row.id ?? row.fileName;
              const isEditing = editingRowId === rowId;
              const fileUrl = row.fileUrl;

              return (
                <tr key={rowId}>
                  <td>
                    <div className={styles.fileCell}>
                      <span>{row.fileName}</span>
                      {fileUrl ? (
                        <a
                          className={styles.fileLink}
                          href={fileUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Åbn PDF
                        </a>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.reportNumber}
                        onChange={(event) => updateRow(index, "reportNumber", event.target.value)}
                      />
                    ) : (
                      row.reportNumber || "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.recipient}
                        onChange={(event) => updateRow(index, "recipient", event.target.value)}
                      />
                    ) : (
                      row.recipient || "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.deliveryNoteNumber}
                        onChange={(event) =>
                          updateRow(index, "deliveryNoteNumber", event.target.value)
                        }
                      />
                    ) : (
                      row.deliveryNoteNumber || "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.sampleType}
                        onChange={(event) =>
                          updateRow(index, "sampleType", event.target.value)
                        }
                      />
                    ) : (
                      row.sampleType || "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.waterContent}
                        onChange={(event) => updateRow(index, "waterContent", event.target.value)}
                      />
                    ) : (
                      row.waterContent || "-"
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.sampleDate}
                        onChange={(event) => updateRow(index, "sampleDate", event.target.value)}
                      />
                    ) : (
                      row.sampleDate || "-"
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.iconButton}
                      disabled={savingRowId === rowId}
                      onClick={() => (isEditing ? void saveRow(row) : setEditingRowId(rowId))}
                    >
                      {savingRowId === rowId ? "Gemmer..." : isEditing ? "Gem" : "Redigér"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SaltAnalysisTool({
  initialNotice = "",
  initialRows = [],
}: {
  initialNotice?: string;
  initialRows?: SaltAnalysisRow[];
}) {
  const [rawState, setState] = useState<SaltAnalysisState>({
    ...initialSaltAnalysisState,
    notice: initialNotice,
    rows: initialRows,
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientStatus, setClientStatus] = useState("");
  const [monthFilter, setMonthFilter] = useState("alle");
  const [recipientFilter, setRecipientFilter] = useState("alle");
  const [searchFilter, setSearchFilter] = useState("");
  const [showOnlyVejdirektoratet, setShowOnlyVejdirektoratet] = useState(false);
  const [yearFilter, setYearFilter] = useState("alle");
  const state: SaltAnalysisState = {
    ...initialSaltAnalysisState,
    ...rawState,
  };
  const rows = useMemo(() => state.rows ?? [], [state.rows]);
  const rowsSignature = rows.map((row) => row.fileName).join("|");
  const handleRowsChange = useCallback((nextRows: SaltAnalysisRow[]) => {
    setState((currentState) => ({
      ...currentState,
      rows: nextRows,
    }));
  }, []);
  const handleGlobalError = useCallback((message: string) => {
    setState((currentState) => ({
      ...currentState,
      error: message,
    }));
  }, []);
  const handleGlobalNotice = useCallback((message: string) => {
    setState((currentState) => ({
      ...currentState,
      notice: message,
    }));
  }, []);
  const fileLinks = useMemo(() => {
    const links = new Map<string, string>();

    for (const file of selectedFiles) {
      if (!links.has(file.name)) {
        links.set(file.name, URL.createObjectURL(file));
      }
    }

    return links;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      for (const url of new Set(fileLinks.values())) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileLinks]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedFiles.length) {
      setState({
        ...initialSaltAnalysisState,
        error: "Upload mindst én analyse-PDF for at bygge oversigten.",
      });
      return;
    }

    setIsSubmitting(true);
    setClientStatus("Uploader analyse-PDF'er...");

    try {
      const formData = new FormData();

      for (const file of selectedFiles) {
        formData.append("analyses", file);
      }

      setClientStatus("Læser analyser...");

      const response = await fetch("/api/saltanalyser", {
        method: "POST",
        body: formData,
      });
      const nextState = (await response.json()) as SaltAnalysisState;

      setState({
        ...initialSaltAnalysisState,
        ...nextState,
      });
      setClientStatus("");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReparseStoredAnalyses() {
    setIsSubmitting(true);
    setClientStatus("Genlæser analyser med manglende felter...");
    setState((currentState) => ({
      ...currentState,
      error: "",
      notice: "",
    }));

    try {
      const response = await fetch("/api/saltanalyser/reparse", {
        method: "POST",
      });
      const nextState = (await response.json()) as SaltAnalysisState;

      setState({
        ...initialSaltAnalysisState,
        ...nextState,
      });
    } finally {
      setClientStatus("");
      setIsSubmitting(false);
    }
  }

  async function handleSyncFromFolder() {
    setIsSubmitting(true);
    setClientStatus("Synkroniserer nye analyser fra mappe...");
    setState((currentState) => ({
      ...currentState,
      error: "",
      notice: "",
    }));

    try {
      const response = await fetch("/api/saltanalyser/sync", {
        method: "POST",
      });
      const nextState = (await response.json()) as SaltAnalysisState;

      setState({
        ...initialSaltAnalysisState,
        ...nextState,
      });
    } finally {
      setClientStatus("");
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>Automatisk drift</p>
            <h2 className={styles.title}>Synkronisering og kontrol</h2>
          </div>
        </div>

        <p className={styles.lead}>
          Vælg én eller flere PDF&apos;er fra mail eller OneDrive, og få en
          første oversigt over rapportnr., kunde, følgeseddel, prøvetype,
          vandindhold og analysedato. Uploadede analyser gemmes nu i Supabase,
          så oversigten bevares mellem besøg.
        </p>

        <div className={styles.operationsLayout}>
          <div className={styles.operationsIntro}>
            <p className={styles.helperText}>
              Saltanalyser bliver nu synkroniseret automatisk fra OneDrive via
              Windows Opgavestyring. Siden bruges derfor som driftsoversigt, hvor du
              kan følge dagens sync og se hvilke analyser der stadig skal tjekkes.
            </p>
            <ul className={styles.operationsList}>
              <li>Nye PDF&apos;er læses automatisk og gemmes i Supabase.</li>
              <li>Manuel sync er kun til ekstra kontrol eller hvis du vil tvinge en frisk kørsel.</li>
              <li>Genlæsning bruges når parseren er forbedret og gamle rækker skal opdateres.</li>
            </ul>
          </div>
          <div className={styles.operationsActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSyncFromFolder()}
            >
              Synkronisér nu
            </button>
            <button
              className={styles.primaryButton}
              type="button"
              disabled={isSubmitting || !rows.length}
              onClick={() => void handleReparseStoredAnalyses()}
            >
              Genlæs problematiske analyser
            </button>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Analysefiler (.pdf)</span>
            <input
              className={styles.input}
              type="file"
              accept=".pdf"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.currentTarget.files ?? []))}
            />
            {selectedFiles.length ? (
              <span className={styles.helperText}>
                Valgte analyse-PDF&apos;er: <strong>{selectedFiles.length}</strong>
              </span>
            ) : null}
          </label>

          {clientStatus ? <span className={styles.helperText}>{clientStatus}</span> : null}

          <div className={styles.actions}>
            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Læser analyser..." : "Tilføj til oversigt"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isSubmitting}
              onClick={() => void handleSyncFromFolder()}
            >
              Synkronisér mappe
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={isSubmitting || !rows.length}
              onClick={() => void handleReparseStoredAnalyses()}
            >
              Genlæs problematiske analyser
            </button>
          </div>
        </form>

        {state.error ? <p className={styles.error}>{state.error}</p> : null}
        {state.notice ? <p className={styles.helperText}>{state.notice}</p> : null}
      </section>

      <Summary rows={rows} />
      {rows.length ? (
        <ResultsTable
          key={rowsSignature}
          initialRows={rows}
          monthFilter={monthFilter}
          onRowsChange={handleRowsChange}
          recipientFilter={recipientFilter}
          searchFilter={searchFilter}
          setGlobalError={handleGlobalError}
          setGlobalNotice={handleGlobalNotice}
          setMonthFilter={setMonthFilter}
          setRecipientFilter={setRecipientFilter}
          setSearchFilter={setSearchFilter}
          setShowOnlyVejdirektoratet={setShowOnlyVejdirektoratet}
          showOnlyVejdirektoratet={showOnlyVejdirektoratet}
          setYearFilter={setYearFilter}
          yearFilter={yearFilter}
        />
      ) : null}
    </div>
  );
}
