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
  description,
  role,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  description: string;
  role: FileRole;
  items: QueueItem[];
  onAdd: (files: File[], role: FileRole) => void;
  onRemove: (index: number) => void;
}) {
  const inputId = `files-${role}`;
  return (
    <section className="upload-block" aria-labelledby={`${inputId}-title`}>
      <div className="upload-copy">
        <span className="step-kicker">{role === "reference" ? "01" : "02"}</span>
        <div>
          <h2 id={`${inputId}-title`}>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      <label
        className="dropzone"
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          onAdd(Array.from(event.dataTransfer.files), role);
        }}
      >
        <span className="drop-main">파일을 끌어놓거나 클릭해 선택</span>
        <span className="drop-sub">PDF · XLS · XLSX · CSV / 여러 파일 선택 가능</span>
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
      <div className="queue" aria-live="polite">
        {items.length === 0 ? (
          <p className="empty-line">아직 선택한 파일이 없습니다.</p>
        ) : (
          items.map((item, index) => (
            <div className="queue-row" key={`${item.file.name}-${item.file.lastModified}`}>
              <div>
                <strong>{item.file.name}</strong>
                <span>{(item.file.size / 1024 / 1024).toFixed(1)} MB</span>
              </div>
              <div className="queue-actions">
                <span className={`status status-${item.status}`}>{item.status}</span>
                {item.detail && <span className="queue-detail">{item.detail}</span>}
                <button type="button" className="text-button" onClick={() => onRemove(index)}>
                  제거
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Summary({ analysis }: { analysis: AnalysisResult }) {
  const entries = [
    ["읽은 전표", analysis.summary.totalTransactions],
    ["감사 대상회사", analysis.summary.auditClients],
    ["기업진단 회사", analysis.summary.diagnosticClients],
    ["확인 필요 전표", analysis.summary.candidateCount],
    ["고위험 후보", analysis.summary.highRiskCount],
  ];
  return (
    <div className="summary-grid">
      {entries.map(([label, value]) => (
        <div className="metric" key={String(label)}>
          <span>{label}</span>
          <strong>{formatMoney(Number(value))}</strong>
        </div>
      ))}
    </div>
  );
}

function ReviewTable({ rows }: { rows: ReviewCandidate[] }) {
  if (rows.length === 0) {
    return <p className="result-empty">현재 필터에 해당하는 검토 후보가 없습니다.</p>;
  }
  return (
    <div className="table-shell">
      <table>
        <thead>
          <tr>
            <th>연도</th>
            <th>위험</th>
            <th>대상 구분</th>
            <th>매칭 회사</th>
            <th>거래일자</th>
            <th>담당자</th>
            <th>품명·적요</th>
            <th>금액</th>
            <th>용역분류</th>
            <th>확인필요사항</th>
            <th>매칭근거</th>
            <th>원본위치</th>
            <th>비고(왜 확인해야 하는지)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className={row.risk === "상" ? "risk-high" : "risk-medium"}>
              <td>{row.year}</td>
              <td><span className={`risk-badge risk-${row.risk}`}>{row.risk}</span></td>
              <td>{row.targetKind}</td>
              <td><strong>{row.matchedCompany}</strong></td>
              <td>{row.date}</td>
              <td>{row.accountant || "미인식"}</td>
              <td>{row.memo}</td>
              <td className="number">{formatMoney(row.amount)}</td>
              <td>{row.serviceClass}</td>
              <td>{row.issue}</td>
              <td>{row.matchBasis}</td>
              <td>{row.sourceLocation}</td>
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
    const supported = files.filter((file) =>
      /\.(pdf|xls|xlsx|csv)$/i.test(file.name),
    );
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
      <header className="masthead">
        <div className="masthead-mark" aria-hidden="true">獨</div>
        <div>
          <p className="eyebrow">SEOKSEOK AUDIT REVIEW DESK</p>
          <h1>감사·인증 독립성 검토</h1>
          <p className="lede">
            사전감리자료와 모든 구성원의 매출장을 대사해, 계약서와 산출물을
            다시 확인해야 할 전표만 선별합니다.
          </p>
        </div>
        <div className="privacy-seal">
          <strong>LOCAL ONLY</strong>
          <span>파일은 이 브라우저 안에서만 처리됩니다</span>
        </div>
      </header>

      <section className="rule-strip" aria-label="검토 원칙">
        <span>사업자번호 우선</span>
        <span>동명·번호충돌 자동매칭 금지</span>
        <span>세무조정·신고 제외</span>
        <span>후보는 위반 확정이 아님</span>
      </section>

      <div className="upload-layout">
        <FileDropzone
          title="감사·인증 대상 기준자료"
          description="사전감리자료, 수임신고 대사, 연결·관계기업 명단"
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
          title="구성원 전체 매출장"
          description="2024년·2025년 Excel/CSV 또는 PDF 매출장·계정별원장"
          role="sales"
          items={sales.map(({ item }) => item)}
          onAdd={addFiles}
          onRemove={(localIndex) =>
            setQueue((current) =>
              current.filter((_, index) => index !== sales[localIndex].index),
            )
          }
        />
      </div>

      <section className="action-deck">
        <div>
          <span className="step-kicker">03</span>
          <h2>브라우저에서 대사 실행</h2>
          <p>파일 내용은 서버로 전송하거나 영구 저장하지 않습니다.</p>
        </div>
        <div className="run-area">
          <div className="progress-track" aria-label={`진행률 ${progress}%`}>
            <span style={{ transform: `scaleX(${progress / 100})` }} />
          </div>
          <button
            className="primary-button"
            type="button"
            onClick={processFiles}
            disabled={processing || queue.length === 0}
          >
            {processing ? `처리 중 ${progress}%` : "독립성 검토 실행"}
          </button>
        </div>
      </section>

      {warnings.length > 0 && (
        <section className="warning-panel" aria-label="처리 경고">
          <strong>확인이 필요한 파일 메시지</strong>
          <ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </section>
      )}

      {analysis && (
        <section className="results" aria-labelledby="results-title">
          <div className="results-heading">
            <div>
              <span className="step-kicker">04</span>
              <h2 id="results-title">검토 후보</h2>
              <p>전표 적요만으로 위반을 확정하지 않고, 확인 이유와 필요한 증빙을 함께 제시합니다.</p>
            </div>
            <button
              className="export-button"
              type="button"
              onClick={() => downloadReviewWorkbook(analysis.candidates)}
            >
              매출 확인.xlsx 다운로드
            </button>
          </div>
          <Summary analysis={analysis} />
          <div className="filters">
            <label>
              연도
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value as typeof yearFilter)}>
                <option value="all">전체</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
              </select>
            </label>
            <label>
              위험도
              <select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as typeof riskFilter)}>
                <option value="all">전체</option>
                <option value="상">상</option>
                <option value="중">중</option>
              </select>
            </label>
            <label className="search-field">
              회사·담당자·용역 검색
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 부천공업, 기장, 임중길" />
            </label>
            <span className="filtered-count">{formatMoney(filtered.length)}건 표시</span>
          </div>
          <ReviewTable rows={filtered} />
        </section>
      )}

      <footer>
        <p>
          본 결과는 독립성 위반 확정이 아닌 추가 증빙 확인 대상입니다. 감사계약,
          기업진단 계약, 세금계산서, 수행기간과 산출물을 종합 검토하세요.
        </p>
      </footer>
    </main>
  );
}
