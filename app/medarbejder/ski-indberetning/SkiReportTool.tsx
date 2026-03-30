"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { runSkiReport } from "./actions";
import { initialSkiReportState, type SkiReportState } from "./state";
import styles from "./ski-report.module.css";
import type { ReportRow } from "@/lib/ski-report";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className={styles.primaryButton} type="submit" disabled={pending}>
      {pending ? "Behandler fakturaer..." : "Kør test på fakturaer"}
    </button>
  );
}

function downloadCsv(csvContent: string) {
  const blob = new Blob(["\uFEFF", csvContent], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "ski-indberetning-test.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsvValue(value: string) {
  if (/[;"\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function getMonthKeyFromIso(dateIso: string) {
  const match = dateIso.match(/^(\d{4})-(\d{2})-/);
  return match ? `${match[1]}-${match[2]}` : "ukendt";
}

function getMonthLabel(monthKey: string) {
  if (monthKey === "ukendt") {
    return "Ukendt måned";
  }

  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);

  return new Intl.DateTimeFormat("da-DK", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function buildEditableCsv(rows: ReportRow[]) {
  const delimiter = ";";
  const headers = [
    "SKIkundenr",
    "Kundenavn",
    "Adresse",
    "Varenr",
    "Varenavn",
    "Varegruppe",
    "Fakturanr",
    "Antal",
    "Enhed",
    "Linietotal",
    "Valuta",
    "Fakturadato",
    "SKIRammekontrakt",
    "SKIIndrapporteringskode",
    "Enhedspris",
    "Datoformat",
  ];

  return [
    headers.join(delimiter),
    ...rows.map((row) =>
      [
        row.ean,
        row.customerName,
        row.address,
        row.itemNumber,
        row.itemName,
        row.itemGroup,
        row.fakturaNr,
        row.quantity,
        row.unit,
        row.lineTotal,
        row.valuta,
        row.fakturaDato,
        row.skiContract,
        row.skiReportingCode,
        row.unitPrice,
        row.dateFormat,
      ]
        .map((value) => escapeCsvValue(value))
        .join(delimiter)
    ),
  ].join("\n");
}

function Summary({ state }: { state: SkiReportState }) {
  const rows = state?.rows ?? [];

  if (!rows.length) {
    return null;
  }

  const matchedCount = rows.filter((row) => row.status === "matched").length;
  const reviewCount = rows.length - matchedCount;

  return (
    <section className={styles.summaryGrid}>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Fakturaer læst</span>
        <strong className={styles.summaryValue}>{state.invoices.length}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Output-rækker</span>
        <strong className={styles.summaryValue}>{rows.length}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Matchet automatisk</span>
        <strong className={styles.summaryValue}>{matchedCount}</strong>
      </article>
      <article className={styles.summaryCard}>
        <span className={styles.summaryLabel}>Kræver review</span>
        <strong className={styles.summaryValue}>{reviewCount}</strong>
      </article>
    </section>
  );
}

type PickerGroup = {
  id: number;
  kind: "files" | "folder";
};

function FolderInput({
  className,
  name,
  onFileCountChange,
}: {
  className: string;
  name: string;
  onFileCountChange: (count: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.setAttribute("webkitdirectory", "");
  }, []);

  return (
    <input
      ref={inputRef}
      className={className}
      type="file"
      name={name}
      accept=".pdf"
      multiple
      onChange={(event) => {
        const count = Array.from(event.currentTarget.files ?? []).filter((file) =>
          file.name.toLowerCase().endsWith(".pdf")
        ).length;
        onFileCountChange(count);
      }}
    />
  );
}

function EditableResultsTable({ initialRows }: { initialRows: ReportRow[] }) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editableRows, setEditableRows] = useState(initialRows);
  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  const monthOptions = useMemo(() => {
    const grouped = new Map<string, { label: string; count: number }>();

    for (const row of editableRows) {
      const monthKey = getMonthKeyFromIso(row.dateFormat);
      const existing = grouped.get(monthKey);

      if (existing) {
        existing.count += 1;
      } else {
        grouped.set(monthKey, { label: getMonthLabel(monthKey), count: 1 });
      }
    }

    return Array.from(grouped.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([value, meta]) => ({ value, ...meta }));
  }, [editableRows]);

  const visibleRows = useMemo(() => {
    if (selectedMonth === "all") {
      return editableRows;
    }

    return editableRows.filter((row) => getMonthKeyFromIso(row.dateFormat) === selectedMonth);
  }, [editableRows, selectedMonth]);

  const csvContent = buildEditableCsv(visibleRows);

  function updateRow(index: number, field: keyof ReportRow, value: string) {
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

  return (
    <section className={styles.card}>
      <div className={styles.sectionHeader}>
        <div>
          <h3 className={styles.cardTitle}>Resultat</h3>
          <p className={styles.helperText}>
            Vælg en måned nedenfor for kun at se og eksportere fakturaer fra den periode.
          </p>
        </div>
        <div className={styles.resultsActions}>
          <label className={styles.filterField}>
            <span className={styles.filterLabel}>Måned</span>
            <select
              className={styles.filterSelect}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            >
              <option value="all">Alle måneder</option>
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label} ({month.count})
                </option>
              ))}
            </select>
          </label>
          <button
            className={styles.secondaryButton}
            type="button"
            onClick={() => downloadCsv(csvContent)}
          >
            Eksportér {selectedMonth === "all" ? "viste rækker" : getMonthLabel(selectedMonth)}
          </button>
        </div>
      </div>
      <div className={styles.filterChips}>
        <button
          type="button"
          className={selectedMonth === "all" ? styles.filterChipActive : styles.filterChip}
          onClick={() => setSelectedMonth("all")}
        >
          Alle ({editableRows.length})
        </button>
        {monthOptions.map((month) => (
          <button
            key={month.value}
            type="button"
            className={selectedMonth === month.value ? styles.filterChipActive : styles.filterChip}
            onClick={() => setSelectedMonth(month.value)}
          >
            {month.label} ({month.count})
          </button>
        ))}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Fil</th>
              <th>Kundenavn</th>
              <th>Adresse</th>
              <th>Varenr</th>
              <th>Varenavn</th>
              <th>Antal</th>
              <th>Enhed</th>
              <th>Linietotal</th>
              <th>Handling</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => {
              const index = editableRows.findIndex(
                (candidate) =>
                  candidate.sourceFileName === row.sourceFileName &&
                  candidate.itemNumber === row.itemNumber &&
                  candidate.fakturaNr === row.fakturaNr &&
                  candidate.lineTotal === row.lineTotal
              );
              const rowId = `${row.sourceFileName}-${row.itemNumber}-${index}`;
              const isEditing = editingRowId === rowId;

              return (
                <tr key={rowId}>
                  <td>
                    <span
                      className={
                        row.status === "matched" ? styles.statusMatched : styles.statusReview
                      }
                    >
                      {row.status === "matched" ? "Match" : "Review"}
                    </span>
                  </td>
                  <td>{row.sourceFileName}</td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.customerName}
                        onChange={(event) => updateRow(index, "customerName", event.target.value)}
                      />
                    ) : (
                      row.customerName
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.address}
                        onChange={(event) => updateRow(index, "address", event.target.value)}
                      />
                    ) : (
                      row.address
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.itemNumber}
                        onChange={(event) => updateRow(index, "itemNumber", event.target.value)}
                      />
                    ) : (
                      row.itemNumber
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.itemName}
                        onChange={(event) => updateRow(index, "itemName", event.target.value)}
                      />
                    ) : (
                      row.itemName
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.quantity}
                        onChange={(event) => updateRow(index, "quantity", event.target.value)}
                      />
                    ) : (
                      row.quantity
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <select
                        className={styles.tableInput}
                        value={row.unit}
                        onChange={(event) => updateRow(index, "unit", event.target.value)}
                      >
                        <option value="ton">ton</option>
                        <option value="Palle(r)">Palle(r)</option>
                      </select>
                    ) : (
                      row.unit
                    )}
                  </td>
                  <td>
                    {isEditing ? (
                      <input
                        className={styles.tableInput}
                        value={row.lineTotal}
                        onChange={(event) => updateRow(index, "lineTotal", event.target.value)}
                      />
                    ) : (
                      row.lineTotal
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => setEditingRowId(isEditing ? null : rowId)}
                    >
                      {isEditing ? "Gem" : "Redigér"}
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

export default function SkiReportTool() {
  const [rawState, formAction] = useActionState(runSkiReport, initialSkiReportState);
  const [pickerGroups, setPickerGroups] = useState<PickerGroup[]>([
    { id: 1, kind: "files" },
  ]);
  const [pickerCounts, setPickerCounts] = useState<Record<number, number>>({});
  const state: SkiReportState = {
    ...initialSkiReportState,
    ...(rawState ?? {}),
    invoices: rawState?.invoices ?? initialSkiReportState.invoices,
    metadataCacheJson: rawState?.metadataCacheJson ?? initialSkiReportState.metadataCacheJson,
    metadataDebug: rawState?.metadataDebug ?? initialSkiReportState.metadataDebug,
    metadataSourceLabel:
      rawState?.metadataSourceLabel ?? initialSkiReportState.metadataSourceLabel,
    metadataSourceType:
      rawState?.metadataSourceType ?? initialSkiReportState.metadataSourceType,
    rows: rawState?.rows ?? initialSkiReportState.rows,
  };
  const rows = state?.rows ?? [];
  const error = state?.error ?? "";
  const rowsSignature = rows
    .map((row) => `${row.sourceFileName}-${row.itemNumber}-${row.quantity}-${row.lineTotal}`)
    .join("|");
  const totalSelected = Object.values(pickerCounts).reduce((sum, count) => sum + count, 0);

  function updatePickerCount(id: number, count: number) {
    setPickerCounts((current) => ({
      ...current,
      [id]: count,
    }));
  }

  function addPickerGroup(kind: PickerGroup["kind"]) {
    setPickerGroups((current) => [...current, { id: Date.now() + current.length, kind }]);
  }

  return (
    <div className={styles.stack}>
      <section className={styles.card}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.eyebrow}>SKI indberetning</p>
            <h2 className={styles.title}>Upload metadata og fakturaer</h2>
          </div>
        </div>

        <p className={styles.lead}>
          Importér PDF&apos;er direkte fra en mappe og lad værktøjet gruppere dem
          efter fakturadato. Herefter kan du filtrere på fx marts 2026 og
          eksportere kun den måned som CSV.
        </p>

        <form action={formAction} className={styles.form}>
          <div className={styles.pickerStack}>
            {pickerGroups.map((group, pickerIndex) => (
              <label key={group.id} className={styles.field}>
                <span className={styles.label}>
                  {group.kind === "files"
                    ? `Fakturaer (.pdf, flere filer er tilladt) ${pickerIndex + 1}`
                    : `Mappe med PDF-fakturaer ${pickerIndex + 1}`}
                </span>
                {group.kind === "folder" ? (
                  <FolderInput
                    className={styles.input}
                    name="invoices"
                    onFileCountChange={(count) => updatePickerCount(group.id, count)}
                  />
                ) : (
                  <input
                    className={styles.input}
                    type="file"
                    name="invoices"
                    accept=".pdf"
                    multiple
                    onChange={(event) => {
                      updatePickerCount(group.id, event.currentTarget.files?.length ?? 0);
                    }}
                  />
                )}
                {pickerCounts[group.id] ? (
                  <span className={styles.helperText}>
                    Valgte PDF-filer: <strong>{pickerCounts[group.id]}</strong>
                  </span>
                ) : null}
              </label>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => addPickerGroup("files")}
            >
              Tilføj flere filer
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={() => addPickerGroup("folder")}
            >
              Tilføj en mappe mere
            </button>
          </div>
          <span className={styles.helperText}>
            Du kan nu vælge filer og mapper ad flere omgange. Alle valgte PDF&apos;er sendes med i
            samme kørsel.
          </span>
          {totalSelected ? (
            <span className={styles.helperText}>
              Valgte PDF-filer i alt: <strong>{totalSelected}</strong>
            </span>
          ) : null}

          <div className={styles.actions}>
            <SubmitButton />
          </div>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}
        {state.metadataDebug ? (
          <p className={styles.debugText}>Server-debug: {state.metadataDebug}</p>
        ) : null}
      </section>

      <Summary state={state} />

      {rows.length ? (
        <EditableResultsTable key={rowsSignature} initialRows={rows} />
      ) : null}
    </div>
  );
}
