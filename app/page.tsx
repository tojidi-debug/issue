"use client";

import { useMemo, useState } from "react";
import type {
  AnalysisResult,
  AttestationClient,
  FileRole,
  ParsedFileResult,
  ReviewCandidate,
  Transaction,
} from "@/lib/domain";
import { analyzeIndependence } from "@/lib/analyze";
import { downloadReviewWorkbook } from "@/lib/export-xlsx";
import { parseInputFile } from "@/lib/parse-input";
import { getReasonTone } from "@/lib/presentation";

type QueueItem = {
  file: File;
  role: FileRole;
  status: "대기" | "처리중" | "완료" | "경고" | "실패";
  detail?: string;
};

function formatMoney(value: number): string {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function FileDropzone({
  title,
  role,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  role: FileRole;
  items: QueueItem[];
  onAdd: (files: File[], role: FileRole) => void;
  onRemove: (index: number) => void;
}) {
  const inputId = `files-${role}`;
  return (
    <section className="file-group" aria-labelledby={`${inputId}-title`}>
      <div className="file-group-heading">
        <h2 id={`${inputId}-title`}>{title}</h2>
        <span>PDF · Excel · CSV</span>
      </div>
      <label
        className="compact-dropzone"
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onAdd(Array.from(event.dataTransfer.files), role);
        }}
      >
        <span className="add-symbol" aria-hidden="true">＋</span>
        <span>파일 선택 또는 끌어놓기</span>
      </label>
      <input
        id={inputId}
        className="visually-hidden"
        type="file"
        accept=".pdf,.xls,.xlsx,.csv"
        multiple
        onChange={(event) => {
          onAdd(Array.from(event.target.files ?? []), role);
          event.currentTarget.value = "";
        }}
      />
      {items.length > 0 && (
        <div className="queue" aria-live="polite">
          {items.map((item, index) => (
            <div className="queue-row" key={`${item.file.name}-${item.file.lastModified}`}>
              <div className="queue-file">
                <strong title={item.file.name}>{item.file.name}</strong>
                <span>
                  {(item.file.size / 1024 / 1024).toFixed(1)} MB
                  {item.detail ? ` · ${item.detail}` : ""}
                </span>
              </div>
              <span className={`status status-${item.status}`}>{item.status}</span>
              <button type="button" className="remove-button" onClick={() => onRemove(index)}>
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Summary({ analysis }: { analysis: AnalysisResult }) {
  const entries = [
    ["전체 전표", analysis.summary.totalTransactions],
    ["감사", analysis.summary.auditClients],
    ["기업진단", analysis.summary.diagnosticClients],
    ["확인 필요", analysis.summary.candidateCount],
    ["고위험", analysis.summary.highRiskCount],
  ];
  return (
    <div className="summary-strip" aria-label="분석 요약">
      {entries.map(([label, value]) => (
        <span className="summary-item" key={String(label)}>
          <strong>{formatMoney(Number(value))}</strong>
          {label}
        </span>
      ))}
    </div>
  );
}

function ReviewTable({ rows }: { rows: ReviewCandidate[] }) {
  if (rows.length === 0) {
    return <p className="result-empty">현재 조건에 해당하는 검토 후보가 없습니다.</p>;
  }
  return (
    <div className="table-shell">
      <table>
        <colgroup>
          <col className="col-target" />
          <col className="col-voucher" />
          <col className="col-transaction" />
          <col className="col-match" />
          <col className="col-note" />
        </colgroup>
        <thead>
          <tr>
            <th>위험 · 대상</th>
            <th>전표</th>
            <th>거래 내용</th>
            <th>대사 근거</th>
            <th>검토 비고</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={`reason-${getReasonTone(row)}`}>
              <td>
                <div className="cell-stack">
                  <div className="cell-inline">
                    <span className={`risk-badge risk-${row.risk}`}>{row.risk}</span>
                    <span className="quiet-label">{row.targetKind}</span>
                  </div>
                  <strong className="company-name">{row.matchedCompany}</strong>
                </div>
              </td>
              <td>
                <div className="cell-stack">
                  <strong>{row.date}</strong>
                  <span>{row.year}년 · {row.accountant || "담당자 미인식"}</span>
                  <span className="source-text">{row.sourceLocation}</span>
                </div>
              </td>
              <td>
                <div className="cell-stack">
                  <strong>{row.memo || "적요 없음"}</strong>
                  <span className="amount">{formatMoney(row.amount)}원</span>
                  <span>{row.serviceClass}</span>
                </div>
              </td>
              <td>
                <div className="cell-stack">
                  <strong>{row.issue}</strong>
                  <span>{row.matchBasis}</span>
                </div>
              </td>
              <td className="note-cell">{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Home() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [progress, setProgress] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<"all" | "2024" | "2025">("all");
  const [riskFilter, setRiskFilter] = useState<"all" | "상" | "중">("all");
  const [query, setQuery] = useState("");

  const addFiles = (files: File[], role: FileRole) => {
    const supported = files.filter((file) => /\.(pdf|xls|xlsx|csv)$/i.test(file.name));
    setQueue((current) => [
      ...current,
      ...supported.map((file) => ({ file, role, status: "대기" as const })),
    ]);
    setAnalysis(null);
  };

  const processFiles = async () => {
    if (processing || queue.length === 0) return;
    setProcessing(true);
    setProgress(0);
    setAnalysis(null);
    const transactions: Transaction[] = [];
    const clients: AttestationClient[] = [];
    const messages: string[] = [];

    for (let index = 0; index < queue.length; index += 1) {
      setQueue((current) =>
        current.map((item, itemIndex) =>
          itemIndex === index ? { ...item, status: "처리중" } : item,
        ),
      );
      try {
        const result: ParsedFileResult = await parseInputFile(
          queue[index].file,
          queue[index].role,
        );
        transactions.push(...result.transactions);
        clients.push(...result.clients);
        result.warnings.forEach((warning) =>
          messages.push(`${result.fileName}: ${warning.message}`),
        );
        setQueue((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  status: result.warnings.length ? "경고" : "완료",
                  detail:
                    item.role === "sales"
                      ? `${formatMoney(result.transactions.length)}건`
                      : `${formatMoney(result.clients.length)}개사`,
                }
              : item,
          ),
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        messages.push(`${queue[index].file.name}: ${message}`);
        setQueue((current) =>
          current.map((item, itemIndex) =>
            itemIndex === index ? { ...item, status: "실패", detail: message } : item,
          ),
        );
      }
      setProgress(Math.round(((index + 1) / queue.length) * 100));
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
    setWarnings(messages);
    setAnalysis(analyzeIndependence(transactions, clients));
    setProcessing(false);
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (analysis?.candidates ?? []).filter((row) => {
      if (yearFilter !== "all" && row.year !== Number(yearFilter)) return false;
      if (riskFilter !== "all" && row.risk !== riskFilter) return false;
      if (
        normalized &&
        !`${row.matchedCompany} ${row.clientName} ${row.accountant} ${row.memo} ${row.serviceClass}`
          .toLowerCase()
          .includes(normalized)
      ) {
        return false;
      }
      return true;
    });
  }, [analysis, query, riskFilter, yearFilter]);

  const references = queue
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.role === "reference");
  const sales = queue
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.role === "sales");

  return (
    <main>
      <header className="compact-header">
        <div>
          <h1>감사·인증 독립성 검토</h1>
          <span>서석감사반 수임실적 대사</span>
        </div>
        <p className="local-note">
          <span aria-hidden="true" />
          파일은 브라우저 안에서만 처리됩니다
        </p>
      </header>

      <div className="workspace">
        <aside className="input-panel">
          <div className="panel-heading">
            <div>
              <h2>파일 첨부</h2>
              <p>기준자료와 매출장을 함께 선택하세요.</p>
            </div>
            <span className="file-count">{queue.length}개</span>
          </div>

          <FileDropzone
            title="기준자료"
            role="reference"
            items={references.map(({ item }) => item)}
            onAdd={addFiles}
            onRemove={(localIndex) =>
              setQueue((current) =>
                current.filter((_, index) => index !== references[localIndex].index),
              )
            }
          />
          <FileDropzone
            title="구성원 매출장"
            role="sales"
            items={sales.map(({ item }) => item)}
            onAdd={addFiles}
            onRemove={(localIndex) =>
              setQueue((current) =>
                current.filter((_, index) => index !== sales[localIndex].index),
              )
            }
          />

          <div className="run-area">
            <div className="progress-line" aria-label={`진행률 ${progress}%`}>
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
            <button
              className="primary-button"
              type="button"
              onClick={processFiles}
              disabled={processing || queue.length === 0}
            >
              {processing ? `대사 중 ${progress}%` : "대사 실행"}
            </button>
          </div>

          {warnings.length > 0 && (
            <div className="warning-list" aria-label="처리 경고">
              {warnings.map((warning) => <p key={warning}>{warning}</p>)}
            </div>
          )}
        </aside>

        <section className="result-panel" aria-labelledby="results-title">
          {!analysis ? (
            <div className="empty-results">
              <span className="empty-mark" aria-hidden="true">↔</span>
              <h2 id="results-title">대사 결과</h2>
              <p>관련 파일을 첨부하고 대사를 실행하면<br />확인이 필요한 전표만 표시됩니다.</p>
              <span>후보는 독립성 위반 확정이 아닙니다.</span>
            </div>
          ) : (
            <>
              <div className="results-header">
                <div>
                  <h2 id="results-title">대사 결과</h2>
                  <span>{formatMoney(filtered.length)}건 표시</span>
                </div>
                <button
                  className="export-button"
                  type="button"
                  onClick={() => downloadReviewWorkbook(analysis.candidates)}
                >
                  매출 확인.xlsx
                </button>
              </div>

              <Summary analysis={analysis} />

              <div className="filters">
                <select
                  aria-label="연도"
                  value={yearFilter}
                  onChange={(event) => setYearFilter(event.target.value as typeof yearFilter)}
                >
                  <option value="all">전체 연도</option>
                  <option value="2024">2024년</option>
                  <option value="2025">2025년</option>
                </select>
                <select
                  aria-label="위험도"
                  value={riskFilter}
                  onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}
                >
                  <option value="all">전체 위험도</option>
                  <option value="상">위험 상</option>
                  <option value="중">위험 중</option>
                </select>
                <input
                  aria-label="회사, 담당자, 용역 검색"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="회사 · 담당자 · 용역 검색"
                />
              </div>

              <ReviewTable rows={filtered} />
            </>
          )}
        </section>
      </div>
    </main>
  );
}
