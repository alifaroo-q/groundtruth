// Type-only imports keep this file loadable by plain Node (type stripping) for scripts/check.mjs.
import type { ModelOutput, Scenario, StepId } from "../lib/domain";

export type Fixture = {
  scenario: Scenario;
  replay: { args: Record<StepId, Record<string, string>>; outputs: ModelOutput };
};

function edit(doc: string, edits: [from: string, to: string][]): string {
  return edits.reduce((text, [from, to]) => {
    if (text.split(from).length !== 2) throw new Error(`fixture edit anchor must match exactly once: ${from}`);
    return text.replace(from, () => to);
  }, doc);
}

const cloudpulseDoc = `# CloudPulse API Pricing & Compliance

> **Enterprise-grade SOC2 & HIPAA security across our platform.** Every CloudPulse workspace runs on the same hardened, independently audited infrastructure.

CloudPulse is a metrics and alerting API for engineering teams. Ship telemetry in minutes, keep it as long as you need, and sleep through the night.

## Plans at a glance

| Plan | Price | Seats | Data retention | Support |
|------|-------|-------|----------------|---------|
| Starter | $0 | Up to 3 | 7 days | Community |
| Pro | $49/mo | Up to 25 | 90 days | Email, 1 business day |
| Enterprise | $499/mo | Unlimited | 13 months | 24/7 with a named TAM |

All plans include the full REST and gRPC API, webhooks, and our open-source SDKs.

## Security on every plan

- SOC 2 Type II report available under NDA
- AES-256 encryption at rest, TLS 1.3 in transit
- Role-based access control with audit logs
- HIPAA-ready infrastructure

Pro workspaces sign in with Google Workspace accounts, so your team can onboard in one click without new passwords.

## Getting started

1. Create a workspace at app.cloudpulse.io.
2. Generate an API key under **Settings → Keys**.
3. Send your first metric:

~~~bash
curl -X POST https://api.cloudpulse.io/v1/metrics \\
  -H "Authorization: Bearer $CLOUDPULSE_KEY" \\
  -d '{"name":"checkout.latency","value":182}'
~~~

## Billing

Plans are billed monthly in USD. Annual billing saves 15%. Upgrade or downgrade any time from **Settings → Billing**; changes are prorated to the day.

## Frequently asked questions

**Can I export my data?**
Yes. Every plan can export metrics as Parquet or CSV from the dashboard or the /v1/export endpoint.

**Do you offer startup discounts?**
Startups under two years old get 50% off Pro for the first year. Contact sales.

**What about regulated workloads?**
Customers processing protected health information (PHI) must sign a Business Associate Agreement (BAA) with CloudPulse. BAAs are available on the Enterprise plan only.

**Which identity providers do you support?**
SAML 2.0 SSO (Okta, Azure AD, OneLogin) and SCIM provisioning are included with Enterprise. Starter and Pro use email/password or Google OAuth.
`;

const relaywaveDoc = `# Relaywave Messaging API Pricing

**Unlimited API calls on Growth and above.** No meters, no surprise bills. Send SMS, WhatsApp, and email through one API and pay one flat price.

## Why teams switch to Relaywave

- One REST endpoint for every channel
- Delivery receipts and retries handled for you
- 99.95% uptime SLA on paid plans
- SDKs for Node, Python, Go, and Ruby

## Plans

| Plan | Price | API calls | Channels | Support |
|------|-------|-----------|----------|---------|
| Free | $0 | 10,000/mo | SMS, email | Community |
| Growth | $99/mo | Unlimited¹ | SMS, WhatsApp, email | Email |
| Scale | $799/mo | Unlimited | All channels + voice | Priority, 1-hour response |

Carrier fees for SMS and WhatsApp are passed through at cost on every plan.

## Rate limits

Burst traffic is welcome. Every paid workspace starts with 50 requests/second and scales automatically as your volume grows. If you expect a launch spike, tell us and we will pre-warm your capacity.

## Sending your first message

~~~bash
curl https://api.relaywave.com/v2/messages \\
  -u "$RELAYWAVE_SID:$RELAYWAVE_TOKEN" \\
  -d channel=sms -d to=+15555550123 -d body="Your code is 481516"
~~~

## Webhooks

Relaywave posts delivery status, inbound replies, and opt-outs to your webhook URL. Webhook deliveries do not count toward any plan quota.

## Billing FAQ

**Is there a contract?**
No. Growth and Scale are month-to-month. Annual prepay saves 20%.

**Can I switch plans mid-cycle?**
Yes. Upgrades apply immediately and are prorated; downgrades apply at the next cycle.

**Do unused calls roll over?**
Free plan calls do not roll over.

---

¹ Growth workspaces fall under our Fair Use Policy of 1,000,000 requests per calendar month. Traffic beyond this is throttled to 5 requests/second until the next billing cycle. Scale has no monthly cap.
`;

const ledgerlineDoc = `# Ledgerline Admin Guide: Single Sign-On

Ledgerline connects to the identity provider you already use, so finance teams sign in once and access is removed the moment someone leaves.

## Supported identity providers

- Okta
- Microsoft Entra ID (Azure AD)
- Google Workspace
- OneLogin
- Any SAML 2.0 provider

## Plans

| Plan | Price | SSO | Audit log retention |
|------|-------|-----|---------------------|
| Team | $12/user/mo | Google sign-in | 30 days |
| Business | $29/user/mo | SAML 2.0 + SCIM | 1 year |
| Enterprise | Custom | SAML 2.0 + SCIM + enforced SSO | Unlimited |

## Set up SAML SSO

1. Sign in as an admin and open **Settings → Security → SSO** at https://app.ledgerline.com/settings/security/sso.
2. Copy the ACS URL and Entity ID into your identity provider.
3. Paste your IdP metadata URL and click **Verify connection**.
4. Toggle **Require SSO** to stop password sign-ins.

Most teams finish setup in under ten minutes.

## Provision users with SCIM

Generate a SCIM token on the same SSO settings page, then add it to your identity provider's Ledgerline app. New users appear in Ledgerline within a minute of being assigned.

## Troubleshooting

**Users see "Invalid audience".**
The Entity ID in your identity provider does not match Ledgerline's. Copy it again from the SSO settings page.

**I am locked out after enabling Require SSO.**
Owners can always sign in with a recovery code from https://app.ledgerline.com/recover.

**Clock skew errors.**
SAML assertions are valid for five minutes. Check that your IdP server clock is in sync.

## Changelog

- **March 2026, console v4:** Workspace settings moved under Admin. Identity settings now live at Admin → Identity → SAML (/admin/identity/saml); configuring SAML is limited to workspace Owners.
- **January 2026:** Added SCIM group push for Okta.
- **October 2025:** Added Microsoft Entra ID gallery app.
`;

export const FIXTURES: Fixture[] = [
  {
    scenario: {
      id: "cloudpulse",
      name: "HIPAA & SSO buried in FAQ",
      company: "CloudPulse",
      docPath: "docs/pricing-and-compliance.md",
      buyerQuestion: "Does CloudPulse's Pro plan support HIPAA compliance and SSO?",
      publicMarkdown: cloudpulseDoc,
      groundTruthRules: [
        "A HIPAA Business Associate Agreement (BAA) is available only on the Enterprise plan ($499/mo).",
        "Starter and Pro workspaces must not process PHI; no BAA is offered below Enterprise.",
        "SAML SSO and SCIM provisioning are Enterprise-only.",
        "Pro ($49/mo) supports Google OAuth sign-in only, not SAML SSO.",
        "The SOC 2 Type II report covers every plan.",
      ],
    },
    replay: {
      args: {
        parse_doc_claims: {
          raw_markdown: "docs/pricing-and-compliance.md",
          ground_truth_rules: "5 rules: BAA Enterprise-only, no PHI below Enterprise, SAML/SCIM Enterprise-only, Pro is Google OAuth only, SOC 2 all plans",
        },
        test_buyer_prompt: {
          buyer_question: "Does CloudPulse's Pro plan support HIPAA compliance and SSO?",
          public_context: "docs/pricing-and-compliance.md",
        },
        verify_causal_harm: {
          ai_answer: "Says Pro supports HIPAA workloads and SSO, citing the platform-wide security banner and Google Workspace sign-in.",
          ground_truth_rules: "BAA is Enterprise-only ($499/mo); SAML SSO is Enterprise-only; Pro has Google OAuth only",
        },
        generate_pr_artifact: {
          defect_record: "False Claim, Critical: banner implies HIPAA coverage on Pro; BAA and SAML SSO are Enterprise-only",
          original_markdown: "docs/pricing-and-compliance.md",
        },
      },
      outputs: {
        parse_doc_claims: {
          claims: [
            {
              text: "Enterprise-grade SOC2 & HIPAA security across our platform.",
              section: "Banner",
              status: "contradicted",
              relatedRule: "A HIPAA Business Associate Agreement (BAA) is available only on the Enterprise plan ($499/mo).",
            },
            {
              text: "HIPAA-ready infrastructure",
              section: "Security on every plan",
              status: "contradicted",
              relatedRule: "Starter and Pro workspaces must not process PHI; no BAA is offered below Enterprise.",
            },
            {
              text: "Pro workspaces sign in with Google Workspace accounts",
              section: "Security on every plan",
              status: "buried",
              relatedRule: "Pro ($49/mo) supports Google OAuth sign-in only, not SAML SSO.",
            },
            {
              text: "BAAs are available on the Enterprise plan only.",
              section: "Frequently asked questions",
              status: "buried",
              relatedRule: "A HIPAA Business Associate Agreement (BAA) is available only on the Enterprise plan ($499/mo).",
            },
            {
              text: "SAML 2.0 SSO (Okta, Azure AD, OneLogin) and SCIM provisioning are included with Enterprise.",
              section: "Frequently asked questions",
              status: "buried",
              relatedRule: "SAML SSO and SCIM provisioning are Enterprise-only.",
            },
            {
              text: "SOC 2 Type II report available under NDA",
              section: "Security on every plan",
              status: "explicit",
              relatedRule: "The SOC 2 Type II report covers every plan.",
            },
          ],
          buriedOrMissingConditions: [
            "HIPAA BAA requires Enterprise ($499/mo); stated only in the last FAQ, while the banner and 'Security on every plan' imply all tiers.",
            "SAML SSO is Enterprise-only; the plan table has no SSO column and Pro's Google sign-in is framed as SSO-like onboarding.",
          ],
        },
        test_buyer_prompt: {
          answer:
            "Yes. CloudPulse provides enterprise-grade SOC2 and HIPAA security across its whole platform, and the Pro plan ($49/mo) runs on the same HIPAA-ready infrastructure, so you can run HIPAA workloads without upgrading. For SSO, Pro workspaces sign in with Google Workspace accounts, giving your team one-click single sign-on.",
          citedPassages: [
            "Enterprise-grade SOC2 & HIPAA security across our platform.",
            "HIPAA-ready infrastructure",
            "Pro workspaces sign in with Google Workspace accounts, so your team can onboard in one click without new passwords.",
          ],
        },
        verify_causal_harm: {
          verdict: "defect",
          defectType: "False Claim",
          harm: "Critical",
          hallucinatedStatement: "The Pro plan ($49/mo) runs on the same HIPAA-ready infrastructure, so you can run HIPAA workloads without upgrading.",
          violatedRule: "A HIPAA Business Associate Agreement (BAA) is available only on the Enterprise plan ($499/mo).",
          rootCauseExcerpt: "Enterprise-grade SOC2 & HIPAA security across our platform.",
          rootCauseExplanation:
            "The banner is the first sentence on the page and asserts HIPAA security platform-wide. The plan table never mentions HIPAA or SSO, and the BAA condition appears only in the final FAQ, so an answer engine generalizes the banner to Pro. A buyer acting on this would store PHI without a BAA, which is a HIPAA violation.",
          acceptanceTest:
            "Given only the patched page, an answer engine asked \"Does CloudPulse's Pro plan support HIPAA compliance and SSO?\" says HIPAA (BAA) and SAML SSO require Enterprise at $499/mo, and that Pro offers Google OAuth only.",
        },
        generate_pr_artifact: {
          rewrittenMarkdown: edit(cloudpulseDoc, [
            [
              "> **Enterprise-grade SOC2 & HIPAA security across our platform.** Every CloudPulse workspace runs on the same hardened, independently audited infrastructure.",
              "> **SOC 2 Type II security on every plan.** HIPAA workloads (BAA) and SAML SSO require the Enterprise plan ($499/mo).",
            ],
            [
              "## Security on every plan",
              "## Which plans include HIPAA BAA and SAML SSO?\n\nOnly the Enterprise plan ($499/mo) includes a HIPAA Business Associate Agreement (BAA) and SAML 2.0 SSO with SCIM provisioning. Starter and Pro must not be used for protected health information (PHI), and Pro ($49/mo) signs in with Google OAuth, not SAML SSO.\n\n## Security on every plan",
            ],
            ["- HIPAA-ready infrastructure", "- HIPAA BAA available on Enterprise only"],
            [
              "Pro workspaces sign in with Google Workspace accounts, so your team can onboard in one click without new passwords.",
              "Pro workspaces sign in with Google OAuth (not SAML SSO), so your team can onboard in one click without new passwords.",
            ],
          ]),
          faq: [
            {
              question: "Does CloudPulse's Pro plan support HIPAA compliance?",
              answer: "No. A HIPAA Business Associate Agreement (BAA) is available only on the Enterprise plan ($499/mo). Pro ($49/mo) must not be used for PHI.",
            },
            {
              question: "Does CloudPulse's Pro plan include SSO?",
              answer: "Pro supports Google OAuth sign-in only. SAML 2.0 SSO and SCIM provisioning are included with Enterprise ($499/mo).",
            },
          ],
          productName: "CloudPulse API",
          prTitle: "docs(pricing): state that HIPAA BAA and SAML SSO require Enterprise",
          verificationCheck:
            "Re-ask \"Does CloudPulse's Pro plan support HIPAA compliance and SSO?\" against the patched page; the answer must name Enterprise ($499/mo) for both HIPAA and SAML SSO.",
        },
      },
    },
  },
  {
    scenario: {
      id: "relaywave",
      name: "Fair-use cap in a footnote",
      company: "Relaywave",
      docPath: "docs/pricing.md",
      buyerQuestion: "Is there any limit on API calls on Relaywave's Growth plan?",
      publicMarkdown: relaywaveDoc,
      groundTruthRules: [
        "Growth ($99/mo) is capped at 1,000,000 API calls per calendar month under the Fair Use Policy.",
        "Growth requests beyond the cap are throttled to 5 requests/second until the next billing cycle.",
        "Only Scale ($799/mo) has no monthly API call cap.",
        "Free is limited to 10,000 API calls per month.",
      ],
    },
    replay: {
      args: {
        parse_doc_claims: {
          raw_markdown: "docs/pricing.md",
          ground_truth_rules: "4 rules: Growth capped at 1M calls/month, throttled to 5 rps beyond cap, only Scale uncapped, Free 10k/month",
        },
        test_buyer_prompt: {
          buyer_question: "Is there any limit on API calls on Relaywave's Growth plan?",
          public_context: "docs/pricing.md",
        },
        verify_causal_harm: {
          ai_answer: "Says Growth has no limit on API calls and no throttling.",
          ground_truth_rules: "Growth is capped at 1M calls/month then throttled to 5 rps; only Scale is uncapped",
        },
        generate_pr_artifact: {
          defect_record: "Omitted Condition, High: 'Unlimited API calls' hides the 1M/month Growth fair-use cap",
          original_markdown: "docs/pricing.md",
        },
      },
      outputs: {
        parse_doc_claims: {
          claims: [
            {
              text: "Unlimited API calls on Growth and above.",
              section: "Intro",
              status: "contradicted",
              relatedRule: "Growth ($99/mo) is capped at 1,000,000 API calls per calendar month under the Fair Use Policy.",
            },
            {
              text: "Growth | $99/mo | Unlimited¹",
              section: "Plans",
              status: "buried",
              relatedRule: "Growth ($99/mo) is capped at 1,000,000 API calls per calendar month under the Fair Use Policy.",
            },
            {
              text: "Every paid workspace starts with 50 requests/second and scales automatically as your volume grows.",
              section: "Rate limits",
              status: "contradicted",
              relatedRule: "Growth requests beyond the cap are throttled to 5 requests/second until the next billing cycle.",
            },
            {
              text: "Free | $0 | 10,000/mo",
              section: "Plans",
              status: "explicit",
              relatedRule: "Free is limited to 10,000 API calls per month.",
            },
          ],
          buriedOrMissingConditions: [
            "Growth's 1,000,000 calls/month cap and 5 rps throttle appear only in footnote 1 at the bottom of the page.",
            "The 'Rate limits' section says paid workspaces scale automatically and never mentions the post-cap throttle.",
          ],
        },
        test_buyer_prompt: {
          answer:
            "No, there is no limit. Relaywave's Growth plan ($99/mo) includes unlimited API calls with no meters or surprise bills, and paid workspaces start at 50 requests/second and scale automatically as your volume grows.",
          citedPassages: [
            "Unlimited API calls on Growth and above.",
            "Every paid workspace starts with 50 requests/second and scales automatically as your volume grows.",
          ],
        },
        verify_causal_harm: {
          verdict: "defect",
          defectType: "Omitted Condition",
          harm: "High",
          hallucinatedStatement: "No, there is no limit. Relaywave's Growth plan ($99/mo) includes unlimited API calls.",
          violatedRule: "Growth ($99/mo) is capped at 1,000,000 API calls per calendar month under the Fair Use Policy.",
          rootCauseExcerpt: "**Unlimited API calls on Growth and above.** No meters, no surprise bills.",
          rootCauseExplanation:
            "The headline promise is unconditional, the plan table marks Growth 'Unlimited¹', and the cap lives in a footnote after the FAQ. An answer engine drops the footnote marker and repeats the headline. A buyer sizing a 3M message/month workload on Growth would hit the 5 rps throttle in week two.",
          acceptanceTest:
            "Given only the patched page, an answer engine asked \"Is there any limit on API calls on Relaywave's Growth plan?\" says Growth is capped at 1,000,000 calls/month, throttled to 5 requests/second beyond that, and that only Scale ($799/mo) is uncapped.",
        },
        generate_pr_artifact: {
          rewrittenMarkdown: edit(relaywaveDoc, [
            [
              "**Unlimited API calls on Growth and above.** No meters, no surprise bills.",
              "**1,000,000 API calls/month on Growth, unmetered on Scale.** No overage bills on any plan.",
            ],
            ["| Growth | $99/mo | Unlimited¹ |", "| Growth | $99/mo | 1,000,000/mo¹ |"],
            [
              "## Rate limits",
              "## Is there a limit on API calls on the Growth plan?\n\nYes. The Growth plan ($99/mo) includes 1,000,000 API calls per calendar month under our Fair Use Policy; beyond that, requests are throttled to 5 requests/second until the next billing cycle. Only Scale ($799/mo) has no monthly cap.\n\n## Rate limits",
            ],
          ]),
          faq: [
            {
              question: "Is there a limit on API calls on Relaywave's Growth plan?",
              answer: "Yes. Growth ($99/mo) includes 1,000,000 API calls per calendar month. Beyond that, requests are throttled to 5 requests/second until the next billing cycle.",
            },
            {
              question: "Which Relaywave plan has unlimited API calls?",
              answer: "Only Scale ($799/mo) has no monthly API call cap.",
            },
          ],
          productName: "Relaywave Messaging API",
          prTitle: "docs(pricing): surface the Growth plan's 1M calls/month fair-use cap",
          verificationCheck:
            "Re-ask \"Is there any limit on API calls on Relaywave's Growth plan?\" against the patched page; the answer must state the 1,000,000 calls/month cap and the 5 rps throttle.",
        },
      },
    },
  },
  {
    scenario: {
      id: "ledgerline",
      name: "SSO setup points at a removed route",
      company: "Ledgerline",
      docPath: "docs/admin/sso.md",
      buyerQuestion: "Where do I set up SAML SSO in Ledgerline, and which plan do I need?",
      publicMarkdown: ledgerlineDoc,
      groundTruthRules: [
        "Since console v4 (March 2026), SAML SSO is configured at Admin → Identity → SAML (https://app.ledgerline.com/admin/identity/saml).",
        "The legacy path /settings/security/sso was removed in console v4 and returns 404.",
        "Only workspace Owners can configure SAML SSO.",
        "SAML SSO requires the Business plan ($29/user/mo) or higher; Team has Google sign-in only.",
      ],
    },
    replay: {
      args: {
        parse_doc_claims: {
          raw_markdown: "docs/admin/sso.md",
          ground_truth_rules: "4 rules: SAML lives at /admin/identity/saml since v4, legacy /settings/security/sso is a 404, Owners only, Business plan or higher",
        },
        test_buyer_prompt: {
          buyer_question: "Where do I set up SAML SSO in Ledgerline, and which plan do I need?",
          public_context: "docs/admin/sso.md",
        },
        verify_causal_harm: {
          ai_answer: "Sends admins to Settings → Security → SSO at /settings/security/sso; says Business or higher.",
          ground_truth_rules: "Route moved to /admin/identity/saml in v4; legacy path 404s; Owners only",
        },
        generate_pr_artifact: {
          defect_record: "Broken Route, Medium: setup step links /settings/security/sso, removed in console v4",
          original_markdown: "docs/admin/sso.md",
        },
      },
      outputs: {
        parse_doc_claims: {
          claims: [
            {
              text: "Sign in as an admin and open Settings → Security → SSO at https://app.ledgerline.com/settings/security/sso.",
              section: "Set up SAML SSO",
              status: "contradicted",
              relatedRule: "The legacy path /settings/security/sso was removed in console v4 and returns 404.",
            },
            {
              text: "Identity settings now live at Admin → Identity → SAML (/admin/identity/saml); configuring SAML is limited to workspace Owners.",
              section: "Changelog",
              status: "buried",
              relatedRule: "Since console v4 (March 2026), SAML SSO is configured at Admin → Identity → SAML (https://app.ledgerline.com/admin/identity/saml).",
            },
            {
              text: "Business | $29/user/mo | SAML 2.0 + SCIM",
              section: "Plans",
              status: "explicit",
              relatedRule: "SAML SSO requires the Business plan ($29/user/mo) or higher; Team has Google sign-in only.",
            },
            {
              text: "Generate a SCIM token on the same SSO settings page",
              section: "Provision users with SCIM",
              status: "contradicted",
              relatedRule: "The legacy path /settings/security/sso was removed in console v4 and returns 404.",
            },
          ],
          buriedOrMissingConditions: [
            "The working route /admin/identity/saml appears only in the changelog; every setup step still points at the removed /settings/security/sso.",
            "The Owner-only restriction appears only in the changelog; step 1 says any admin can configure SSO.",
          ],
        },
        test_buyer_prompt: {
          answer:
            "You need the Business plan ($29/user/mo) or Enterprise. Sign in as an admin and go to Settings → Security → SSO at https://app.ledgerline.com/settings/security/sso, copy the ACS URL and Entity ID into your identity provider, paste your IdP metadata URL, and click Verify connection.",
          citedPassages: [
            "Sign in as an admin and open **Settings → Security → SSO** at https://app.ledgerline.com/settings/security/sso.",
            "| Business | $29/user/mo | SAML 2.0 + SCIM | 1 year |",
          ],
        },
        verify_causal_harm: {
          verdict: "defect",
          defectType: "Broken Route",
          harm: "Medium",
          hallucinatedStatement: "Sign in as an admin and go to Settings → Security → SSO at https://app.ledgerline.com/settings/security/sso.",
          violatedRule: "The legacy path /settings/security/sso was removed in console v4 and returns 404.",
          rootCauseExcerpt: "Sign in as an admin and open **Settings → Security → SSO** at https://app.ledgerline.com/settings/security/sso.",
          rootCauseExplanation:
            "Step 1 of the setup guide still links the pre-v4 route, and the move to Admin → Identity → SAML is recorded only in the changelog at the bottom. Answer engines quote the numbered steps, so buyers evaluating SSO land on a 404 and non-Owner admins are told they can configure it.",
          acceptanceTest:
            "Given only the patched page, an answer engine asked \"Where do I set up SAML SSO in Ledgerline, and which plan do I need?\" gives https://app.ledgerline.com/admin/identity/saml, says Owners configure it, and names the Business plan ($29/user/mo) or higher.",
        },
        generate_pr_artifact: {
          rewrittenMarkdown: edit(ledgerlineDoc, [
            [
              "## Set up SAML SSO\n\n1. Sign in as an admin and open **Settings → Security → SSO** at https://app.ledgerline.com/settings/security/sso.",
              "## Where do I set up SAML SSO?\n\nWorkspace Owners on the Business plan ($29/user/mo) or higher set up SAML SSO at **Admin → Identity → SAML** (https://app.ledgerline.com/admin/identity/saml). The old Settings → Security → SSO page was removed in console v4.\n\n1. Sign in as a workspace Owner and open **Admin → Identity → SAML** at https://app.ledgerline.com/admin/identity/saml.",
            ],
            [
              "Generate a SCIM token on the same SSO settings page,",
              "Generate a SCIM token on the Admin → Identity → SAML page,",
            ],
            [
              "Copy it again from the SSO settings page.",
              "Copy it again from Admin → Identity → SAML.",
            ],
          ]),
          faq: [
            {
              question: "Where do I set up SAML SSO in Ledgerline?",
              answer: "Workspace Owners configure SAML SSO at Admin → Identity → SAML (https://app.ledgerline.com/admin/identity/saml).",
            },
            {
              question: "Which Ledgerline plan includes SAML SSO?",
              answer: "SAML SSO and SCIM require the Business plan ($29/user/mo) or Enterprise. Team includes Google sign-in only.",
            },
          ],
          productName: "Ledgerline",
          prTitle: "docs(sso): point SAML setup at Admin → Identity → SAML",
          verificationCheck:
            "Re-ask \"Where do I set up SAML SSO in Ledgerline, and which plan do I need?\" against the patched page; the answer must give /admin/identity/saml and never /settings/security/sso.",
        },
      },
    },
  },
];
