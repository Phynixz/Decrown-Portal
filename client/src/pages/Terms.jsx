import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTenant } from "../tenantContext.jsx";
import "../styles/terms.css";

function Section({ num, title, children }) {
  return (
    <div className="section">
      <div className="section-num">{num}</div>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export default function Terms() {
  const { businessName, branding } = useTenant();
  const [tab, setTab] = useState("terms");
  const navigate = useNavigate();

  // Mirror the vanilla behavior: if the user came from the registration
  // form, send them back there; otherwise go to the portal/login.
  const cameFromRegister = /(\/register)(\?|#|$)/i.test(document.referrer || "");
  const backLabel = cameFromRegister ? "← Back to Registration" : "← Back to Portal";
  const goBack = () =>
    cameFromRegister ? navigate("/register") : navigate("/login");

  return (
    <div className="dc-terms">
      <header className="site-header">
        <Link to="/login" className="brand">
          <img
            src={branding?.logoUrl || "/d420ac751563a3d498bd84cdf69386bb.jpg"}
            alt="Logo"
          />
          <span className="brand-name">{businessName || "De-Crown Cottage"}</span>
        </Link>
        <button
          onClick={goBack}
          className="back-link bg-transparent cursor-pointer font-sans"
        >
          {backLabel}
        </button>
      </header>

      <div className="hero">
        <h1>Legal &amp; Policies</h1>
        <p>
          Please read these terms carefully before using the {businessName || "De-Crown Cottage"}
          {" "}tenant portal.
        </p>
        <span className="updated">Last updated: January 2025</span>
      </div>

      <div className="tab-nav">
        {[
          ["terms", "Terms of Service"],
          ["privacy", "Privacy Policy"],
          ["refund", "Refund Policy"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={"tab-btn" + (tab === id ? " active" : "")}
            onClick={() => {
              setTab(id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="content-wrap">
        {tab === "terms" && (
          <>
            <Section num="01" title="Acceptance of Terms">
              <p>
                By accessing or using the De-Crown Cottage tenant portal,
                registering for accommodation, or making any payment, you agree
                to be bound by these Terms of Service. If you do not agree to
                these terms, please do not use this portal.
              </p>
              <p>
                These terms apply to all tenants, guardians, and visitors of
                De-Crown Cottage hostels located at Malete and Ila-Orangun
                campuses in Kwara State, Nigeria.
              </p>
            </Section>
            <Section num="02" title="Eligibility">
              <p>To register and use De-Crown Cottage facilities, you must:</p>
              <ul>
                <li>Be a currently enrolled student at the relevant campus</li>
                <li>Provide accurate and truthful personal information during registration</li>
                <li>Have a valid guardian or guarantor who can be contacted</li>
                <li>Be at least 16 years of age or have guardian consent</li>
              </ul>
            </Section>
            <Section num="03" title="Registration & Room Allocation">
              <p>
                Room allocation is done on a first-come, first-served basis per
                academic session. Submitting a registration form does not
                guarantee a room until payment is confirmed by management.
              </p>
              <div className="highlight-box">
                A room is only considered yours once your payment receipt has
                been verified and approved by De-Crown Cottage management.
              </div>
              <ul>
                <li>Each room can only be occupied by one registered tenant per session</li>
                <li>Providing false information during registration may result in immediate eviction without refund</li>
                <li>Rooms cannot be transferred or sublet to another person</li>
              </ul>
            </Section>
            <Section num="04" title="Room Retention">
              <p>
                Existing tenants may retain their room for the next academic
                session through the tenant portal. The following conditions
                apply:
              </p>
              <ul>
                <li>A retention request must be submitted before the session deadline announced by management</li>
                <li>Payment proof must be uploaded through the portal within 7 days of submitting a retention request</li>
                <li>Your room is not confirmed until management approves your payment</li>
                <li>Failure to upload payment proof within the stipulated time may result in your room being released to another tenant</li>
                <li>Retained rooms are subject to the current session's rent amount which may differ from previous sessions</li>
              </ul>
              <div className="warning-box">
                ⚠ Submitting a retention request does not guarantee your room.
                Confirmation only happens after admin approval.
              </div>
            </Section>
            <Section num="05" title="Payment">
              <p>
                All payments must be made to the official De-Crown Cottage bank
                account. Payment to any individual or unofficial account is done
                at your own risk and De-Crown Cottage will not be held
                responsible.
              </p>
              <ul>
                <li>Rent is due at the beginning of each academic session</li>
                <li>Partial payments are not accepted unless otherwise agreed in writing by management</li>
                <li>Payment receipts must be uploaded through the portal as proof of payment</li>
                <li>Management reserves the right to adjust rent amounts between sessions</li>
              </ul>
            </Section>
            <Section num="06" title="Tenant Conduct">
              <p>All tenants are expected to:</p>
              <ul>
                <li>Maintain cleanliness in their room and common areas</li>
                <li>Respect other tenants and hostel staff at all times</li>
                <li>Not engage in any illegal activities on the premises</li>
                <li>Not make structural alterations to the room or property</li>
                <li>Report any maintenance issues to management promptly</li>
                <li>Adhere to the hostel's curfew and visitor policy</li>
              </ul>
              <div className="warning-box">
                ⚠ Violation of conduct rules may result in eviction without
                refund and a ban from future registration.
              </div>
            </Section>
            <Section num="07" title="Termination">
              <p>
                De-Crown Cottage reserves the right to terminate a tenant's
                accommodation at any time for the following reasons:
              </p>
              <ul>
                <li>Non-payment of rent</li>
                <li>Violation of conduct rules</li>
                <li>Provision of false information during registration</li>
                <li>Behaviour that endangers other tenants or staff</li>
                <li>Damage to hostel property</li>
              </ul>
            </Section>
            <Section num="08" title="Changes to Terms">
              <p>
                De-Crown Cottage reserves the right to update these Terms of
                Service at any time. Changes will be posted on this page and
                tenants will be notified through the portal. Continued use of
                the portal after changes constitutes acceptance of the new
                terms.
              </p>
            </Section>
          </>
        )}

        {tab === "privacy" && (
          <>
            <Section num="01" title="Information We Collect">
              <p>
                When you register on the De-Crown Cottage portal, we collect the
                following information:
              </p>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Academic level</li>
                <li>Guardian name and phone number</li>
                <li>Passport photograph</li>
                <li>Payment receipt / proof of payment</li>
                <li>Room number and session details</li>
              </ul>
            </Section>
            <Section num="02" title="How We Use Your Information">
              <p>Your information is used solely for the following purposes:</p>
              <ul>
                <li>Processing your hostel registration and room allocation</li>
                <li>Verifying your identity and payment</li>
                <li>Contacting you or your guardian regarding your accommodation</li>
                <li>Generating your official payment receipt</li>
                <li>Managing room retention for subsequent sessions</li>
                <li>Maintaining accurate hostel records</li>
              </ul>
              <div className="highlight-box">
                We do not sell, rent, or share your personal information with
                any third party for marketing or commercial purposes.
              </div>
            </Section>
            <Section num="03" title="Data Storage & Security">
              <p>
                Your data is stored securely on MongoDB Atlas cloud servers.
                Uploaded files including passport photographs and payment
                receipts are stored on Cloudinary's secure servers. We use
                industry-standard encryption and JWT authentication to protect
                your account.
              </p>
              <ul>
                <li>Passwords are never stored in plain text — they are encrypted using bcrypt</li>
                <li>All connections to the portal are encrypted via HTTPS</li>
                <li>Only authorised administrators can access tenant records</li>
              </ul>
            </Section>
            <Section num="04" title="Data Retention">
              <p>
                We retain your personal information for as long as you are a
                registered tenant at De-Crown Cottage. Records may be kept for
                up to 2 years after your last session for administrative
                purposes.
              </p>
              <p>
                You may request deletion of your records by contacting
                management directly. Note that deletion of records will remove
                your registration history permanently.
              </p>
            </Section>
            <Section num="05" title="Your Rights">
              <p>As a tenant you have the right to:</p>
              <ul>
                <li>Access your personal information stored on the portal</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your records after leaving the hostel</li>
                <li>Know how your information is being used</li>
              </ul>
              <p>
                To exercise any of these rights, contact De-Crown Cottage
                management using the contact details below.
              </p>
            </Section>
            <Section num="06" title="Cookies">
              <p>
                The De-Crown Cottage portal uses browser storage (localStorage
                and sessionStorage) to keep you logged in during your session.
                This is not a tracking cookie and no personal data is shared
                with third parties through this mechanism.
              </p>
            </Section>
          </>
        )}

        {tab === "refund" && (
          <>
            <Section num="01" title="General Refund Policy">
              <p>
                De-Crown Cottage operates a strict refund policy. All payments
                made for accommodation are generally non-refundable. However,
                refunds may be considered under the following exceptional
                circumstances:
              </p>
              <ul>
                <li>Double payment — if a tenant accidentally pays twice for the same session</li>
                <li>Room unavailability — if management is unable to provide the allocated room</li>
                <li>Medical emergency — supported by a valid medical certificate from a recognised hospital</li>
                <li>School withdrawal — supported by an official letter from the institution</li>
              </ul>
            </Section>
            <Section num="02" title="Refund Process">
              <p>To request a refund:</p>
              <ul>
                <li>Submit a written request to De-Crown Cottage management within 14 days of payment</li>
                <li>Provide supporting documents for your reason</li>
                <li>Refunds will be processed within 14 working days of approval</li>
                <li>Approved refunds will be made to the original payment account</li>
              </ul>
              <div className="warning-box">
                ⚠ Refund requests submitted after 14 days of payment will not
                be considered under any circumstances.
              </div>
            </Section>
            <Section num="03" title="Non-Refundable Situations">
              <p>No refund will be issued in the following situations:</p>
              <ul>
                <li>Voluntary departure before the end of the session</li>
                <li>Eviction due to misconduct or violation of hostel rules</li>
                <li>Change of mind after room allocation is confirmed</li>
                <li>Failure to move in after payment is confirmed</li>
                <li>Requests made after 14 days of payment</li>
              </ul>
            </Section>
            <Section num="04" title="Room Retention Refunds">
              <p>
                Payments made for room retention follow the same refund policy
                as general accommodation payments. If a retention request is
                cancelled before admin approval, no payment would have been
                processed yet and no refund is necessary.
              </p>
              <p>
                Once a retention payment is confirmed and approved by
                management, it is subject to the general refund policy above.
              </p>
            </Section>
          </>
        )}

        {/* Contact card */}
        <div className="contact-card">
          <h2>Contact Us</h2>
          <div className="contact-item">
            <span className="contact-icon">📍</span>
            <span>
              Adjacent Victory Lodge, AGT2 Area Westend, Malete, Kwara State,
              Nigeria
            </span>
          </div>
          <div className="contact-item">
            <span className="contact-icon">📞</span>
            <span>09036388983</span>
          </div>
          <div className="contact-item">
            <span className="contact-icon">✉️</span>
            <span>decrown@gmail.com</span>
          </div>
          <div className="contact-item">
            <span className="contact-icon">🌐</span>
            <span>decrown-portal-production.up.railway.app</span>
          </div>
        </div>
      </div>

      <footer className="page-footer">
        <p>© 2025 De-Crown Cottage. All rights reserved. Kwara State, Nigeria.</p>
      </footer>
    </div>
  );
}
