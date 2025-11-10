# Placeholder Content Files

This directory contains static placeholder files used in the selective access control system to replace restricted content while maintaining document structure.

## Files

### `preview-not-available.pdf` (1.45 KB)
- **Usage**: Replaces individual PDF pages that are not accessible in preview mode (Portrait A4)
- **Content**: Professional "Content Restricted" page with lock icon and Ludora branding
- **Features**:
  - Clear messaging about content restrictions
  - Upgrade call-to-action
  - Consistent with brand styling
  - Lightweight (< 2 KB)

### `preview-not-available-landscape.pdf` (1.55 KB)
- **Usage**: Template editor placeholder for landscape PDF template design (A4 Landscape)
- **Content**: Professional template preview page optimized for landscape format
- **Features**:
  - Template editing guidance and visual indicators
  - Header and footer area markers for better template design
  - Landscape A4 format (842 × 595 pt)
  - Consistent with brand styling

### `preview-not-available.svg` (2.38 KB)
- **Usage**: Replaces individual lesson plan slides that are not accessible in preview mode
- **Content**: SVG slide with lock icon and restriction messaging
- **Features**:
  - Scalable vector format
  - Professional design with consistent branding
  - Clear hierarchy of information
  - Responsive layout

### `preview-limited.svg` (2.5 KB)
- **Usage**: Alternative messaging for partial access scenarios
- **Content**: "Limited Preview Access" with benefits list and upgrade CTA
- **Features**:
  - Positive messaging about available content
  - Benefits list to encourage upgrade
  - Call-to-action button
  - More encouraging tone than complete restriction

## Technical Implementation

### PDF Page Replacement
When a PDF page is restricted:
1. The original page is skipped during document assembly
2. `preview-not-available.pdf` is inserted at the same position
3. Page numbering is maintained
4. Document structure remains intact

### SVG Slide Replacement
When a lesson plan slide is restricted:
1. The restricted slide request returns `preview-not-available.svg`
2. Slide navigation continues to work normally
3. Total slide count remains the same
4. User experience is preserved

## Generation

The PDF placeholder is generated using the `scripts/generate-pdf-placeholder.js` script, which uses pdf-lib to create a professional-looking placeholder page.

```bash
# Regenerate PDF placeholder
node scripts/generate-pdf-placeholder.js
```

## Customization

To customize the placeholder content:

1. **PDF**: Modify `scripts/generate-pdf-placeholder.js` and regenerate
2. **SVG**: Edit the SVG files directly (they are text-based)

## Design Guidelines

All placeholder files follow these design principles:
- **Professional appearance**: Consistent with Ludora branding
- **Clear messaging**: Users understand what's happening and why
- **Call-to-action**: Encourage upgrade to full access
- **Lightweight**: Minimal file size for fast loading
- **Accessible**: Good contrast and readable fonts

## Integration Points

These files are referenced in:
- `utils/PdfPageReplacementService.js` - PDF page replacement logic
- `routes/assets.js` - Slide serving with access control
- `services/AccessControlService.js` - Permission checking logic

## Future Enhancements

Potential improvements:
- Multi-language support
- Customizable branding per organization
- Dynamic content injection (user name, specific upgrade offers)
- A/B testing different messaging approaches