# MVP Test Plan

## Testing Objectives

Validate usability, financial correctness, basic security, responsiveness, and Windows floating overlay reliability.

## Core Functional Tests

### Chat Extraction

- Burmese customer conversation.
- English customer conversation.
- Mixed-language conversation.
- Multiple products.
- Quantity changes.
- Missing delivery address.
- Missing product price.
- Ambiguous customer message.

Expected: AI provides editable drafts without inventing unknown fields.

### Order Management

- Approve draft order.
- Edit product quantity.
- Recalculate total.
- Save changes.
- View change history.
- Prevent unauthorized access.

### Vouchers

- Generate first voucher.
- Preview voucher.
- Download/print.
- Modify order and create new voucher version.
- Retrieve previous versions.

### Payments

- Extract screenshot information.
- Handle unreadable screenshot.
- Correct recognized amount.
- Find candidate orders.
- Handle no match.
- Save pending review.
- Confirm after trusted seller verification.
- Prevent duplicate or excessive payment allocation.

### Finance

- Record expenses.
- Calculate recorded sales.
- Calculate confirmed payments.
- Calculate outstanding amounts.
- Calculate estimated profit.
- Avoid counting product costs twice.
- Filter by date.
- Export report.

## Windows Electron Tests

- Launcher appears above an ordinary Messenger browser window.
- Transparent mascot renders properly.
- Open and minimize work.
- Drag and resize work where supported.
- Copy/paste functions.
- Draft persists when minimized.
- No secrets exposed to renderer.

## UI/UX Tests

- Desktop sidebar expand/collapse.
- Four dashboard cards respond to content width.
- Order drawer is readable.
- Mobile bottom navigation.
- English/Burmese switching.
- Accessible buttons and form labels.
- Visible validation errors.
- Reduced-motion alternative.
- Dolphin does not obstruct important controls.

## Buildathon Demo Test

Run the complete primary journey at least three times with the same synthetic sample data.

Ensure that all financial numbers match the expected results.

Test the local fallback separately.

Record known failures and their workarounds before the presentation.
