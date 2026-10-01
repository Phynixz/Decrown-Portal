import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Camera } from "lucide-react";
import { getTenantToken, fmtDate } from "../api.js";

export default function TenantProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getTenantToken();
    if (!token) {
      navigate("/portal", { replace: true });
      return;
    }
    (async () => {
      try {
        const res = await fetch("/tenant/me", {
          headers: { Authorization: token },
        });
        if (!res.ok) {
          navigate("/portal", { replace: true });
          return;
        }
        setProfile(await res.json());
      } catch (err) {
        setError("Failed to load profile: " + err.message);
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-bg font-sans leading-relaxed text-text">
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <header className="mb-10 flex items-center justify-between">
          <h1 className="font-display text-[32px] text-navy">My Profile</h1>
          <div className="flex gap-3">
            <button className="rounded-lg border border-border bg-card2 px-5 py-2.5 font-sans font-semibold text-navy transition-all hover:bg-border" onClick={() => navigate(-1)}>
              ← Back
            </button>
          </div>
        </header>

        {error && <div className="mb-5 rounded-lg border-l-4 border-l-[#f5c6cb] bg-[#f8d7da] px-4 py-4 text-[#721c24]">{error}</div>}

        {!profile && !error && (
          <div className="p-10 text-center text-muted">Loading your profile...</div>
        )}

        {profile && (
          <>
            {profile.retainPending ? (
              <div className="mb-5 rounded-lg border-l-4 border-l-[#ffc107] bg-[#fff3cd] px-3 py-3 text-[#856404]">
                <Clock size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} />Your profile is pending admin review
              </div>
            ) : (
              <div className="mb-5 rounded-lg border-l-4 border-l-[#28a745] bg-[#d4edda] px-3 py-3 text-[#155724]">
                ✓ Your profile is complete and approved
              </div>
            )}

            <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Personal Information */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 border-b-2 border-border pb-3 font-display text-lg text-navy">Personal Information</div>
                <div className="flex items-start justify-between border-b border-card2 py-3 last:border-b-0">
                  <span className="min-w-[130px] font-semibold text-navy">Name</span>
                  <span className="flex-1 text-right text-text2">{profile.name || "—"}</span>
                </div>
                <div className="flex items-start justify-between border-b border-card2 py-3 last:border-b-0">
                  <span className="min-w-[130px] font-semibold text-navy">Email</span>
                  <span className="flex-1 text-right text-text2">{profile.email || "—"}</span>
                </div>
                <div className="flex items-start justify-between border-b border-card2 py-3 last:border-b-0">
                  <span className="min-w-[130px] font-semibold text-navy">Phone</span>
                  <span className="flex-1 text-right text-text2">{profile.phone || "—"}</span>
                </div>
                {profile.guardianName && (
                  <>
                    <div className="flex items-start justify-between border-b border-card2 py-3 last:border-b-0">
                      <span className="min-w-[130px] font-semibold text-navy">Guardian</span>
                      <span className="flex-1 text-right text-text2">{profile.guardianName}</span>
                    </div>
                    <div className="flex items-start justify-between border-b border-card2 py-3 last:border-b-0">
                      <span className="min-w-[130px] font-semibold text-navy">Guardian Phone</span>
                      <span className="flex-1 text-right text-text2">{profile.guardianPhone}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Room & Session */}
              <div className="rounded-xl border-2 border-terra bg-gradient-to-br from-card2 to-card p-6 shadow-sm">
                <div className="mb-4 border-b-2 border-border pb-3 font-display text-lg text-terra">Room Assignment</div>
                <div className="flex items-start justify-between border-b border-card2 py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Location</span>
                  <span className="flex-1 text-right text-text2">{profile.location || "—"}</span>
                </div>
                <div className="flex items-start justify-between border-b border-card2 py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Room No.</span>
                  <span className="flex-1 text-right text-text2">{profile.roomNo || "—"}</span>
                </div>
                <div className="flex items-start justify-between border-b border-card2 py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Type</span>
                  <span className="flex-1 text-right text-text2">{profile.type || "—"}</span>
                </div>
                <div className="flex items-start justify-between border-b border-card2 py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Level</span>
                  <span className="flex-1 text-right text-text2">{profile.level || "—"}</span>
                </div>
                <div className="flex items-start justify-between py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Session</span>
                  <span className="flex-1 text-right text-text2">{profile.session || "—"}</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 border-b-2 border-border pb-3 font-display text-lg text-navy">Payment Details</div>
                <div className="flex items-start justify-between border-b border-card2 py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Amount</span>
                  <span className="flex-1 text-right text-text2">
                    ₦{Number(profile.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-start justify-between py-3">
                  <span className="min-w-[130px] font-semibold text-navy">Payment Date</span>
                  <span className="flex-1 text-right text-text2">
                    {fmtDate(profile.paymentDate) || "—"}
                  </span>
                </div>
              </div>

              {/* Documents */}
              <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
                <div className="mb-4 border-b-2 border-border pb-3 font-display text-lg text-navy">Uploaded Documents</div>
                <div className="mt-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
                  <div className={(profile.passport ? "" : "opacity-50 cursor-not-allowed ") + "cursor-pointer rounded-lg border border-border bg-card2 p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-border"}>
                    <div className="mb-2 text-[32px]"><Camera size={20} /></div>
                    <div className="mb-1 text-sm font-semibold text-navy">Passport</div>
                    <div className="text-xs text-muted">
                      {profile.passport ? (
                        <a
                          href={profile.passport}
                          target="_blank"
                          rel="noopener"
                          className="text-terra no-underline"
                        >
                          View
                        </a>
                      ) : (
                        "Not uploaded"
                      )}
                    </div>
                  </div>
                  <div className={(profile.idCard ? "" : "opacity-50 cursor-not-allowed ") + "cursor-pointer rounded-lg border border-border bg-card2 p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-border"}>
                    <div className="mb-2 text-[32px]">🆔</div>
                    <div className="mb-1 text-sm font-semibold text-navy">ID Card</div>
                    <div className="text-xs text-muted">
                      {profile.idCard ? (
                        <a
                          href={profile.idCard}
                          target="_blank"
                          rel="noopener"
                          className="text-terra no-underline"
                        >
                          View
                        </a>
                      ) : (
                        "Not uploaded"
                      )}
                    </div>
                  </div>
                  <div className={(profile.paymentProof ? "" : "opacity-50 cursor-not-allowed ") + "cursor-pointer rounded-lg border border-border bg-card2 p-4 text-center transition-all hover:-translate-y-0.5 hover:bg-border"}>
                    <div className="mb-2 text-[32px]">💳</div>
                    <div className="mb-1 text-sm font-semibold text-navy">Payment Proof</div>
                    <div className="text-xs text-muted">
                      {profile.paymentProof ? (
                        <a
                          href={profile.paymentProof}
                          target="_blank"
                          rel="noopener"
                          className="text-terra no-underline"
                        >
                          View
                        </a>
                      ) : (
                        "Not uploaded"
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center">
              <Link
                to="/portal"
                className="inline-block rounded-lg border border-border bg-card2 px-5 py-2.5 font-sans font-semibold text-navy no-underline transition-all hover:bg-border"
              >
                ← Back to Portal
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
