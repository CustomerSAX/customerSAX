## Task: Implement Dynamic Knowledge Base Upload & Organization-Based Management

### Objective

Currently, the Customer CX Knowledge Base is using static/local data for demonstration purposes. It has two tabs:

1. **FAQ**
2. **Troubleshoot**

Each tab contains multiple sections, and each section contains collapsible Question & Answer items.

I want to make this Knowledge Base completely dynamic and organization-specific.

The customer/admin should be able to upload their own Knowledge Base content from the Organization Admin panel. The uploaded data should be stored in MongoDB against the specific organization and then rendered dynamically in the Customer CX Knowledge Base.

---

### 1. File Upload Approach

Use **Excel (`.xlsx`)** as the primary supported upload format.

Create a simple Excel template that customers can download from the Admin panel and use to prepare their Knowledge Base.

The Excel file should contain two sheets:

#### Sheet 1: `FAQ`

| Section | Question | Answer |
|---|---|---|
| Account | How do I reset my password? | Go to Settings... |
| Account | How do I update my email? | Open your profile... |
| Orders | How can I track my order? | Go to Orders... |

#### Sheet 2: `Troubleshoot`

| Section | Question | Answer |
|---|---|---|
| Login Issues | I cannot log in | Check your credentials... |
| Payment Issues | My payment failed | Verify your payment method... |
| Orders | My order is delayed | Contact support... |

Keep the template extremely simple so a non-technical customer can understand and edit it easily.

---

### 2. Admin Panel

Add a **Knowledge Base** configuration section in the Organization Admin panel.

The admin should be able to:

- Download the sample Excel template.
- Upload their completed `.xlsx` file.
- See the currently uploaded Knowledge Base status.
- Replace the existing Knowledge Base by uploading a new file.

Example UI:

**Knowledge Base**

> Upload your organization's FAQ and Troubleshooting content using the Excel template.

[Download Template]

[Upload Knowledge Base]

After upload:

> Knowledge Base uploaded successfully.

Also display basic information such as:

- Last updated date/time
- Number of FAQ entries
- Number of Troubleshoot entries

Do not overcomplicate this UI.

---

### 3. File Processing

When an organization uploads an Excel file:

1. Validate the file type.
2. Validate that the required sheets exist:
   - `FAQ`
   - `Troubleshoot`
3. Validate required columns:
   - `Section`
   - `Question`
   - `Answer`
4. Validate that required values are not empty.
5. Parse the Excel file.
6. Convert the rows into the application's Knowledge Base structure.
7. Save the processed data in MongoDB against the current organization.
8. Return a clear success/error response to the admin.

If validation fails, do not partially update the existing Knowledge Base. Show meaningful validation errors so the admin can fix the Excel file and upload it again.

---

### 4. MongoDB Data Model

Design the MongoDB structure so Knowledge Base data is isolated by organization.

The important requirement is:

**Every Knowledge Base record must belong to an organization.**

Use the existing organization's identifier/tenant identifier from the application rather than introducing a new organization identification mechanism.

A possible structure is:

```text
knowledgeBases
  _id
  organizationId
  type: "faq" | "troubleshoot"
  section
  question
  answer
  createdAt
  updatedAt
```

You may adjust the schema if the existing project's architecture has a better approach.

The schema should support efficient querying by:

```text
organizationId
type
section
```

---

### 5. Replace Existing Data

Version history is **not required**.

When an organization uploads a new Knowledge Base file:

1. Validate the complete file first.
2. Parse all data.
3. Replace the organization's existing Knowledge Base data with the newly uploaded data.
4. Do not keep the previous version.

Important:

**Never delete the existing data before the new file has been successfully validated and parsed.**

The replacement should behave transactionally from the application's perspective:

```text
Upload
  ↓
Validate
  ↓
Parse
  ↓
If valid → Replace existing organization KB
If invalid → Keep existing KB unchanged
```

This prevents a bad upload from leaving the organization with an empty or corrupted Knowledge Base.

---

### 6. Customer CX Knowledge Base

Remove the dependency on the current static/local Knowledge Base data.

The Knowledge Base page should fetch the data dynamically based on the logged-in user's organization.

The existing UI should remain largely unchanged.

Continue supporting:

- FAQ tab
- Troubleshoot tab
- Sections/categories
- Collapsible Question & Answer items
- Existing styling and UX

Only change the data source from:

```text
Static/local data
```

to:

```text
MongoDB → Organization-specific Knowledge Base
```

The UI should automatically render whatever content the organization has uploaded.

---

### 7. Organization Isolation

This is important.

Organization A must only see Organization A's Knowledge Base.

Organization B must only see Organization B's Knowledge Base.

Never fetch Knowledge Base data globally.

Every API/query must be scoped using the authenticated user's organization/tenant context.

Also ensure that an organization cannot upload or modify another organization's Knowledge Base.

---

### 8. API Requirements

Create appropriate backend APIs following the existing project's architecture.

Suggested endpoints:

```text
POST /organizations/:organizationId/knowledge-base/upload
GET  /organizations/:organizationId/knowledge-base
```

You may use the project's existing API conventions instead if different.

The upload endpoint should handle:

- File upload
- Excel parsing
- Validation
- Data replacement
- Organization association

The GET endpoint should return the Knowledge Base grouped in a structure that is easy for the frontend to render.

For example:

```json
{
  "faq": [
    {
      "section": "Account",
      "items": [
        {
          "question": "How do I reset my password?",
          "answer": "Go to Settings..."
        }
      ]
    }
  ],
  "troubleshoot": [
    {
      "section": "Login Issues",
      "items": [
        {
          "question": "I cannot log in",
          "answer": "Check your credentials..."
        }
      ]
    }
  ]
}
```

Adjust this structure according to the existing application's conventions.

---

### 9. Template Download

Provide a downloadable sample Excel file from the Organization Admin panel.

The template should contain:

- `FAQ` sheet
- `Troubleshoot` sheet
- Example rows
- Correct column headers
- Short instructions/examples where appropriate

The customer should be able to download it, replace the example data with their own data, and upload it without needing technical knowledge.

---

### 10. Error Handling

Handle common upload errors gracefully:

- Invalid file type
- Missing FAQ sheet
- Missing Troubleshoot sheet
- Missing required columns
- Empty question
- Empty answer
- Empty section
- Invalid Excel structure
- Duplicate/invalid rows if applicable
- Upload/parsing failure
- Database failure

Display user-friendly error messages in the Admin UI.

Do not expose raw backend errors to the customer.

---

### 11. Existing UI Preservation

Do not redesign the existing Knowledge Base page.

The current FAQ/Troubleshoot UI, collapsible behavior, sections, styling, and overall UX should remain intact.

Only replace the static data source with the dynamic organization-specific MongoDB data.

Also avoid unnecessary changes to unrelated Customer CX functionality.

---

### 12. Implementation Expectations

Before making changes:

1. Inspect the existing Customer CX Knowledge Base implementation.
2. Identify where the current static/local data is stored.
3. Inspect the existing organization/tenant model.
4. Inspect the existing authentication and authorization flow.
5. Inspect the existing MongoDB setup and conventions.
6. Inspect the existing Organization Admin panel.
7. Reuse existing patterns wherever possible.

Do not introduce duplicate organization/tenant logic if the project already has it.

Use the project's existing coding conventions, architecture, components, API patterns, validation libraries, and error handling.

---

### 13. Acceptance Criteria

The implementation is complete when:

- [ ] Organization Admin can download the Knowledge Base Excel template.
- [ ] Organization Admin can upload an `.xlsx` file.
- [ ] Excel contains `FAQ` and `Troubleshoot` sheets.
- [ ] Each sheet supports `Section`, `Question`, and `Answer`.
- [ ] Uploaded data is validated before replacing existing data.
- [ ] Knowledge Base is stored in MongoDB.
- [ ] Data is associated with the correct organization.
- [ ] Organizations cannot access each other's Knowledge Base.
- [ ] Uploading a new file replaces the organization's existing Knowledge Base.
- [ ] Previous versions are not retained.
- [ ] Failed uploads do not destroy existing data.
- [ ] Customer CX Knowledge Base reads from MongoDB instead of static/local data.
- [ ] FAQ and Troubleshoot tabs continue working as they currently do.
- [ ] Sections and collapsible Q&A behavior remain unchanged.
- [ ] Empty Knowledge Base states are handled gracefully.
- [ ] Upload success and validation errors are clearly communicated.
- [ ] Existing unrelated functionality is not affected.

### Important

Keep the implementation simple and production-ready. This is a customer-managed Knowledge Base, not a version-controlled content management system. Do not introduce unnecessary versioning, revision history, approval workflows, or complex CMS functionality at this stage.

The primary goal is:

**Organization Admin uploads Excel → Backend validates and stores data → MongoDB stores organization-specific Knowledge Base → Customer CX dynamically displays that organization's content.**