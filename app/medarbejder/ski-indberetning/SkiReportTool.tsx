"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import {
  getStoragePathForInvoice,
  sanitizeStorageSegment,
  SKI_UPLOAD_BUCKET,
} from "@/lib/ski-storage";
import { processSkiReport } from "./actions";
import { initialSkiReportState, type SkiReportState } from "./state";
import styles from "./ski-report.module.css";
import type { ReportRow } from "@/lib/ski-report";

type FileWithRelativePath = File & {
  webkitRelativePath?: string;
};

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  mapper: (item: T, index: number) => Promise<R>
) {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, batchIndex) => mapper(item, index + batchIndex))
    );
    results.push(...batchResults);
  }

  return results;
}

function SubmitButton({ pending }: { pending: boolean }) {
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

function FolderInput({
  className,
  onFilesChange,
}: {
  className: string;
  onFilesChange: (files: FileWithRelativePath[]) => void;
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
      accept=".pdf"
      multiple
      onChange={(event) => {
        const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
          file.name.toLowerCase().endsWith(".pdf")
        ) as FileWithRelativePath[];
        onFilesChange(files);
      }}
    />
  );
}

function ResultsWithInvoiceLinks({
  initialRows,
  fileLinks,
}: {
  initialRows: ReportRow[];
  fileLinks: Map<string, string>;
}) {
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
              const fileUrl = fileLinks.get(row.sourceFileName);

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
                  <td>
                    <div className={styles.fileCell}>
                      <span>{row.sourceFileName}</span>
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
  const [rawState, setState] = useState<SkiReportState>(initialSkiReportState);
  const [selectedInvoiceFiles, setSelectedInvoiceFiles] = useState<FileWithRelativePath[]>([]);
  const [selectedFolderFiles, setSelectedFolderFiles] = useState<FileWithRelativePath[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientStatus, setClientStatus] = useState("");
  const state: SkiReportState = {
    ...initialSkiReportState,
    ...rawState,
  };
  const rows = state?.rows ?? [];
  const error = state?.error ?? "";
  const rowsSignature = rows
    .map((row) => `${row.sourceFileName}-${row.itemNumber}-${row.quantity}-${row.lineTotal}`)
    .join("|");
  const selectedInvoiceCount = selectedInvoiceFiles.length;
  const selectedFolderInvoiceCount = selectedFolderFiles.length;
  const totalSelected = selectedInvoiceCount + selectedFolderInvoiceCount;
  const selectedFiles = useMemo(
    () => [...selectedInvoiceFiles, ...selectedFolderFiles].filter((file) => file.name.toLowerCase().endsWith(".pdf")),
    [selectedInvoiceFiles, selectedFolderFiles]
  );
  const fileLinks = useMemo(() => {
    const links = new Map<string, string>();

    for (const file of selectedFiles) {
      const objectUrl = URL.createObjectURL(file);
      const sanitizedFileName =
        file.name
          .split("/")
          .map((segment) => sanitizeStorageSegment(segment) || "file")
          .join("/") || file.name;

      if (!links.has(file.name)) {
        links.set(file.name, objectUrl);
      }

      if (!links.has(sanitizedFileName)) {
        links.set(sanitizedFileName, objectUrl);
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
        ...initialSkiReportState,
        error: "Upload mindst én PDF-faktura for at køre testen.",
      });
      return;
    }

    setIsSubmitting(true);
    setClientStatus("Uploader PDF-filer til Supabase...");

    const supabase = createSupabaseClient();
    const uploadedPaths: string[] = [];

    try {
      const batchId = crypto.randomUUID();
      let uploadedCount = 0;

      const batchUploadedPaths = await mapInBatches(selectedFiles, 6, async (file, index) => {
        const storagePath = getStoragePathForInvoice(
          batchId,
          file.name,
          file.webkitRelativePath
        );
        setClientStatus(`Uploader ${Math.min(index + 1, selectedFiles.length)}/${selectedFiles.length}: ${file.name}`);

        const { error: uploadError } = await supabase.storage
          .from(SKI_UPLOAD_BUCKET)
          .upload(storagePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || "application/pdf",
          });

        if (uploadError) {
          throw new Error(
            `Upload til Supabase fejlede for ${file.name}. Tjek at bucketen '${SKI_UPLOAD_BUCKET}' findes, og at loggede medarbejdere må uploade til den.`
          );
        }

        uploadedCount += 1;
        setClientStatus(`Uploader ${uploadedCount}/${selectedFiles.length} PDF-filer...`);
        return storagePath;
      });
      uploadedPaths.push(...batchUploadedPaths);

      setClientStatus("Behandler fakturaer...");

      const formData = new FormData();
      formData.set("uploadedPaths", JSON.stringify(uploadedPaths));

      const nextState = await processSkiReport(formData);
      setState(nextState);
      setClientStatus("");
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(SKI_UPLOAD_BUCKET).remove(uploadedPaths);
      }

      setState({
        ...initialSkiReportState,
        error:
          error instanceof Error
            ? error.message
            : "Noget gik galt under uploaden til Supabase.",
      });
      setClientStatus("");
    } finally {
      setIsSubmitting(false);
    }
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

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>Fakturaer (.pdf, flere filer er tilladt)</span>
            <input
              className={styles.input}
              type="file"
              accept=".pdf"
              multiple
              onChange={(event) => {
                setSelectedInvoiceFiles(Array.from(event.currentTarget.files ?? []) as FileWithRelativePath[]);
              }}
            />
            {selectedInvoiceCount ? (
              <span className={styles.helperText}>
                Valgte PDF-filer til næste kørsel: <strong>{selectedInvoiceCount}</strong>
              </span>
            ) : null}
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Eller vælg en hel mappe med PDF&apos;er</span>
            <FolderInput
              className={styles.input}
              onFilesChange={setSelectedFolderFiles}
            />
            {selectedFolderInvoiceCount ? (
              <span className={styles.helperText}>
                Valgte PDF-filer fra mappe: <strong>{selectedFolderInvoiceCount}</strong>
              </span>
            ) : null}
          </label>
          <span className={styles.helperText}>
            Brug enten enkeltfiler eller en hel mappe fra OneDrive/Finder i én kørsel.
          </span>
          {totalSelected ? (
            <span className={styles.helperText}>
              Valgte PDF-filer i alt: <strong>{totalSelected}</strong>
            </span>
          ) : null}
          {clientStatus ? <span className={styles.helperText}>{clientStatus}</span> : null}

          <div className={styles.actions}>
            <SubmitButton pending={isSubmitting} />
          </div>
        </form>

        {error ? <p className={styles.error}>{error}</p> : null}
        {state.metadataDebug ? (
          <p className={styles.debugText}>Server-debug: {state.metadataDebug}</p>
        ) : null}
      </section>

      <Summary state={state} />

      {rows.length ? (
        <ResultsWithInvoiceLinks
          key={rowsSignature}
          initialRows={rows}
          fileLinks={fileLinks}
        />
      ) : null}
    </div>
  );
}
