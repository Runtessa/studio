import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useApi } from "@/lib/api";
import {
  FiCheck,
  FiX,
  FiClock,
  FiUser,
  FiMessageSquare,
  FiArrowLeft,
} from "react-icons/fi";
import { Button } from "@/components/ui/Button";
import { useSessionToken } from "@/lib/client/session";
import { hasPermissionFromUser } from "@/lib/client/access";
import { PageHeader } from "@/components/layout/PageHeader";
import { DataCard } from "@/components/ui/DataCard";
import { useToast } from "@/components/ui/Toast";

const MonacoDiffEditor = dynamic(
  () => import("@monaco-editor/react").then((mod) => mod.DiffEditor),
  { ssr: false },
);

export default function PublishRequestDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { adminFetch } = useApi();
  const { token, setToken, ready } = useSessionToken();
  const { success, error: showError } = useToast();

  const [request, setRequest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionNote, setRejectionNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const bootstrap = async () => {
      if (!ready || !token || !id) return;
      try {
        const meRes = await fetch("/api/me", {
          headers: { Authorization: `Session ${token}` },
        });
        const meData = await meRes.json();
        if (!meRes.ok) throw new Error(meData.error || "Failed to load user");
        setIsAdmin(hasPermissionFromUser(meData.user, "ide.ui.publish"));

        const reqData = await adminFetch(`/api/admin/publish-requests/${id}`);
        setRequest(reqData);
      } catch (err: any) {
        showError(err.message);
        if (err.message?.toLowerCase().includes("unauthorized")) {
          setToken("");
        }
      } finally {
        setLoading(false);
      }
    };
    bootstrap();
  }, [ready, token, id, adminFetch, setToken, showError]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString();
    } catch (e) {
      return dateStr;
    }
  };

  const resolveCodeLanguage = (item: any): string => {
    const ext = String(item?.data?.fileExtension || "").toLowerCase();
    if (ext === "ts" || ext === "tsx") return "typescript";
    if (ext === "js" || ext === "jsx") return "javascript";
    if (ext === "json") return "json";
    if (ext === "css") return "css";
    if (ext === "html") return "html";
    return ext || "javascript";
  };

  const resolveModifiedCode = (item: any): string | null => {
    if (typeof item?.resolvedModifiedCode === "string") return item.resolvedModifiedCode;
    if (typeof item?.data?.code === "string") return item.data.code;
    if (typeof item?.data?.codeBlob === "string") return item.data.codeBlob;
    if (item?.data) return JSON.stringify(item.data, null, 2);
    return null;
  };

  const resolveOriginalCode = (item: any): string => {
    if (typeof item?.resolvedOriginalCode === "string") return item.resolvedOriginalCode;
    if (typeof item?.originalCode === "string") return item.originalCode;
    return "";
  };

  const normalizeLineEndings = (value: string): string =>
    value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const hasPreviousCode = (item: any): boolean =>
    normalizeLineEndings(resolveOriginalCode(item)).trim().length > 0;

  const handleApprove = async () => {
    if (!confirm("Are you sure you want to approve and publish these changes?"))
      return;
    try {
      setBusy(true);
      await adminFetch(`/api/publish-requests/${id}/approve`, {
        method: "POST",
      });
      success("Publish request approved and changes published");
      router.push("/admin/publish-requests");
    } catch (err: any) {
      showError(err.message || "Failed to approve request");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionNote.trim()) return;
    try {
      setBusy(true);
      await adminFetch(`/api/publish-requests/${id}/reject`, {
        method: "POST",
        body: { note: rejectionNote },
      });
      success("Publish request rejected");
      router.push("/admin/publish-requests");
    } catch (err: any) {
      showError(err.message || "Failed to reject request");
    } finally {
      setBusy(false);
    }
  };

  if (ready && !token) {
    return (
      <div className="min-h-screen bg-bgApp px-4 py-10 text-left text-textPrimary">
        <div className="mx-auto w-full max-w-md space-y-3 rounded-xl border border-borderSubtle bg-bgSurface p-6 shadow-soft">
          <h2 className="text-xl font-semibold">Please log in</h2>
          <p className="text-sm text-textMuted">
            Your session expired or is missing.{" "}
            <a href="/login" className="text-accent">
              Go to login
            </a>
            .
          </p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Publish Request Details"
          subtitle="You do not have permission to view this page."
        />
        <DataCard
          title="Permission Denied"
          subtitle="Please contact an administrator."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-textMuted">
        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        Loading request details...
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6">
        <PageHeader
          title="Not Found"
          subtitle="Publish request does not exist."
        />
        <Button variant="secondary" onClick={() => router.back()}>
          <FiArrowLeft className="mr-2" /> Back
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="secondary" size="xs" onClick={() => router.back()}>
          <FiArrowLeft className="mr-1" /> Back to list
        </Button>
      </div>

      <PageHeader
        title={`Publish Request Details`}
        subtitle={`Request ID: ${request.id}`}
        actions={
          request.status === "pending" && (
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleApprove} disabled={busy}>
                <FiCheck className="mr-1" /> Approve & Publish
              </Button>
              <Button
                variant="danger"
                onClick={() => setRejecting(true)}
                disabled={busy}
              >
                <FiX className="mr-1" /> Reject
              </Button>
            </div>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <DataCard title="Overview" subtitle="Basic request information">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-textMuted block mb-1">Status</label>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      request.status === "pending"
                        ? "bg-amber-100 text-amber-700"
                        : request.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {request.status}
                  </span>
                </div>
                <div>
                  <label className="text-textMuted block mb-1">Tenant</label>
                  <span className="text-textPrimary font-medium">
                    {request.tenant?.hostname || "Unknown"}
                  </span>
                </div>
                <div>
                  <label className="text-textMuted block mb-1">Requester</label>
                  <div className="flex items-center gap-2 text-textPrimary">
                    <FiUser size={14} className="text-textMuted" />
                    {request.requester?.username || "Unknown"}
                  </div>
                </div>
                <div>
                  <label className="text-textMuted block mb-1">
                    Created At
                  </label>
                  <div className="flex items-center gap-2 text-textPrimary">
                    <FiClock size={14} className="text-textMuted" />
                    {formatDate(request.createdAt)}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-borderSubtle">
                <label className="text-textMuted block text-xs uppercase font-bold mb-2">
                  Comment
                </label>
                <div className="bg-bgApp p-4 rounded-lg italic text-textPrimary">
                  <FiMessageSquare
                    size={14}
                    className="inline mr-2 text-textMuted"
                  />
                  "{request.comment}"
                </div>
              </div>
            </div>
          </DataCard>

          <DataCard
            title="Affected Items"
            subtitle={`Contains ${request.items.length} item(s) to be published`}
          >
            <div className="space-y-4">
              {request.items.map((item: any) => (
                <div
                  key={item.id}
                  className="border border-borderSubtle rounded-lg overflow-hidden"
                >
                  <div className="bg-bgApp px-4 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-bgSurface px-1.5 py-0.5 text-[9px] font-bold uppercase text-textMuted">
                        {item.kind}
                      </span>
                      <span className="text-sm font-semibold text-textPrimary">
                        {item.title}
                      </span>
                    </div>
                    <span className="text-[10px] text-textMuted">
                      ID: {item.id}
                    </span>
                  </div>
                  <div className="bg-bgSurface">
                    {resolveModifiedCode(item) !== null ? (
                      <>
                        <div className="flex items-center border-b border-borderSubtle bg-bgApp px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-textMuted">
                          <span>
                            Code Diff
                            {!hasPreviousCode(item) ? (
                              <span className="ml-2 normal-case tracking-normal text-amber-600">
                                No previous source found
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="h-80 overflow-hidden border border-borderSubtle bg-[#1e1e1e]">
                        <MonacoDiffEditor
                          height="100%"
                          language={resolveCodeLanguage(item)}
                          theme="vs-dark"
                          original={normalizeLineEndings(resolveOriginalCode(item))}
                          modified={normalizeLineEndings(resolveModifiedCode(item) ?? "")}
                          options={{
                            readOnly: true,
                            renderSideBySide: false,
                            diffAlgorithm: "advanced",
                            ignoreTrimWhitespace: false,
                            minimap: { enabled: false },
                            fontSize: 11,
                            scrollBeyondLastLine: false,
                            wordWrap: "on",
                            automaticLayout: true,
                          }}
                        />
                        </div>
                      </>
                    ) : (
                      <pre className="text-[10px] bg-bgApp p-3 rounded overflow-x-auto text-textPrimary max-h-48">
                        {JSON.stringify(item.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </DataCard>
        </div>

        <div className="space-y-6">
          {request.status === "approved" && (
            <DataCard
              title="Publication Info"
              subtitle="Details of the approval"
            >
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100">
                  <FiCheck size={16} />
                  Approved & Published
                </div>
                <div>
                  <label className="text-textMuted block text-xs">
                    Approved By
                  </label>
                  <div className="font-medium text-textPrimary">
                    {request.approver?.username || "Admin"}
                  </div>
                </div>
                <div>
                  <label className="text-textMuted block text-xs">
                    Published On
                  </label>
                  <div className="font-medium text-textPrimary">
                    {formatDate(request.publishedAt)}
                  </div>
                </div>
              </div>
            </DataCard>
          )}

          {request.status === "rejected" && (
            <DataCard title="Rejection Info" subtitle="Reason for rejection">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-100">
                  <FiX size={16} />
                  Rejected
                </div>
                <div>
                  <label className="text-textMuted block text-xs">
                    Rejected By
                  </label>
                  <div className="font-medium text-textPrimary">
                    {request.approver?.username || "Admin"}
                  </div>
                </div>
                <div>
                  <label className="text-textMuted block text-xs uppercase font-bold mt-2">
                    Note
                  </label>
                  <div className="bg-rose-50/50 p-3 rounded border border-rose-100 italic text-rose-900 mt-1">
                    {request.rejectionNote}
                  </div>
                </div>
              </div>
            </DataCard>
          )}

          <DataCard title="Actions" subtitle="Quick navigation">
            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/admin/publish-requests")}
              >
                Back to all requests
              </Button>
              {request.tenant && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    router.push(`/admin/tenants/${request.tenant.id}`)
                  }
                >
                  View Tenant Config
                </Button>
              )}
            </div>
          </DataCard>
        </div>
      </div>

      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-bgSurface p-6 shadow-xl">
            <h2 className="text-xl font-bold text-textPrimary mb-4">
              Reject Publish Request
            </h2>
            <p className="text-sm text-textMuted mb-4">
              Please provide a reason for rejecting this request.
            </p>
            <textarea
              value={rejectionNote}
              onChange={(e) => setRejectionNote(e.target.value)}
              className="w-full rounded border border-borderSubtle bg-bgApp p-3 text-sm text-textPrimary focus:ring-2 focus:ring-primary focus:outline-none"
              rows={4}
              placeholder="Write a note..."
            />
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReject}
                disabled={!rejectionNote.trim() || busy}
              >
                Reject Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
