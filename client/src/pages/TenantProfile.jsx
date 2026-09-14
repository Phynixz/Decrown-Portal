import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Camera } from "lucide-react";
import { getTenantToken, fmtDate } from "../api.js";
import "../styles/profile.css";

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
    <div className="dc-profile">
      <div className="container">
        <header>
          <h1>My Profile</h1>
          <div className="header-actions">
            <button className="btn-secondary" onClick={() => navigate(-1)}>
              ← Back
            </button>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        {!profile && !error && (
          <div className="loading">Loading your profile...</div>
        )}

        {profile && (
          <>
            {profile.retainPending ? (
              <div className="status-pending">
                <Clock size={14} style={{ marginRight: 4, verticalAlign: "-2px" }} />Your profile is pending admin review
              </div>
            ) : (
              <div className="status-approved">
                ✓ Your profile is complete and approved
              </div>
            )}

            <div className="profile-grid">
              {/* Personal Information */}
              <div className="card">
                <div className="card-title">Personal Information</div>
                <div className="profile-row">
                  <span className="profile-label">Name</span>
                  <span className="profile-value">{profile.name || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Email</span>
                  <span className="profile-value">{profile.email || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Phone</span>
                  <span className="profile-value">{profile.phone || "—"}</span>
                </div>
                {profile.guardianName && (
                  <>
                    <div className="profile-row">
                      <span className="profile-label">Guardian</span>
                      <span className="profile-value">{profile.guardianName}</span>
                    </div>
                    <div className="profile-row">
                      <span className="profile-label">Guardian Phone</span>
                      <span className="profile-value">{profile.guardianPhone}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Room & Session */}
              <div className="card room-highlight">
                <div className="card-title">Room Assignment</div>
                <div className="profile-row">
                  <span className="profile-label">Location</span>
                  <span className="profile-value">{profile.location || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Room No.</span>
                  <span className="profile-value">{profile.roomNo || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Type</span>
                  <span className="profile-value">{profile.type || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Level</span>
                  <span className="profile-value">{profile.level || "—"}</span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Session</span>
                  <span className="profile-value">{profile.session || "—"}</span>
                </div>
              </div>

              {/* Payment Information */}
              <div className="card">
                <div className="card-title">Payment Details</div>
                <div className="profile-row">
                  <span className="profile-label">Amount</span>
                  <span className="profile-value">
                    ₦{Number(profile.amount || 0).toLocaleString()}
                  </span>
                </div>
                <div className="profile-row">
                  <span className="profile-label">Payment Date</span>
                  <span className="profile-value">
                    {fmtDate(profile.paymentDate) || "—"}
                  </span>
                </div>
              </div>

              {/* Documents */}
              <div className="card">
                <div className="card-title">Uploaded Documents</div>
                <div className="document-grid">
                  <div className={"doc-tile" + (profile.passport ? "" : " empty")}>
                    <div className="doc-icon"><Camera size={20} /></div>
                    <div className="doc-name">Passport</div>
                    <div className="doc-status">
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
                  <div className={"doc-tile" + (profile.idCard ? "" : " empty")}>
                    <div className="doc-icon">🆔</div>
                    <div className="doc-name">ID Card</div>
                    <div className="doc-status">
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
                  <div className={"doc-tile" + (profile.paymentProof ? "" : " empty")}>
                    <div className="doc-icon">💳</div>
                    <div className="doc-name">Payment Proof</div>
                    <div className="doc-status">
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
                className="btn-secondary inline-block no-underline"
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
