# MultiPicross Maintenance Plan

This document describes how development of MultiPicross winds down at the end of
the unit, what happens to the production system afterwards, and what the project
costs to run.

## Contents

1. [Summary](#1-summary)
2. [Winding down contribution](#2-winding-down-contribution)
3. [Timeline](#3-timeline)
4. [Production after Week 12](#4-production-after-week-12)
5. [Costs](#5-costs)
6. [Continuing the project](#6-continuing-the-project)
7. [Generative AI statement](#7-generative-ai-statement)

## 1. Summary

Active development of MultiPicross concludes at the end of the unit in Week 12.
The production deployment at `multipicross.com` will remain in operation until
1 November 2026, at which point it will be decommissioned. Hosting costs incurred
up to that date are covered by Google Cloud trial credit. Following
decommissioning, the project will incur no further costs. The source code will
remain available in the repository, from which the system may be redeployed by
any interested party.

## 2. Winding down contribution

Team members are under no obligation to continue maintaining the project
following final submission. Prior to the conclusion of the unit, the following
measures will be taken:

- Outstanding work and known defects will remain documented in the issue tracker.
- Branch protection on `main` will be retained, such that any subsequent change
  remains subject to review and continuous integration checks.

Contact details for team members are provided in the [README](README.md#9-team).
Enquiries regarding infrastructure, the domain, or billing should be directed to
@kubisch until the production environment is decommissioned.

## 3. Timeline

| When            | Event                                                                                   |
| --------------- | --------------------------------------------------------------------------------------- |
| Week 12         | Final submission. Active development concludes; only critical fixes are made thereafter |
| 1 November 2026 | Production environment decommissioned (Section 4.2)                                     |
| July 2027       | `multipicross.com` registration expires without renewal                                 |

## 4. Production after Week 12

### 4.1 Operation until decommissioning

The production environment will continue to operate without modification on a
single Google Cloud Compute Engine instance, as described in the
[README](README.md#1-architecture). Authentication continues to be provided by
Monash SSO, and merges to `main` continue to be deployed automatically.

### 4.2 Decommissioning procedure

On 1 November 2026, @kubisch will perform the following steps in order.

1. **Disable automatic deployment.** Disable the Deploy workflow in GitHub
   Actions, and remove the repository variables and the `production` environment
   (README Section 5.8).
2. **Delete the Google Cloud project.** This removes the instance, disks,
   database snapshots, container images, secrets, service accounts, and the
   OpenTofu state bucket. The associated billing account is then closed.
3. **Deregister the SSO client.** Submit a request to Monash University to
   decommission the MultiPicross OIDC client registration.
4. **Remove the DNS records** for `multipicross.com`. The domain is then left to
   expire.

### 4.3 User data

All player data, including accounts, statistics, and saved games, is deleted
along with the Google Cloud project. No copy is retained.

## 5. Costs

The table below shows the approximate cost of keeping the project running.

| Item                              | Approximate cost    |
| --------------------------------- | ------------------- |
| One Google Cloud environment      | US$12 per month     |
| `multipicross.com` domain renewal | US$16 per year      |
| **Total**                         | **US$160 per year** |

These costs would be borne by any party that elects to continue operating or
redeploy the project. Responsibility for costs during and after the operating
period is as follows.

- **Until 1 November 2026:** Google Cloud costs are covered by the US$300 trial
  credit. The domain registration was funded by @kubisch.
- **After 1 November 2026:** no costs are incurred, as the infrastructure is
  deleted and the domain registration is not renewed.

## 6. Continuing the project

The repository will remain in the Monash-FIT3170 GitHub organisation. Any
interested party wishing to redeploy the project will require:

- a Google Cloud project with a billing account
- a domain name
- an OIDC identity provider, such as Monash SSO (README Section 4.4)

The [README](README.md) covers the full process: required software (Section 2),
authentication (Section 4), provisioning (Section 5), and deployment
(Section 6). The running costs in Section 5 are paid by whoever provisions the
new environment.

Parties redeploying the project should be aware of the following:

- **Dependencies will be out of date.** Update the npm dependencies and run
  `npm audit` in each service before deploying.
- **Use a new `OIDC_PROVIDER_ID`** for any new environment (README Section 4.1).
- **Database credentials are fixed at creation.** The `POSTGRES_*` secrets only
  take effect when the database is first initialised. Changing them afterwards
  stops the API and game server from connecting.
- **Certificates are issued automatically.** Traefik obtains new Let's Encrypt
  certificates once the DNS records point to the new instance (README
  Section 5.9).

## 7. Generative AI statement

This document was prepared with the assistance of Claude Opus 5.5, a generative
AI model developed by Anthropic. The content was reviewed and verified by the
MultiPicross team, who take full responsibility for its accuracy.
